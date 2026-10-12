import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";
import { imageDocument, type ImageDocument, type Layer } from "@/lib/studio/document";
import { settleImage } from "@/lib/studio/image-settle";
import { createStudioStore } from "@/lib/studio/store";

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }), listLibraryAction: vi.fn().mockResolvedValue({ data: [] }), uploadMediaAction: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../trace/layer-raster", () => ({ layerRaster: vi.fn() }));
vi.mock("../../canvas/key-color", () => ({ assetKeyColor: vi.fn(), eyeDropper: () => null }));

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { Inspector } from "./inspector";

function px(x: number, y: number, w: number, h: number) {
  return { x: x / 1000, y: y / 1000, w: w / 1000, h: h / 1000, rotation: 0, opacity: 1 };
}

const card: Layer = { id: "card", type: "shape", shape: "rect", fill: "#ffffff", transform: px(500, 500, 400, 300) };
const title: Layer = { id: "title", type: "text", text: "Oferta", fontId: "inter", fontSize: 0.03, transform: px(500, 420, 300, 40) };
const button: Layer = { id: "button", type: "shape", shape: "rect", fill: "#e4003a", transform: px(500, 560, 200, 60) };

function setup(selection: string[], messages: typeof ptMessages = ptMessages, doc: ImageDocument = imageDocument([{ id: "board", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers: [card, title, button] }])) {
  const store = createStudioStore(doc, { settle: (before, after) => settleImage(before, after) });
  store.getState().select(selection);
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn().mockResolvedValue({ width: 10, height: 10 }) });
  const view = render(
    <NextIntlClientProvider locale={messages === ptMessages ? "pt" : "en"} messages={messages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>
          <Inspector />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return { store, view };
}

const t = ptMessages.studio.image.layout;

function layerIn(store: ReturnType<typeof setup>["store"], id: string): Layer {
  return store.getState().document.artboards[0].layers.find((l) => l.id === id)!;
}

describe("auto layout in the inspector", () => {
  it("adds a layout from a selection and edits its gap", { timeout: 15_000 }, () => {
    const { store } = setup(["card", "title", "button"]);
    fireEvent.click(within(screen.getByRole("region", { name: t.title })).getByRole("button", { name: t.add }));
    const group = store.getState().document.artboards[0].groups?.[0];
    expect(group).toMatchObject({ baseId: "card", layout: { direction: "vertical" } });
    const gap = within(screen.getByRole("region", { name: t.title })).getByRole("spinbutton", { name: t.gap });
    fireEvent.change(gap, { target: { value: "20" } });
    fireEvent.keyDown(gap, { key: "Enter" });
    expect(store.getState().document.artboards[0].groups?.[0].layout?.gap).toBe(20);
    expect(Math.round((layerIn(store, "button").transform.y - layerIn(store, "button").transform.h / 2) * 1000)).toBe(400 + 40 + 20);
  });

  it("fills a child and ignores the layout for another", { timeout: 15_000 }, () => {
    const first = setup(["card", "title", "button"]);
    fireEvent.click(within(screen.getByRole("region", { name: t.title })).getByRole("button", { name: t.add }));
    const laidOut = first.store.getState().document;
    first.view.unmount();
    const { store } = setup(["button"], ptMessages, laidOut);
    const section = screen.getByRole("region", { name: t.item.title });
    fireEvent.change(within(section).getByLabelText(t.item.width), { target: { value: "fill" } });
    expect(layerIn(store, "button").layoutItem).toEqual({ width: "fill" });
    expect(Math.round(layerIn(store, "button").transform.w * 1000)).toBe(300);
    fireEvent.click(within(section).getByRole("switch", { name: t.item.absolute }));
    expect(layerIn(store, "button").layoutItem).toEqual({ absolute: true });
  });

  it("speaks English too", { timeout: 15_000 }, () => {
    setup(["card", "title", "button"], enMessages as typeof ptMessages);
    const en = enMessages.studio.image.layout;
    expect(within(screen.getByRole("region", { name: en.title })).getByRole("button", { name: en.add })).toBeTruthy();
  });
});
