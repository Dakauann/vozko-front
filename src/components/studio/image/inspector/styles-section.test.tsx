import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";
import { imageDocument, type ImageDocument, type Layer } from "@/lib/studio/document";
import { settleImage } from "@/lib/studio/image-settle";
import type { StudioStyle } from "@/lib/studio/shared-styles";
import { createStudioStore } from "@/lib/studio/store";

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }), listLibraryAction: vi.fn().mockResolvedValue({ data: [] }), uploadMediaAction: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../trace/layer-raster", () => ({ layerRaster: vi.fn() }));
vi.mock("../../canvas/key-color", () => ({ assetKeyColor: vi.fn(), eyeDropper: () => null }));

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { Inspector } from "./inspector";

const box = { x: 0.5, y: 0.5, w: 0.6, h: 0.2, rotation: 0, opacity: 1 };
const title: Layer = { id: "title", type: "text", text: "Oferta", fontId: "montserrat", fontWeight: 800, fontSize: 72 / 1080, fill: "#e4003a", transform: box };
const card: Layer = { id: "card", type: "shape", shape: "rect", fill: "#111111", transform: { ...box, y: 0.8 } };
const red: StudioStyle = { id: "red", kind: "color", name: "Vermelho", color: "#e4003a" };

function setup(styles: StudioStyle[], selection: string[], messages: typeof ptMessages = ptMessages) {
  const doc: ImageDocument = { ...imageDocument([{ id: "feed", x: 0, y: 0, canvas: { width: 1080, height: 1080, background: "#ffffff" }, layers: [{ ...title, ...(styles.length > 0 ? { fillStyleId: "red" } : {}) }, card] }]), ...(styles.length > 0 ? { styles } : {}) };
  const store = createStudioStore(doc, { settle: settleImage });
  store.getState().select(selection);
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn().mockResolvedValue({ width: 10, height: 10 }) });
  render(
    <NextIntlClientProvider locale={messages === ptMessages ? "pt" : "en"} messages={messages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>
          <Inspector />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return { store };
}

function layerIn(store: ReturnType<typeof setup>["store"], id: string): Layer {
  return store.getState().document.artboards[0].layers.find((l) => l.id === id)!;
}

const t = ptMessages.studio.image.styles;

describe("styles in the inspector", () => {
  it("saves a layer's text as a style and links it", { timeout: 15_000 }, () => {
    const { store } = setup([], ["title"]);
    const section = screen.getByRole("region", { name: t.title });
    fireEvent.click(within(section).getByRole("button", { name: t.create.replace("{slot}", t.slots.text) }));
    const [style] = store.getState().document.styles ?? [];
    expect(style).toMatchObject({ kind: "text", name: t.defaults.text.replace("{number}", "1"), fontId: "montserrat", fontWeight: 800, fontSizePx: 72 });
    expect(layerIn(store, "title").textStyleId).toBe(style.id);
  });

  it("links a layer to a color style through the picker and unlinks it", { timeout: 15_000 }, () => {
    const { store } = setup([red], ["card"]);
    const section = screen.getByRole("region", { name: t.title });
    fireEvent.change(within(section).getByLabelText(t.slots.fill), { target: { value: "red" } });
    expect(layerIn(store, "card")).toMatchObject({ fill: "#e4003a", fillStyleId: "red" });
    fireEvent.click(within(section).getByRole("button", { name: t.detach.replace("{slot}", t.slots.fill) }));
    expect(layerIn(store, "card").fillStyleId).toBeUndefined();
    expect(layerIn(store, "card").fill).toBe("#e4003a");
  });

  it("edits a style for every linked layer and deletes it without touching values", { timeout: 15_000 }, () => {
    const { store } = setup([red], []);
    const section = screen.getByRole("region", { name: t.title });
    fireEvent.click(within(section).getByRole("button", { name: t.edit.replace("{name}", "Vermelho") }));
    const color = within(section).getByRole("textbox", { name: t.color });
    fireEvent.change(color, { target: { value: "#0044ff" } });
    fireEvent.blur(color);
    expect(layerIn(store, "title")).toMatchObject({ fill: "#0044ff", fillStyleId: "red" });
    fireEvent.click(within(section).getByRole("button", { name: t.delete.replace("{name}", "Vermelho") }));
    expect(store.getState().document.styles).toBeUndefined();
    expect(layerIn(store, "title")).toMatchObject({ fill: "#0044ff" });
    expect(layerIn(store, "title").fillStyleId).toBeUndefined();
  });

  it("speaks English too", { timeout: 15_000 }, () => {
    setup([red], [], enMessages as typeof ptMessages);
    const en = enMessages.studio.image.styles;
    expect(screen.getByRole("region", { name: en.title })).toBeTruthy();
    expect(screen.getByRole("button", { name: en.edit.replace("{name}", "Vermelho") })).toBeTruthy();
  });
});
