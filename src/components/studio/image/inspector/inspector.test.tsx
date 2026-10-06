import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { emptyImageDocument, newImageLayer, newShapeLayer, newTextLayer, type ImageDocument, type Layer } from "@/lib/studio/document";
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

import { createImageCommands } from "../commands";
import { createEditorUiStore, ImageEditorContext } from "../editor-state";
import { Inspector } from "./inspector";

const pt = ptMessages.studio.image;
const canvas = { width: 1000, height: 500 };

function setup(layers: Layer[], selection: string[] = layers.map((l) => l.id)) {
  const doc: ImageDocument = { ...emptyImageDocument(canvas), layers };
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
  const found = store.getState().document.layers.find((l) => l.id === id);
  if (!found) throw new Error(`layer ${id} is gone`);
  return found;
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
    expect(screen.getByRole("heading", { name: pt.inspector.canvasTitle })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: pt.inspector.canvas.transparent }));
    expect(store.getState().document.canvas.background).toBe("");
    fireEvent.click(screen.getByRole("switch", { name: pt.inspector.canvas.transparent }));
    expect(store.getState().document.canvas.background).toBe("#ffffff");
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
    const [first, second] = store.getState().document.layers;
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
    expect(store.getState().document.canvas.gradient?.from).toBe("#ffffff");
  });
});
