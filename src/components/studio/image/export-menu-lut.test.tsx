import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { emptyArtboard, imageDocument, newImageLayer } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

import { createImageCommands } from "./commands";
import { createEditorUiStore, ImageEditorContext } from "./editor-state";
import { ExportMenu } from "./export-menu";

const rasterize = vi.fn();

vi.mock("@/i18n/routing", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ permissionsLoading: false, can: () => true }) }));
vi.mock("./use-document-readiness", () => ({ useDocumentReadiness: () => "ready" }));
vi.mock("@/components/studio/canvas/media-files", () => ({ loadMediaFile: async () => null }));
vi.mock("./export-artboards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./export-artboards")>();
  return { ...actual, loadRaster: async () => ({ rasterizeLayers: rasterize, RasterTimeoutError: class extends Error {} }) };
});

const t = ptMessages.studio.image.export;

describe("ExportMenu with a LUT that cannot be read", () => {
  it("refuses every format, names the layer and never draws the artboard without the LUT", async () => {
    const artboard = { ...emptyArtboard({ width: 400, height: 400 }), id: "ab" };
    artboard.layers = [{ ...newImageLayer("photo"), id: "hero", name: "Foto principal", color: { lut: { assetId: "lost-look" } } }];
    const store = createStudioStore(imageDocument([artboard]));
    const ui = createEditorUiStore();
    const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn() });
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
          <ExportMenu />
        </ImageEditorContext.Provider>
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: t.open }));
    const refusal = t.errors.lut.replace("{name}", "Foto principal");
    for (const format of ["PNG", "JPG", "PDF", "SVG"]) {
      fireEvent.click(screen.getByRole("button", { name: format }));
      fireEvent.click(await screen.findByRole("button", { name: t.download }));
      expect(await screen.findByText(refusal)).toBeTruthy();
    }
    expect(rasterize).not.toHaveBeenCalled();
  });
});
