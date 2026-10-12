import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";
import { imageDocument, type Artboard, type ImageDocument, type Layer } from "@/lib/studio/document";
import { settleImage } from "@/lib/studio/image-settle";
import { createStudioStore } from "@/lib/studio/store";

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }), listLibraryAction: vi.fn().mockResolvedValue({ data: [] }), uploadMediaAction: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../trace/layer-raster", () => ({ layerRaster: vi.fn() }));
vi.mock("../../canvas/key-color", () => ({ assetKeyColor: vi.fn(), eyeDropper: () => null }));

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { ElementsPanel } from "../panels/elements-panel";
import { Inspector } from "./inspector";

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, rotation: 0, opacity: 1 });

const component: Artboard = {
  id: "cta",
  name: "Botão",
  component: true,
  x: 0,
  y: -300,
  canvas: { width: 400, height: 100, background: "" },
  layers: [
    { id: "pill", type: "shape", shape: "rect", name: "Fundo", fill: "#111111", transform: box(0.5, 0.5, 1, 1) },
    { id: "label", type: "text", name: "Rótulo", text: "Saiba mais", fontId: "inter", fontSize: 0.3, fill: "#ffffff", transform: box(0.5, 0.5, 0.8, 0.5) },
  ],
};

const instance: Layer = { id: "inst", type: "instance", componentId: "cta", transform: box(0.5, 0.8, 0.4, 0.1) };

function setup(doc: ImageDocument, selection: string[], messages: typeof ptMessages = ptMessages, artboardId = "post") {
  const store = createStudioStore(doc, { settle: settleImage });
  store.getState().select(selection);
  const ui = createEditorUiStore();
  ui.setState({ artboardId });
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn().mockResolvedValue({ width: 10, height: 10 }) });
  render(
    <NextIntlClientProvider locale={messages === ptMessages ? "pt" : "en"} messages={messages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>
          <Inspector />
          <ElementsPanel />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return { store, commands };
}

function host(layers: Layer[]): Artboard {
  return { id: "post", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers };
}

function instanceIn(store: ReturnType<typeof setup>["store"]): Layer | undefined {
  return store.getState().document.artboards.find((a) => a.id === "post")?.layers.find((l) => l.type === "instance");
}

describe("instance inspector", () => {
  it("overrides a part text, marks it and resets it", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([instance]), component]), ["inst"]);
    const t = ptMessages.studio.image.components.instance;
    expect(screen.getByRole("heading", { level: 2, name: ptMessages.studio.image.inspector.types.instance })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: t.title })).toBeTruthy();
    const text = screen.getByLabelText(t.text);
    fireEvent.change(text, { target: { value: "Compre agora" } });
    fireEvent.blur(text);
    expect(instanceIn(store)?.overrides).toEqual([{ layerId: "label", text: "Compre agora" }]);
    expect(screen.getByRole("img", { name: t.overridden })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.reset.replace("{name}", "Rótulo") }));
    expect(instanceIn(store)?.overrides).toBeUndefined();
  });

  it("hides a part only in this instance and detaches it into plain layers", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([instance]), component]), ["inst"]);
    const t = ptMessages.studio.image.components.instance;
    fireEvent.click(screen.getByRole("button", { name: t.hide.replace("{name}", "Fundo") }));
    expect(instanceIn(store)?.overrides).toEqual([{ layerId: "pill", hidden: true }]);
    fireEvent.click(screen.getByRole("button", { name: t.detach }));
    expect(instanceIn(store)).toBeUndefined();
    expect(store.getState().document.artboards[0].layers.map((l) => l.name)).toEqual(["Fundo", "Rótulo"]);
  });

  it("speaks English too", { timeout: 15_000 }, () => {
    setup(imageDocument([host([instance]), component]), ["inst"], enMessages as typeof ptMessages);
    const t = enMessages.studio.image.components.instance;
    expect(screen.getByRole("heading", { level: 2, name: enMessages.studio.image.inspector.types.instance })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: t.goTo }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: t.resetAll })).toBeTruthy();
  });
});

describe("components list and flag", () => {
  it("inserts an instance from the elements panel", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([]), component]), []);
    const t = ptMessages.studio.image.components;
    fireEvent.click(screen.getByRole("button", { name: t.insert.replace("{name}", "Botão") }));
    expect(instanceIn(store)).toMatchObject({ type: "instance", componentId: "cta", name: "Botão" });
  });

  it("turns the active artboard into a component and back, detaching its instances", { timeout: 15_000 }, () => {
    const { store } = setup(imageDocument([host([instance]), component]), [], ptMessages, "cta");
    const t = ptMessages.studio.image.components;
    const flag = within(screen.getByRole("region", { name: t.flag })).getByRole("switch", { name: t.flagLabel });
    fireEvent.click(flag);
    expect(store.getState().document.artboards.find((a) => a.id === "cta")?.component).toBeUndefined();
    expect(instanceIn(store)).toBeUndefined();
  });
});
