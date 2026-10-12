import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { emptyArtboard, imageDocument } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

import { createImageCommands } from "./commands";
import { createEditorUiStore, ImageEditorContext } from "./editor-state";
import { ExportMenu } from "./export-menu";

const pushMock = vi.fn();
const renderMock = vi.fn();
const saveMock = vi.fn();
const permissions = { ads: true };

vi.mock("@/i18n/routing", () => ({ useRouter: () => ({ push: pushMock }) }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ permissionsLoading: false, can: (resource: string) => resource === "ads" && permissions.ads }),
}));

vi.mock("./use-document-readiness", () => ({ useDocumentReadiness: () => "ready" }));

vi.mock("./export-artboards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./export-artboards")>();
  return {
    ...actual,
    loadRaster: async () => ({}),
    renderArtboard: (...args: unknown[]) => renderMock(...args),
    renderExport: (raster: unknown, artboards: { id: string }[], request: unknown, titleOf: (artboard: { id: string }) => string) => Promise.all(artboards.map((artboard) => renderMock(raster, artboard, request, titleOf(artboard)))),
    saveRendered: (...args: unknown[]) => saveMock(...args),
  };
});

const ad = ptMessages.adFromMedia;

function setup(artboards = 1) {
  const boards = Array.from({ length: artboards }, (_, i) => ({ ...emptyArtboard({ width: 1080, height: 1080 }), id: `ab-${i}` }));
  const store = createStudioStore(imageDocument(boards));
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn() });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
        <ExportMenu />
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.image.export.open }));
}

describe("ExportMenu, use in an ad", () => {
  beforeEach(() => {
    permissions.ads = true;
    pushMock.mockReset();
    renderMock.mockReset();
    saveMock.mockReset();
    renderMock.mockImplementation(async (_raster, artboard: { id: string }) => ({ artboardId: artboard.id, blob: new Blob(["x"]), fileName: "a.png", title: "Projeto" }));
    saveMock.mockResolvedValue({ ok: true, saved: [{ mediaId: "m-1", mediaUrl: "https://cdn/m-1.png", artboardId: "ab-0" }] });
  });

  it("saves the open artboard without transparency and opens ad creation with it", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: ad.useInAd }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard/advertising?create=1&media=m-1&mediaKind=image"));
    expect(renderMock.mock.calls[0][2]).toMatchObject({ format: "png", transparent: false });
  });

  it("is not offered to someone who cannot create ads", async () => {
    permissions.ads = false;
    setup();
    await screen.findByRole("button", { name: ptMessages.studio.image.export.save });
    expect(screen.queryByRole("button", { name: ad.useInAd })).toBeNull();
  });

  it("asks for a single artboard when every artboard is chosen", async () => {
    setup(2);
    fireEvent.click(await screen.findByRole("button", { name: ptMessages.studio.image.export.scopeAll.replace("{count}", "2") }));
    expect(screen.getByRole("button", { name: ad.useInAd })).toHaveProperty("disabled", true);
    expect(screen.getByText(ad.oneArtboard)).toBeTruthy();
  });
});
