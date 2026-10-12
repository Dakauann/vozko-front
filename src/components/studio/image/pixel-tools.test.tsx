import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { emptyArtboard, imageDocument, newImageLayer, newTextLayer, type ImageDocument, type Layer } from "@/lib/studio/document";
import { newPaintLayer } from "@/lib/studio/pixel-surface";
import { createStudioStore } from "@/lib/studio/store";

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({ fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }), listLibraryAction: vi.fn().mockResolvedValue({ data: [] }), uploadMediaAction: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { PixelOverlay } from "./canvas/pixel-overlay";
import { createImageCommands } from "./commands";
import { bindEditorKeys } from "./editor-keys";
import { createEditorUiStore, ImageEditorContext } from "./editor-state";
import { Inspector } from "./inspector/inspector";
import { PixelOptions, PixelToolButtons } from "./pixel-toolbar";

const pt = ptMessages.studio.image.pixels;
const canvas = { width: 400, height: 200 };
const flat = { scale: 1, x: 0, y: 0 };
const UI = { timeout: 15_000 };

let unbind: (() => void) | null = null;

afterEach(() => {
  unbind?.();
  unbind = null;
});

function setup(layers: Layer[], selection: string[] = []) {
  const doc: ImageDocument = imageDocument([{ ...emptyArtboard(canvas), id: "a", layers }]);
  const store = createStudioStore(doc);
  store.getState().select(selection);
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn().mockResolvedValue({ width: 10, height: 10 }) });
  unbind = bindEditorKeys(window, { commands, ui, onShapeOp: vi.fn() });
  const Overlay = () => {
    const document = store.getState().document;
    return <PixelOverlay viewport={flat} document={document} active={document.artboards[0]} />;
  };
  const view = render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p", projectName: "Projeto" }}>
        <TooltipProvider>
          <PixelToolButtons />
          <PixelOptions />
          <div data-testid="stage">
            <Overlay />
          </div>
          <Inspector />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return { store, ui, view };
}

function board(store: ReturnType<typeof setup>["store"]) {
  return store.getState().document.artboards[0];
}

function surfaceOf(): SVGSVGElement {
  return document.querySelector("svg[data-pixel-tool]") as SVGSVGElement;
}

function drag(points: [number, number][]) {
  const svg = surfaceOf();
  const [first, ...rest] = points;
  fireEvent.pointerDown(svg, { clientX: first[0], clientY: first[1], pointerId: 1, button: 0, pressure: 0.5 });
  for (const [x, y] of rest) fireEvent.pointerMove(svg, { clientX: x, clientY: y, pointerId: 1, pressure: 0.5 });
  const last = points.at(-1)!;
  fireEvent.pointerUp(svg, { clientX: last[0], clientY: last[1], pointerId: 1, button: 0 });
}

describe("pixel tools by hand", () => {
  it("paints one stroke as one undo step on the selected paint layer", UI, () => {
    const { store, ui } = setup([{ ...newPaintLayer(canvas), id: "ink" }], ["ink"]);
    fireEvent.click(screen.getByRole("button", { name: `${pt.tools.brush} (B)` }));
    expect(ui.getState().pixelTool).toBe("brush");
    expect(screen.getByRole("toolbar", { name: pt.options.label })).toBeTruthy();
    const svg = surfaceOf();
    fireEvent.pointerDown(svg, { clientX: 20, clientY: 20, pointerId: 1, button: 0 });
    fireEvent.pointerMove(svg, { clientX: 60, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 60, pointerId: 1 });
    expect(ui.getState().pixelLive).toMatchObject({ layerId: "ink", kind: "paint" });
    expect(document.querySelector("[data-brush-ring]")).not.toBeNull();
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 60, pointerId: 1, button: 0 });
    expect(ui.getState().pixelLive).toBeNull();
    const ops = board(store).layers[0].surface!.ops;
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: "stroke", mode: "paint", color: "#111111", size: 24 });
    act(() => store.getState().undo());
    expect(board(store).layers[0].surface!.ops).toHaveLength(0);
  });

  it("creates a paint layer for the first stroke when nothing holds paint", UI, () => {
    const { store } = setup([{ ...newTextLayer("Oi"), id: "t" }]);
    fireEvent.keyDown(window, { key: "b" });
    drag([[10, 10], [50, 50], [90, 20]]);
    const layers = board(store).layers;
    expect(layers.map((l) => l.type)).toEqual(["text", "paint"]);
    expect(layers[1].surface!.ops).toHaveLength(1);
    expect(store.getState().selection).toEqual([layers[1].id]);
  });

  it("changes the brush from the options bar and the keyboard", UI, () => {
    const { ui } = setup([{ ...newPaintLayer(canvas), id: "ink" }], ["ink"]);
    fireEvent.keyDown(window, { key: "b" });
    const size = screen.getByLabelText(pt.options.size);
    fireEvent.change(size, { target: { value: "60" } });
    fireEvent.keyDown(size, { key: "Enter" });
    expect(ui.getState().brush.size).toBe(60);
    fireEvent.keyDown(window, { key: "]", code: "BracketRight" });
    expect(ui.getState().brush.size).toBe(70);
    fireEvent.keyDown(window, { key: "3", code: "Digit3" });
    expect(ui.getState().brush.opacity).toBe(0.3);
    fireEvent.keyDown(window, { key: "{", code: "BracketLeft", shiftKey: true });
    expect(ui.getState().brush.hardness).toBeCloseTo(0.7, 6);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(ui.getState().pixelTool).toBeNull();
  });

  it("hides and restores parts of a photo with the eraser", UI, () => {
    const { store, ui } = setup([{ ...newImageLayer("asset", { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }), id: "photo" }], ["photo"]);
    fireEvent.keyDown(window, { key: "e" });
    expect(screen.getByRole("button", { name: `${pt.options.hide} (X)` })).toBeTruthy();
    drag([[10, 10], [60, 10]]);
    fireEvent.keyDown(window, { key: "x" });
    expect(ui.getState().brush.restore).toBe(true);
    drag([[10, 10], [30, 10]]);
    expect(board(store).layers[0].mask!.ops.map((op) => op.mode)).toEqual(["hide", "reveal"]);
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.cutout }));
    expect(screen.getByRole("button", { name: pt.inspector.removeMask })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: pt.inspector.removeMask }));
    expect(board(store).layers[0].mask).toBeUndefined();
  });

  it("refuses to erase a layer without pixels and says why", UI, () => {
    const { store } = setup([{ ...newTextLayer("Oi"), id: "t" }], ["t"]);
    fireEvent.keyDown(window, { key: "e" });
    drag([[10, 10], [60, 10]]);
    expect(screen.getByRole("status").textContent).toBe(pt.refusals.no_pixels);
    expect(board(store).layers).toHaveLength(1);
  });

  it("selects an area, erases inside it, copies it and deselects", UI, () => {
    const { store, ui } = setup([{ ...newPaintLayer(canvas), id: "ink" }], ["ink"]);
    fireEvent.keyDown(window, { key: "m" });
    drag([[20, 20], [120, 80]]);
    expect(ui.getState().pixelSelection).toMatchObject({ artboardId: "a", parts: [{ mode: "add", points: [20, 20, 120, 20, 120, 80, 20, 80] }] });
    expect(document.querySelector("[data-pixel-selection]")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(board(store).layers[0].surface!.ops[0]).toMatchObject({ kind: "area", mode: "erase" });
    expect(board(store).layers).toHaveLength(1);
    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    expect(board(store).layers).toHaveLength(2);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(ui.getState().pixelSelection).toBeNull();
  });

  it("adds with Shift, subtracts with Alt, inverts and fills from the options bar", UI, () => {
    const { store, ui } = setup([{ ...newPaintLayer(canvas), id: "ink" }], ["ink"]);
    fireEvent.keyDown(window, { key: "M", shiftKey: true });
    drag([[20, 20], [120, 80]]);
    const svg = surfaceOf();
    fireEvent.pointerDown(svg, { clientX: 150, clientY: 20, pointerId: 1, button: 0, shiftKey: true });
    fireEvent.pointerMove(svg, { clientX: 200, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 200, clientY: 60, pointerId: 1, button: 0 });
    fireEvent.pointerDown(svg, { clientX: 30, clientY: 30, pointerId: 1, button: 0, altKey: true });
    fireEvent.pointerMove(svg, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 40, clientY: 40, pointerId: 1, button: 0 });
    expect(ui.getState().pixelSelection!.parts.map((p) => p.mode)).toEqual(["add", "add", "subtract"]);
    fireEvent.click(screen.getByRole("button", { name: `${pt.options.invert} (Ctrl+Shift+I)` }));
    expect(ui.getState().pixelSelection!.invert).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: pt.options.fill }));
    expect(board(store).layers[0].surface!.ops[0]).toMatchObject({ kind: "area", mode: "paint", invert: true, parts: [{}, {}, { mode: "subtract" }] });
  });

  it("keeps the vector pencil on Shift+P now that B is the brush", UI, () => {
    const { ui } = setup([]);
    fireEvent.keyDown(window, { key: "P", shiftKey: true });
    expect(ui.getState().tool).toBe("draw");
    fireEvent.keyDown(window, { key: "b" });
    expect(ui.getState()).toMatchObject({ tool: "select", pixelTool: "brush" });
  });
});
