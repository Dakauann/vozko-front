import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { emptyArtboard, fullFrame, imageDocument, newImageLayer, type ImageDocument, type Layer } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";
import { STILL_VFX_KINDS } from "@/lib/studio/still-vfx";
import { groupedKinds } from "@/lib/studio/vfx";

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }), listLibraryAction: vi.fn().mockResolvedValue({ data: [] }), uploadMediaAction: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../trace/layer-raster", () => ({ layerRaster: vi.fn() }));
vi.mock("../../canvas/key-color", () => ({ assetKeyColor: vi.fn(), eyeDropper: () => null }));
const thumbnails = vi.fn();
vi.mock("../../video/panels/effect-thumbnails", () => ({ PLAIN_PREVIEW: "plain", useEffectThumbnails: () => thumbnails() }));

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { Inspector } from "./inspector";

const vfx = ptMessages.studio.video.vfx;
const photo: Layer = { ...newImageLayer("media-photo", fullFrame()), id: "photo" };

function setup(layers: Layer[], selection: string[]) {
  const doc: ImageDocument = imageDocument([{ ...emptyArtboard({ width: 800, height: 600 }), layers }]);
  const store = createStudioStore(doc);
  store.getState().select(selection);
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn().mockResolvedValue({ width: 10, height: 10 }) });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>
          <Inspector />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.effects }));
  return store;
}

function section(): HTMLElement {
  return screen.getByRole("group", { name: ptMessages.studio.image.vfx.add }).parentElement!;
}

describe("still effects in the image inspector", () => {
  it("adds an effect to a photo from the preview tiles, tunes it, hides it and removes it", { timeout: 15_000 }, () => {
    thumbnails.mockReturnValue(null);
    const store = setup([photo], ["photo"]);
    const tiles = within(screen.getByRole("group", { name: ptMessages.studio.image.vfx.add })).getAllByRole("button");
    expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual(groupedKinds(STILL_VFX_KINDS).flatMap((entry) => entry.kinds).map((kind) => `Adicionar efeito: ${vfx.kinds[kind]}`));
    fireEvent.click(screen.getByRole("button", { name: `Adicionar efeito: ${vfx.kinds.vignette}` }));
    const added = store.getState().document.artboards[0].layers[0].vfx;
    expect(added?.map((entry) => entry.kind)).toEqual(["vignette"]);
    expect(within(section()).getByRole("button", { name: `Efeito 1: ${vfx.kinds.vignette}` })).toBeTruthy();
    expect(within(section()).getByText(vfx.params.roundness)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: vfx.hide }));
    expect(store.getState().document.artboards[0].layers[0].vfx?.[0].hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: vfx.remove }));
    expect(store.getState().document.artboards[0].layers[0].vfx).toBeUndefined();
  });

  it("shows only the values a still picture can use", { timeout: 15_000 }, () => {
    thumbnails.mockReturnValue(null);
    setup([{ ...photo, vfx: [{ id: "flare", kind: "lensFlare", seed: 4 }] }], ["photo"]);
    expect(screen.getByText(vfx.params.streak)).toBeTruthy();
    expect(screen.queryByText(vfx.params.flicker)).toBeNull();
    expect(screen.getByRole("button", { name: vfx.shuffle })).toBeTruthy();
  });

  it("puts artboard effects on the artboard when nothing is selected", { timeout: 15_000 }, () => {
    thumbnails.mockReturnValue(new Map([["plain", "data:image/png;base64,p"], ["grain", "data:image/png;base64,g"]]));
    const store = setup([photo], []);
    expect(screen.getByText(ptMessages.studio.image.vfx.artboardIntro)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `Adicionar efeito: ${vfx.kinds.grain}` }));
    expect(store.getState().document.artboards[0].canvas.vfx?.map((entry) => entry.kind)).toEqual(["grain"]);
    expect(store.getState().document.artboards[0].layers[0].vfx).toBeUndefined();
    expect(document.querySelector('[data-studio-effect-preview="grain"]')).not.toBeNull();
  });

  it("keeps the tiles disabled on a locked photo", { timeout: 15_000 }, () => {
    thumbnails.mockReturnValue(null);
    setup([{ ...photo, locked: true }], ["photo"]);
    expect((screen.getByRole("button", { name: `Adicionar efeito: ${vfx.kinds.grain}` }) as HTMLButtonElement).disabled).toBe(true);
  });
});
