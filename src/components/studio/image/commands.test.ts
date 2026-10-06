import { describe, expect, it, vi } from "vitest";

import { emptyImageDocument, newImageLayer, newShapeLayer, newTextLayer, type ImageDocument, type Layer } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

import { createImageCommands, type CommandDeps } from "./commands";
import { createEditorUiStore } from "./editor-state";

const canvas = { width: 1000, height: 1000 };

function setup(layers: Layer[] = [], deps: Partial<CommandDeps> = {}) {
  const doc: ImageDocument = { ...emptyImageDocument(canvas), layers };
  const store = createStudioStore(doc);
  const ui = createEditorUiStore();
  const requestJob = deps.requestJob ?? vi.fn();
  const naturalSize = deps.naturalSize ?? vi.fn().mockResolvedValue({ width: 200, height: 100 });
  const commands = createImageCommands(store, ui, { requestJob, naturalSize });
  return { store, ui, commands, requestJob, naturalSize };
}

const job = { id: "j1", kind: "cutout", status: "queued", referenceMediaIds: [], createdAt: "", updatedAt: "" } as const;

describe("jobs", () => {
  it("explains a refused job with its code and never fakes a result", async () => {
    const { ui, commands } = setup([], { requestJob: vi.fn().mockResolvedValue({ error: "busy", code: "too_many_jobs", status: 429 }) });
    await commands.startJob("cutout", { kind: "cutout", sourceMediaId: "m1" }, "l1");
    expect(ui.getState().jobs).toMatchObject([{ purpose: "cutout", layerId: "l1", error: "too_many_jobs", created: null }]);
  });

  it("keeps the created job so it can be followed", async () => {
    const { ui, commands, requestJob } = setup([], { requestJob: vi.fn().mockResolvedValue({ data: job }) });
    await commands.startJob("cutout", { kind: "cutout", sourceMediaId: "m1" }, "l1");
    expect(requestJob).toHaveBeenCalledWith({ kind: "cutout", sourceMediaId: "m1" });
    expect(ui.getState().jobs[0].created).toEqual(job);
  });

  it("swaps the asset of the source layer when the background removal finishes", async () => {
    const image = { ...newImageLayer("m1"), id: "l1", crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } };
    const { store, ui, commands } = setup([image], { requestJob: vi.fn().mockResolvedValue({ data: job }) });
    await commands.startJob("cutout", { kind: "cutout", sourceMediaId: "m1" }, "l1");
    await commands.jobDone(ui.getState().jobs[0].id, "m2");
    expect(store.getState().document.layers[0]).toMatchObject({ assetId: "m2", crop: image.crop, transform: image.transform });
    expect(ui.getState().jobs).toEqual([]);
  });

  it("places an edited image right above its source, fitted to the source box", async () => {
    const image = { ...newImageLayer("m1", { x: 0.3, y: 0.3, w: 0.4, h: 0.4, rotation: 0, opacity: 1 }), id: "l1" };
    const top = { ...newShapeLayer("rect"), id: "top" };
    const { store, ui, commands } = setup([image, top], { requestJob: vi.fn().mockResolvedValue({ data: job }) });
    await commands.startJob("edit", { kind: "image", model: "m", prompt: "p", aspect: "square", referenceMediaIds: ["m1"] }, "l1");
    await commands.jobDone(ui.getState().jobs[0].id, "m3");
    const layers = store.getState().document.layers;
    expect(layers.map((l) => l.assetId ?? l.id)).toEqual(["m1", "m3", "top"]);
    expect(layers[1].transform.x).toBe(0.3);
    expect(layers[1].transform.w).toBeCloseTo(0.4);
    expect(layers[1].transform.h).toBeCloseTo(0.2);
    expect(store.getState().selection).toEqual([layers[1].id]);
  });

  it("reports a result it cannot load instead of inserting a broken layer", async () => {
    const { store, ui, commands } = setup([], {
      requestJob: vi.fn().mockResolvedValue({ data: job }),
      naturalSize: vi.fn().mockRejectedValue(new Error("gone")),
    });
    await commands.startJob("generate", { kind: "image", model: "m", prompt: "p", aspect: "square" });
    await commands.jobDone(ui.getState().jobs[0].id, "m4");
    expect(store.getState().document.layers).toEqual([]);
    expect(ui.getState().jobs[0].error).toBe("result_unavailable");
  });
});

describe("editing", () => {
  it("removes a text layer left blank and keeps the edit as one undo step", () => {
    const text = { ...newTextLayer("Oi"), id: "t" };
    const { store, ui, commands } = setup([text]);
    commands.startTextEdit("t");
    expect(ui.getState().editingTextId).toBe("t");
    commands.finishTextEdit("t", " ");
    expect(store.getState().document.layers).toEqual([]);
    expect(ui.getState().editingTextId).toBeNull();
    commands.undo();
    expect(store.getState().document.layers).toEqual([text]);
  });

  it("crops through a session and cancels without touching the document", () => {
    const image = { ...newImageLayer("m1", { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }), id: "l1" };
    const { store, ui, commands } = setup([image]);
    commands.startCrop("l1");
    commands.updateCropBox({ left: 100, top: 0, width: 100, height: 200 });
    commands.cancelCrop();
    expect(store.getState().document.layers[0]).toBe(image);
    commands.startCrop("l1");
    commands.updateCropBox({ left: 100, top: 0, width: 100, height: 200 });
    commands.finishCrop();
    expect(store.getState().document.layers[0].crop).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
    expect(ui.getState().crop).toBeNull();
  });

  it("does not crop or edit locked layers", () => {
    const image = { ...newImageLayer("m1"), id: "l1", locked: true };
    const { ui, commands } = setup([image]);
    commands.startCrop("l1");
    expect(ui.getState().crop).toBeNull();
  });

  it("maps keyboard actions onto the selection", () => {
    const a = { ...newShapeLayer("rect"), id: "a" };
    const b = { ...newShapeLayer("rect"), id: "b" };
    const { store, commands } = setup([a, b]);
    commands.runAction({ type: "selectAll" });
    expect(store.getState().selection).toEqual(["a", "b"]);
    commands.runAction({ type: "nudge", dx: 10, dy: 0 });
    expect(store.getState().document.layers[0].transform.x).toBeCloseTo(0.51);
    commands.runAction({ type: "group" });
    expect(store.getState().document.layers[0].groupId).toBeDefined();
    commands.runAction({ type: "delete" });
    expect(store.getState().document.layers).toEqual([]);
    commands.runAction({ type: "undo" });
    expect(store.getState().document.layers).toHaveLength(2);
  });

  it("pastes copies on top and selects them", () => {
    const a = { ...newShapeLayer("rect"), id: "a" };
    const { store, commands } = setup([a]);
    commands.select(["a"]);
    commands.paste(commands.copySelection());
    const layers = store.getState().document.layers;
    expect(layers).toHaveLength(2);
    expect(store.getState().selection).toEqual([layers[1].id]);
  });

  it("refits the view after a resize while in fit mode", () => {
    const { store, ui, commands } = setup();
    ui.setState({ container: { width: 600, height: 600 }, fit: true });
    commands.resize({ width: 2000, height: 1000 });
    expect(store.getState().document.canvas).toMatchObject({ width: 2000, height: 1000 });
    expect(ui.getState().viewport.scale).toBeCloseTo((600 - 96) / 2000);
  });
});

describe("clipboard memory", () => {
  it("remembers the last copy and pastes it again", () => {
    const a = { ...newShapeLayer("rect"), id: "a" };
    const { store, ui, commands } = setup([a]);
    expect(ui.getState().clipboard).toBe(false);
    commands.select(["a"]);
    commands.copySelection();
    commands.select([]);
    commands.pasteCopied();
    commands.pasteCopied();
    expect(store.getState().document.layers).toHaveLength(3);
    expect(ui.getState().clipboard).toBe(true);
  });
});

describe("style and group commands", () => {
  it("copies the style of one layer and pastes it onto the selection as one step", () => {
    const a = { ...newShapeLayer("rect"), id: "a", fill: "#ff0000", blendMode: "multiply" as const };
    const b = { ...newShapeLayer("rect"), id: "b", fill: "#00ff00" };
    const { store, ui, commands } = setup([a, b]);
    commands.select(["a"]);
    expect(commands.copyStyle()).toBe(true);
    expect(ui.getState().styleCopied).toBe(true);
    commands.select(["b"]);
    commands.pasteStyle();
    expect(store.getState().document.layers[1]).toMatchObject({ fill: "#ff0000", blendMode: "multiply" });
    commands.undo();
    expect(store.getState().document.layers[1].fill).toBe("#00ff00");
  });

  it("moves, renames and dissolves groups", () => {
    const layers = [
      { ...newShapeLayer("rect"), id: "a", groupId: "g" },
      { ...newShapeLayer("rect"), id: "b", groupId: "g" },
      { ...newShapeLayer("rect"), id: "c" },
    ];
    const { store, commands } = setup(layers);
    commands.renameGroup("g", "Topo");
    expect(store.getState().document.groups).toEqual([{ id: "g", name: "Topo" }]);
    commands.moveItem({ kind: "layer", id: "c" }, 1, "g");
    expect(store.getState().document.layers.map((l) => [l.id, l.groupId])).toEqual([["a", "g"], ["c", "g"], ["b", "g"]]);
    commands.dissolveGroup("g");
    expect(store.getState().document.layers.every((l) => l.groupId === undefined)).toBe(true);
    expect(store.getState().document.groups).toBeUndefined();
  });

  it("sets and clears a canvas gradient", () => {
    const { store, commands } = setup();
    commands.setCanvasGradient({ from: "#000000", to: "#ffffff", angle: 90 });
    expect(store.getState().document.canvas.gradient).toEqual({ from: "#000000", to: "#ffffff", angle: 90 });
    commands.setCanvasGradient(undefined);
    expect(store.getState().document.canvas.gradient).toBeUndefined();
  });
});
