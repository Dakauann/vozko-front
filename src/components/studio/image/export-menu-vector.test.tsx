import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { emptyArtboard, imageDocument, newShapeLayer, newTextLayer } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

import { createImageCommands } from "./commands";
import { createEditorUiStore, ImageEditorContext } from "./editor-state";
import { ExportMenu } from "./export-menu";

const renderExport = vi.fn();
const saveRendered = vi.fn();

vi.mock("@/i18n/routing", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ permissionsLoading: false, can: () => false }) }));
vi.mock("./use-document-readiness", () => ({ useDocumentReadiness: () => "ready" }));
vi.mock("./export-artboards", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./export-artboards")>()),
  loadRaster: async () => ({}),
  renderExport: (...args: unknown[]) => renderExport(...args),
  saveRendered: (...args: unknown[]) => saveRendered(...args),
}));

const t = ptMessages.studio.image.export;

function setup() {
  const boards = [
    { ...emptyArtboard({ width: 1080, height: 1080 }), id: "ab-0", layers: [newShapeLayer("rect"), newTextLayer("Oi")] },
    { ...emptyArtboard({ width: 1080, height: 1920 }), id: "ab-1", layers: [] },
  ];
  const store = createStudioStore(imageDocument(boards));
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn() });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-9", projectName: "Projeto" }}>
        <ExportMenu />
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: t.open }));
}

describe("exporting PDF and SVG by hand", () => {
  beforeEach(() => {
    renderExport.mockReset();
    saveRendered.mockReset();
    renderExport.mockResolvedValue([{ artboardId: "ab-0", artboardIds: ["ab-0", "ab-1"], format: "pdf", blob: new Blob(["%PDF-"]), fileName: "projeto.pdf", title: "Projeto" }]);
    saveRendered.mockResolvedValue({ ok: true, saved: [{ mediaId: "m-1", mediaUrl: "https://x/m-1.pdf", artboardId: "ab-0", artboardIds: ["ab-0", "ab-1"] }] });
  });

  it("offers the print preset for PDF, hides the image size and says what becomes pixels", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(screen.queryByRole("group", { name: t.scale })).toBeNull();
    expect(screen.getByText(t.vectorHint)).toBeTruthy();
    expect(screen.getByText("1 camada entra como imagem.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.presets.print }));
    expect(screen.getByText(t.presetHints.print)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.scopeAll.replace("{count}", "2") }));
    expect(screen.getByText(t.scopeAllPdfHint)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.download })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    await waitFor(() => expect(saveRendered).toHaveBeenCalled());
    const [, artboards, request, , projectName] = renderExport.mock.calls[0];
    expect(artboards.map((a: { id: string }) => a.id)).toEqual(["ab-0", "ab-1"]);
    expect(request).toMatchObject({ format: "pdf", preset: "print", transparent: true });
    expect(projectName).toBe("Projeto");
    expect(saveRendered.mock.calls[0][2]).toBe("p-9");
  });

  it("zips one SVG per artboard on download", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "SVG" }));
    fireEvent.click(screen.getByRole("button", { name: t.scopeAll.replace("{count}", "2") }));
    expect(screen.getByRole("button", { name: t.downloadZip })).toBeTruthy();
    expect(screen.queryByRole("group", { name: t.preset })).toBeNull();
  });
});
