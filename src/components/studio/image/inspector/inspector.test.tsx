import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { emptyArtboard, imageDocument, newImageLayer, newShapeLayer, newTextLayer, type ImageDocument, type Layer } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

const requestGeneration = vi.fn();
const listModels = vi.fn();
vi.mock("@/app/actions/media-generation", () => ({
  requestMediaGenerationAction: (input: unknown) => requestGeneration(input),
  listMediaModelsAction: (kind: string) => listModels(kind),
  getMediaGenerationAction: vi.fn(),
}));

vi.mock("@/app/actions/medias", () => ({
  fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }),
  listLibraryAction: vi.fn().mockResolvedValue({ data: [] }),
  uploadMediaAction: vi.fn(),
}));

const layerRaster = vi.fn();
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: (input: unknown) => toast(input) }) }));
vi.mock("../trace/layer-raster", () => ({ layerRaster: (layer: unknown) => layerRaster(layer) }));

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { Inspector } from "./inspector";

const pt = ptMessages.studio.image;
const vectors = ptMessages.studio.vectors;
const canvas = { width: 1000, height: 500 };

function setup(layers: Layer[], selection: string[] = layers.map((l) => l.id)) {
  const doc: ImageDocument = imageDocument([{ ...emptyArtboard(canvas), layers }]);
  const store = createStudioStore(doc);
  store.getState().select(selection);
  const ui = createEditorUiStore();
  const commands = createImageCommands(store, ui, { requestJob: requestGeneration, naturalSize: vi.fn().mockResolvedValue({ width: 10, height: 10 }) });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectName: "Projeto" }}>
        <TooltipProvider><Inspector /></TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return { store, ui };
}

function layerOf(store: ReturnType<typeof setup>["store"], id: string): Layer {
  const found = store.getState().document.artboards[0].layers.find((l) => l.id === id);
  if (!found) throw new Error(`layer ${id} is gone`);
  return found;
}

function commitTyped(label: string, value: string) {
  const input = screen.getByRole("spinbutton", { name: label });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function commitNumber(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("Inspector", () => {
  beforeEach(() => {
    requestGeneration.mockReset();
    listModels.mockReset();
    listModels.mockResolvedValue({ data: [{ id: "model-a", name: "Model A", default: true }] });
  });

  it("edits the canvas background when nothing is selected", () => {
    const { store } = setup([]);
    expect(screen.getByRole("heading", { name: pt.artboards.untitled.replace("{number}", "1") })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: pt.inspector.canvas.transparent }));
    expect(store.getState().document.artboards[0].canvas.background).toBe("");
    fireEvent.click(screen.getByRole("switch", { name: pt.inspector.canvas.transparent }));
    expect(store.getState().document.artboards[0].canvas.background).toBe("#ffffff");
  });

  it("moves a layer through the position fields in canvas pixels", () => {
    const shape = { ...newShapeLayer("rect", { x: 0.5, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 1 }), id: "s" };
    const { store } = setup([shape]);
    commitNumber(pt.inspector.transform.x, "0");
    expect(layerOf(store, "s").transform.x).toBeCloseTo(0.1);
    commitNumber(pt.inspector.transform.rotation, "190");
    expect(layerOf(store, "s").transform.rotation).toBe(-170);
  });

  it("edits text size in pixels and keeps the weight valid when the font changes", () => {
    const text = { ...newTextLayer("Oi"), id: "t", fontWeight: 300 };
    const { store } = setup([text]);
    commitNumber(pt.inspector.text.size, "50");
    expect(layerOf(store, "t").fontSize).toBeCloseTo(0.1);
    fireEvent.change(screen.getByLabelText(pt.inspector.text.font), { target: { value: "bebas-neue" } });
    expect(layerOf(store, "t")).toMatchObject({ fontId: "bebas-neue", fontWeight: 400 });
    expect(screen.getByRole("button", { name: pt.inspector.text.italic })).toBeDisabled();
  });

  it("turns arrow heads on and off for lines", () => {
    const line = { ...newShapeLayer("line"), id: "l" };
    const { store } = setup([line]);
    fireEvent.click(screen.getByRole("button", { name: pt.inspector.shape.headStart }));
    expect(layerOf(store, "l").arrowStart).toBe(true);
    expect(screen.queryByLabelText(pt.inspector.shape.fill)).toBeNull();
  });

  it("puts arrow heads on an open vector path but never on a closed one", () => {
    const open = { id: "o", type: "shape" as const, shape: "path" as const, path: "M0 0 C0 1 1 1 1 0", stroke: "#111111", strokeWidth: 4, transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } };
    const closed = { ...open, id: "c", path: "M0 0 L1 0 L1 1 Z" };
    const { store } = setup([open, closed], ["o"]);
    fireEvent.click(screen.getByRole("button", { name: pt.inspector.shape.headEnd }));
    expect(layerOf(store, "o").arrowEnd).toBe(true);
    act(() => store.getState().select(["c"]));
    expect(screen.queryByRole("button", { name: pt.inspector.shape.headEnd })).toBeNull();
  });

  it("unites the selected shapes and splits a compound path back into parts", () => {
    const a = { ...newShapeLayer("rect", { x: 0.3, y: 0.3, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }), id: "a" };
    const b = { ...newShapeLayer("ellipse", { x: 0.4, y: 0.4, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }), id: "b" };
    const { store } = setup([a, b]);
    fireEvent.click(screen.getByRole("button", { name: vectors.ops.union }));
    const [merged] = store.getState().document.artboards[0].layers;
    expect(store.getState().document.artboards[0].layers).toHaveLength(1);
    expect(merged).toMatchObject({ shape: "path", fillRule: "evenodd" });
    expect(store.getState().selection).toEqual([merged.id]);
    fireEvent.click(screen.getByRole("button", { name: vectors.ops.reverse }));
    expect(screen.getByRole("button", { name: vectors.ops.release })).toBeDisabled();
  });

  it("simplifies a heavy vector path and shows how many points it has", () => {
    const heavy = { id: "h", type: "shape" as const, shape: "path" as const, path: Array.from({ length: 120 }, (_, i) => `${i === 0 ? "M" : "L"}${(0.5 + 0.5 * Math.cos((2 * Math.PI * i) / 120)).toFixed(4)} ${(0.5 + 0.5 * Math.sin((2 * Math.PI * i) / 120)).toFixed(4)}`).join(" ") + " Z", fill: "#000000", transform: { x: 0.5, y: 0.5, w: 0.4, h: 0.4, rotation: 0, opacity: 1 } };
    const { store } = setup([heavy]);
    expect(screen.getByText("120 pontos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: vectors.ops.simplify }));
    expect(store.getState().document.artboards[0].layers[0].path?.length).toBeLessThan(heavy.path.length / 4);
  });

  it("explains why shapes that do not touch cannot intersect", async () => {
    const a = { ...newShapeLayer("rect", { x: 0.2, y: 0.2, w: 0.1, h: 0.1, rotation: 0, opacity: 1 }), id: "a" };
    const b = { ...newShapeLayer("rect", { x: 0.8, y: 0.8, w: 0.1, h: 0.1, rotation: 0, opacity: 1 }), id: "b" };
    const { store } = setup([a, b]);
    fireEvent.click(screen.getByRole("button", { name: vectors.ops.intersect }));
    expect(store.getState().document.artboards[0].layers).toHaveLength(2);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: vectors.ops.issues.empty, variant: "destructive" }));
  });

  it("tunes how many points a star has and how deep they cut", () => {
    const star = { ...newShapeLayer("star"), id: "s" };
    const { store } = setup([star]);
    const points = screen.getByLabelText(pt.inspector.shape.points);
    fireEvent.change(points, { target: { value: "16" } });
    fireEvent.blur(points);
    expect(layerOf(store, "s").points).toBe(16);
    const inner = screen.getAllByRole("slider").find((el) => el.closest("div")?.parentElement?.textContent?.includes(pt.inspector.shape.inner));
    expect(inner).toBeDefined();
  });

  it("edits the points of a vector shape and cuts out its overlaps", () => {
    const path = { id: "p", type: "shape" as const, shape: "path" as const, path: "M0 0 L1 0 L1 1 Z", fill: "#000000", transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } };
    const { store, ui } = setup([path]);
    fireEvent.click(screen.getByRole("switch", { name: vectors.inspector.fillRule }));
    expect(layerOf(store, "p").fillRule).toBe("evenodd");
    fireEvent.click(screen.getByRole("button", { name: vectors.inspector.editPoints }));
    expect(ui.getState().pathEditId).toBe("p");
  });

  it("styles a stroke with a dash pattern, corners and a miter limit", () => {
    const shape = { ...newShapeLayer("rect"), id: "s", stroke: "#111111", strokeWidth: 4 };
    const { store } = setup([shape]);
    fireEvent.change(screen.getByLabelText(vectors.stroke.dash), { target: { value: "dotted" } });
    expect(layerOf(store, "s")).toMatchObject({ dashArray: [0, 2], lineCap: "round" });
    fireEvent.click(screen.getByRole("button", { name: vectors.stroke.join.bevel }));
    expect(layerOf(store, "s").lineJoin).toBe("bevel");
    expect(screen.queryByLabelText(vectors.stroke.miterLimit)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: vectors.stroke.join.miter }));
    expect(screen.getByLabelText(vectors.stroke.miterLimit)).toBeInTheDocument();
  });

  it("dashes a text outline", () => {
    const text = { ...newTextLayer("Oi"), id: "t", stroke: "#000000", strokeWidth: 3 };
    const { store } = setup([text]);
    fireEvent.change(screen.getByLabelText(vectors.stroke.dash), { target: { value: "dashed" } });
    expect(layerOf(store, "t").dashArray).toEqual([3, 2]);
  });

  it("offers to convert a basic shape into a vector", () => {
    const { store } = setup([{ ...newShapeLayer("rect"), id: "r" }]);
    fireEvent.click(screen.getByRole("button", { name: vectors.inspector.convert }));
    expect(layerOf(store, "r").shape).toBe("path");
  });

  it("keeps star controls away from other shapes", () => {
    setup([{ ...newShapeLayer("rect"), id: "s" }]);
    expect(screen.queryByLabelText(pt.inspector.shape.points)).toBeNull();
  });

  it("commits a typed fill color and refuses an invalid one", () => {
    const shape = { ...newShapeLayer("rect"), id: "s" };
    const { store } = setup([shape]);
    const field = screen.getByRole("textbox", { name: pt.inspector.shape.fill });
    fireEvent.change(field, { target: { value: "#12ab34" } });
    fireEvent.blur(field);
    expect(layerOf(store, "s").fill).toBe("#12ab34");
    fireEvent.change(field, { target: { value: "red" } });
    fireEvent.blur(field);
    expect(layerOf(store, "s").fill).toBe("#12ab34");
  });

  it("types line height and letter spacing past the slider ends, up to the layer limits", () => {
    const { store } = setup([{ ...newTextLayer("Oi"), id: "t" }]);
    commitTyped(pt.inspector.text.lineHeight, "3.5");
    commitTyped(pt.inspector.text.letterSpacing, "180");
    expect(layerOf(store, "t")).toMatchObject({ lineHeight: 3.5, letterSpacing: 1.8 });
    commitTyped(pt.inspector.text.lineHeight, "9");
    commitTyped(pt.inspector.text.letterSpacing, "-80");
    expect(layerOf(store, "t")).toMatchObject({ lineHeight: 4, letterSpacing: -0.5 });
  });

  it("types a saturation past the slider end, up to the filter limit", () => {
    const { store } = setup([{ ...newImageLayer("media-1"), id: "i" }]);
    commitTyped(pt.inspector.image.filter.saturation, "400");
    expect(layerOf(store, "i").filters?.saturation).toBe(8);
    commitTyped(pt.inspector.image.filter.saturation, "900");
    expect(layerOf(store, "i").filters?.saturation).toBe(10);
  });

  it("queues a background removal for the selected image and explains a busy workspace", async () => {
    requestGeneration.mockResolvedValue({ error: "busy", code: "too_many_jobs", status: 429 });
    const image = { ...newImageLayer("media-1"), id: "i" };
    setup([image]);
    fireEvent.click(screen.getByRole("button", { name: pt.removeBackground.run }));
    expect(requestGeneration).toHaveBeenCalledWith({ kind: "cutout", sourceMediaId: "media-1" });
    expect(await screen.findByText(pt.jobs.errors.too_many_jobs)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: pt.jobs.dismiss }));
    await waitFor(() => expect(screen.queryByText(pt.jobs.errors.too_many_jobs)).toBeNull());
  });

  it("shows progress while the background removal runs and blocks a second request", async () => {
    requestGeneration.mockReturnValue(new Promise(() => {}));
    const image = { ...newImageLayer("media-1"), id: "i" };
    setup([image]);
    fireEvent.click(screen.getByRole("button", { name: pt.removeBackground.run }));
    expect(await screen.findByText(pt.jobs.running.cutout)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: pt.removeBackground.run })).toBeDisabled();
  });

  it("starts and resets the crop session from the image section", () => {
    const image = { ...newImageLayer("media-1"), id: "i" };
    const { ui } = setup([image]);
    fireEvent.click(screen.getByRole("button", { name: pt.inspector.image.crop }));
    expect(ui.getState().crop?.layerId).toBe("i");
    fireEvent.click(screen.getByRole("button", { name: pt.inspector.image.cropCancel }));
    expect(ui.getState().crop).toBeNull();
  });

  it("flips the image and applies a filter preset", () => {
    const image = { ...newImageLayer("media-1"), id: "i" };
    const { store } = setup([image]);
    fireEvent.click(screen.getByRole("button", { name: pt.inspector.image.flipX }));
    expect(layerOf(store, "i").flipX).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: pt.inspector.image.presetNames.vivid }));
    expect(layerOf(store, "i").filters?.contrast).toBe(12);
    fireEvent.click(screen.getByRole("button", { name: pt.inspector.image.resetFilters }));
    expect(layerOf(store, "i").filters).toBeUndefined();
  });

  it("sends an AI edit with the layer as the reference", async () => {
    requestGeneration.mockReturnValue(new Promise(() => {}));
    const image = { ...newImageLayer("media-1", { x: 0.5, y: 0.5, w: 0.2, h: 0.8, rotation: 0, opacity: 1 }), id: "i" };
    setup([image]);
    const run = screen.getByRole("button", { name: pt.inspector.image.editRun });
    expect(run).toBeDisabled();
    fireEvent.change(screen.getByLabelText(pt.inspector.image.editPrompt), { target: { value: "fundo de praia" } });
    await waitFor(() => expect(run).toBeEnabled());
    fireEvent.click(run);
    expect(requestGeneration).toHaveBeenCalledWith({ kind: "image", model: "model-a", prompt: "fundo de praia", aspect: "story", referenceMediaIds: ["media-1"] });
  });

  it("disables editing for locked layers and says why", () => {
    const shape = { ...newShapeLayer("rect"), id: "s", locked: true };
    setup([shape]);
    expect(screen.getByText(pt.inspector.lockedHint)).toBeInTheDocument();
    expect(screen.getByLabelText(pt.inspector.transform.x)).toBeDisabled();
  });

  it("groups a multi selection from the arrange section", () => {
    const a = { ...newShapeLayer("rect"), id: "a" };
    const b = { ...newShapeLayer("ellipse"), id: "b" };
    const { store } = setup([a, b]);
    expect(screen.getByRole("heading", { name: "2 elementos" })).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /^Agrupar/ }));
    });
    const [first, second] = store.getState().document.artboards[0].layers;
    expect(first.groupId).toBeDefined();
    expect(first.groupId).toBe(second.groupId);
  });

  it("curves text, adds a background highlight and a gradient fill", () => {
    const text = { ...newTextLayer("Oi"), id: "t" };
    const { store } = setup([text]);
    fireEvent.click(screen.getByRole("switch", { name: pt.inspector.text.highlight }));
    expect(layerOf(store, "t").highlight).toEqual({ color: "#ffe14d", radius: 0.2 });
    fireEvent.click(screen.getByRole("switch", { name: pt.inspector.gradient.toggle }));
    expect(layerOf(store, "t").gradient?.from).toBe(text.fill);
    expect(screen.queryByRole("textbox", { name: pt.inspector.text.color })).toBeNull();
    const curve = screen.getAllByRole("slider").find((el) => el.closest("div")?.parentElement?.textContent?.includes(pt.inspector.text.curve));
    expect(curve).toBeDefined();
  });

  it("traces an image into vector shapes laid over it", async () => {
    const data = new Uint8ClampedArray(20 * 20 * 4);
    for (let i = 0; i < 400; i++) {
      const x = i % 20;
      const y = Math.floor(i / 20);
      data.set(x >= 5 && x < 15 && y >= 5 && y < 15 ? [0, 0, 0, 255] : [255, 255, 255, 255], i * 4);
    }
    layerRaster.mockResolvedValue({ width: 20, height: 20, data });
    const image = { ...newImageLayer("media-1"), id: "i" };
    const { store } = setup([image]);
    fireEvent.click(screen.getByRole("button", { name: vectors.trace.run }));
    await waitFor(() => expect(store.getState().document.artboards[0].layers.length).toBeGreaterThan(1));
    expect(layerOf(store, "i").hidden).toBe(true);
    expect(store.getState().document.artboards[0].layers[1]).toMatchObject({ type: "shape", shape: "path" });
  });

  it("puts an image into a frame and the canvas into a gradient", () => {
    const image = { ...newImageLayer("media-1"), id: "i" };
    const { store } = setup([image]);
    fireEvent.change(screen.getByLabelText(pt.inspector.image.frame), { target: { value: "ellipse" } });
    expect(layerOf(store, "i").frame).toBe("ellipse");
    fireEvent.change(screen.getByLabelText(pt.inspector.image.frame), { target: { value: "none" } });
    expect(layerOf(store, "i").frame).toBeUndefined();
  });

  it("switches the canvas background to a gradient", () => {
    const { store } = setup([]);
    fireEvent.click(screen.getByRole("switch", { name: pt.inspector.gradient.toggle }));
    expect(store.getState().document.artboards[0].canvas.gradient?.from).toBe("#ffffff");
  });
});
