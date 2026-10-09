import { describe, expect, it, vi } from "vitest";

import { emptyImageDocument, newImageLayer, newShapeLayer, newTextLayer, type ImageDocument, type Layer } from "@/lib/studio/document";
import { createStudioStore, type StudioEditorStore } from "@/lib/studio/store";
import { traceRaster } from "@/lib/studio/trace/trace";

import { createImageCommands, type CommandDeps } from "./commands";
import { createEditorUiStore } from "./editor-state";

const canvas = { width: 1000, height: 1000 };

function board(store: StudioEditorStore<ImageDocument>, index = 0) {
  return store.getState().document.artboards[index];
}

function setup(layers: Layer[] = [], deps: Partial<CommandDeps> = {}) {
  const empty = emptyImageDocument(canvas);
  const doc: ImageDocument = { ...empty, artboards: [{ ...empty.artboards[0], id: "first", layers }] };
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
    expect(board(store).layers[0]).toMatchObject({ assetId: "m2", crop: image.crop, transform: image.transform });
    expect(ui.getState().jobs).toEqual([]);
  });

  it("places an edited image right above its source, fitted to the source box", async () => {
    const image = { ...newImageLayer("m1", { x: 0.3, y: 0.3, w: 0.4, h: 0.4, rotation: 0, opacity: 1 }), id: "l1" };
    const top = { ...newShapeLayer("rect"), id: "top" };
    const { store, ui, commands } = setup([image, top], { requestJob: vi.fn().mockResolvedValue({ data: job }) });
    await commands.startJob("edit", { kind: "image", model: "m", prompt: "p", aspect: "square", referenceMediaIds: ["m1"] }, "l1");
    await commands.jobDone(ui.getState().jobs[0].id, "m3");
    const layers = board(store).layers;
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
    expect(board(store).layers).toEqual([]);
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
    expect(board(store).layers).toEqual([]);
    expect(ui.getState().editingTextId).toBeNull();
    commands.undo();
    expect(board(store).layers).toEqual([text]);
  });

  it("crops through a session and cancels without touching the document", () => {
    const image = { ...newImageLayer("m1", { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }), id: "l1" };
    const { store, ui, commands } = setup([image]);
    commands.startCrop("l1");
    commands.updateCropBox({ left: 100, top: 0, width: 100, height: 200 });
    commands.cancelCrop();
    expect(board(store).layers[0]).toBe(image);
    commands.startCrop("l1");
    commands.updateCropBox({ left: 100, top: 0, width: 100, height: 200 });
    commands.finishCrop();
    expect(board(store).layers[0].crop).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
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
    expect(board(store).layers[0].transform.x).toBeCloseTo(0.51);
    commands.runAction({ type: "group" });
    expect(board(store).layers[0].groupId).toBeDefined();
    commands.runAction({ type: "delete" });
    expect(board(store).layers).toEqual([]);
    commands.runAction({ type: "undo" });
    expect(board(store).layers).toHaveLength(2);
  });

  it("pastes copies on top and selects them", () => {
    const a = { ...newShapeLayer("rect"), id: "a" };
    const { store, commands } = setup([a]);
    commands.select(["a"]);
    commands.paste(commands.copySelection());
    const layers = board(store).layers;
    expect(layers).toHaveLength(2);
    expect(store.getState().selection).toEqual([layers[1].id]);
  });

  it("refits the view after a resize while in fit mode", () => {
    const { store, ui, commands } = setup();
    ui.setState({ container: { width: 600, height: 600 }, fit: true });
    commands.resize({ width: 2000, height: 1000 });
    expect(board(store).canvas).toMatchObject({ width: 2000, height: 1000 });
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
    expect(board(store).layers).toHaveLength(3);
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
    expect(board(store).layers[1]).toMatchObject({ fill: "#ff0000", blendMode: "multiply" });
    commands.undo();
    expect(board(store).layers[1].fill).toBe("#00ff00");
  });

  it("moves, renames and dissolves groups", () => {
    const layers = [
      { ...newShapeLayer("rect"), id: "a", groupId: "g" },
      { ...newShapeLayer("rect"), id: "b", groupId: "g" },
      { ...newShapeLayer("rect"), id: "c" },
    ];
    const { store, commands } = setup(layers);
    commands.renameGroup("g", "Topo");
    expect(board(store).groups).toEqual([{ id: "g", name: "Topo" }]);
    commands.dropItem({ kind: "layer", id: "c" }, { kind: "layer", id: "a" }, "above");
    expect(board(store).layers.map((l) => [l.id, l.groupId])).toEqual([["a", "g"], ["c", "g"], ["b", "g"]]);
    commands.dissolveGroup("g");
    expect(board(store).layers.every((l) => l.groupId === undefined)).toBe(true);
    expect(board(store).groups).toBeUndefined();
  });

  it("sets and clears a canvas gradient", () => {
    const { store, commands } = setup();
    commands.setCanvasGradient({ from: "#000000", to: "#ffffff", angle: 90 });
    expect(board(store).canvas.gradient).toEqual({ from: "#000000", to: "#ffffff", angle: 90 });
    commands.setCanvasGradient(undefined);
    expect(board(store).canvas.gradient).toBeUndefined();
  });
});

describe("locks and families", () => {
  const family = () => [
    { ...newShapeLayer("rect"), id: "card", groupId: "s" },
    { ...newShapeLayer("rect"), id: "title", groupId: "s" },
    { ...newShapeLayer("rect"), id: "free" },
  ];

  function withFamily() {
    const kit = setup(family());
    const doc = kit.store.getState().document;
    kit.store.getState().reset({ ...doc, artboards: [{ ...doc.artboards[0], groups: [{ id: "s", baseId: "card" }] }] });
    return kit;
  }

  it("drops a layer from the selection the moment it is locked, and brings it back on undo", () => {
    const { store, commands } = setup(family());
    commands.select(["title", "free"]);
    commands.setLocked(["title"], true);
    expect(store.getState().selection).toEqual(["free"]);
    commands.undo();
    expect(store.getState().selection).toEqual(["title", "free"]);
    expect(board(store).layers[1].locked).toBeUndefined();
  });

  it("toggles the lock of the selection with its shortcut and leaves locked layers out of select all", () => {
    const { store, commands } = setup(family());
    commands.select(["free"]);
    commands.runAction({ type: "toggleLock" });
    expect(board(store).layers[2].locked).toBe(true);
    expect(store.getState().selection).toEqual([]);
    commands.selectAll();
    expect(store.getState().selection).toEqual(["card", "title"]);
  });

  it("walks from the parent to its children and back with Enter and Shift+Enter", () => {
    const { store, commands } = withFamily();
    commands.select(["card"]);
    commands.runAction({ type: "selectChildren" });
    expect(store.getState().selection).toEqual(["title"]);
    commands.runAction({ type: "selectParent" });
    expect(store.getState().selection).toEqual(["card"]);
  });

  it("builds a family from the selection and takes a child out of it again", () => {
    const { store, commands } = setup(family().map((l) => ({ ...l, groupId: undefined })));
    commands.select(["card", "free"]);
    commands.runAction({ type: "scaffold" });
    const doc = board(store);
    expect(doc.groups?.[0]?.baseId).toBe("card");
    expect(doc.layers.find((l) => l.id === "free")?.groupId).toBe(doc.groups?.[0]?.id);
    commands.select(["free"]);
    commands.runAction({ type: "ungroup" });
    expect(board(store).layers.find((l) => l.id === "free")?.groupId).toBeUndefined();
  });
});

describe("vector tools", () => {
  it("switches tools and leaves point editing when another tool starts", () => {
    const { ui, commands } = setup([{ ...newShapeLayer("rect"), id: "r" }]);
    commands.startPathEdit("r");
    expect(ui.getState().pathEditId).toBe("r");
    commands.setTool("pen");
    expect(ui.getState()).toMatchObject({ tool: "pen", pathEditId: null });
    commands.runAction({ type: "tool", tool: "select" });
    expect(ui.getState().tool).toBe("select");
  });

  it("turns a drawing into a selected path layer in one undoable step", () => {
    const { store, ui, commands } = setup();
    commands.setTool("pen");
    const id = commands.insertDrawnPath({ closed: true, nodes: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 200, y: 300 }] }, false);
    const layer = board(store).layers.find((l) => l.id === id);
    expect(layer).toMatchObject({ shape: "path", transform: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 } });
    expect(store.getState().selection).toEqual([id]);
    expect(ui.getState().tool).toBe("select");
    store.getState().undo();
    expect(board(store).layers).toHaveLength(0);
  });

  it("keeps the draw tool on for the next stroke", () => {
    const { ui, commands } = setup();
    commands.setTool("draw");
    commands.insertDrawnPath({ closed: false, nodes: [{ x: 0, y: 0 }, { x: 100, y: 50 }] }, true);
    expect(ui.getState().tool).toBe("draw");
  });

  it("converts a basic shape to a path before editing its points, and refuses locked layers", () => {
    const { store, ui, commands } = setup([{ ...newShapeLayer("ellipse"), id: "e" }, { ...newShapeLayer("rect"), id: "l", locked: true }, { ...newTextLayer("Oi"), id: "t" }]);
    commands.startPathEdit("e");
    expect(board(store).layers[0]).toMatchObject({ shape: "path" });
    expect(ui.getState().pathEditId).toBe("e");
    commands.finishPathEdit();
    commands.startPathEdit("l");
    commands.startPathEdit("t");
    expect(ui.getState().pathEditId).toBeNull();
  });

  it("converts several shapes to paths at once", () => {
    const { store, commands } = setup([{ ...newShapeLayer("rect"), id: "a" }, { ...newShapeLayer("star"), id: "b" }, { ...newShapeLayer("line"), id: "c" }]);
    commands.convertToPath(["a", "b", "c"]);
    expect(board(store).layers.map((l) => l.shape)).toEqual(["path", "path", "line"]);
  });
});

describe("svg", () => {
  const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ff0000"/><circle cx="50" cy="50" r="20" fill="#ffffff"/><text>x</text></svg>';

  it("imports an svg as one selected group in a single undo step", () => {
    const { store, commands } = setup();
    expect(commands.importSvg(logo, "logo")).toEqual({ ok: true, count: 2, skipped: 1 });
    const { selection } = store.getState();
    const document = board(store);
    expect(document.layers).toHaveLength(2);
    expect(document.groups?.[0]?.name).toBe("logo");
    expect(selection).toEqual(document.layers.map((l) => l.id));
    store.getState().undo();
    expect(board(store).layers).toHaveLength(0);
  });

  it("refuses a broken svg or one too big for the project and changes nothing", () => {
    const { store, commands } = setup();
    expect(commands.importSvg("<svg", "x")).toEqual({ ok: false, reason: "invalid" });
    const huge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${Array.from({ length: 9000 }, (_, i) => `<rect x="${i % 100}" y="${Math.floor(i / 100)}" width="1" height="1"/>`).join("")}</svg>`;
    expect(commands.importSvg(huge, "x")).toEqual({ ok: false, reason: "too_large" });
    expect(board(store).layers).toHaveLength(0);
  });

  it("copies the selected vectors as svg", () => {
    const { store, commands } = setup([{ ...newShapeLayer("rect"), id: "r" }, { ...newTextLayer("Oi"), id: "t" }]);
    store.getState().select(["t"]);
    expect(commands.selectionSvg()).toBeNull();
    store.getState().select(["r", "t"]);
    expect(commands.selectionSvg()).toContain("<path");
  });
});

describe("artboards", () => {
  it("adds an artboard to the right of the active one, selects it and makes it active", () => {
    const { store, ui, commands } = setup();
    const id = commands.addArtboard({ width: 1080, height: 1920 });
    expect(store.getState().document.artboards.map((a) => a.id)).toEqual(["first", id]);
    expect(board(store, 1)).toMatchObject({ x: 1100, y: 0, canvas: { width: 1080, height: 1920 } });
    expect(store.getState().selection).toEqual([id]);
    expect(ui.getState().artboardId).toBe(id);
  });

  it("puts new elements on the active artboard and follows the selection to another artboard", () => {
    const { store, ui, commands } = setup([{ ...newTextLayer("Oi"), id: "t" }]);
    const id = commands.addArtboard({ width: 500, height: 500 });
    commands.insert([{ ...newShapeLayer("rect"), id: "r" }]);
    expect(board(store, 1).layers.map((l) => l.id)).toEqual(["r"]);
    commands.select(["t"]);
    expect(ui.getState().artboardId).toBe("first");
    commands.selectAll();
    expect(store.getState().selection).toEqual(["t"]);
    commands.select([id]);
    expect(ui.getState().artboardId).toBe(id);
  });

  it("edits layers on the artboard that holds them, whichever artboard is active", () => {
    const { store, commands } = setup([{ ...newTextLayer("Oi"), id: "t" }]);
    commands.addArtboard({ width: 500, height: 500 });
    commands.setHidden(["t"], true);
    expect(board(store).layers[0].hidden).toBe(true);
    commands.rename("t", "Título");
    expect(board(store).layers[0].name).toBe("Título");
  });

  it("duplicates the selected artboards, also into another size, and deletes them but never the last one", () => {
    const { store, commands } = setup([{ ...newShapeLayer("rect"), id: "r" }]);
    commands.select(["first"]);
    commands.duplicate();
    const copy = board(store, 1);
    expect(copy.layers).toHaveLength(1);
    expect(copy.layers[0].id).not.toBe("r");
    expect(store.getState().selection).toEqual([copy.id]);
    const wide = commands.duplicateArtboards(["first"], { width: 1600, height: 900 });
    expect(store.getState().document.artboards.find((a) => a.id === wide[0])?.canvas).toMatchObject({ width: 1600, height: 900 });
    commands.select([copy.id, wide[0]]);
    commands.remove();
    expect(store.getState().document.artboards.map((a) => a.id)).toEqual(["first"]);
    commands.select(["first"]);
    commands.remove();
    expect(store.getState().document.artboards).toHaveLength(1);
  });

  it("renames, moves and resizes an artboard as single undo steps", () => {
    const { store, commands } = setup();
    commands.renameArtboard("first", "Feed");
    commands.moveArtboard("first", { x: 40, y: 80 });
    commands.resize({ width: 1080, height: 1350 });
    expect(board(store)).toMatchObject({ name: "Feed", x: 40, y: 80, canvas: { height: 1350 } });
    store.getState().undo();
    store.getState().undo();
    expect(board(store)).toMatchObject({ name: "Feed", x: 0, y: 0 });
  });

  it("moves layers dropped on another artboard there, keeping them selected", () => {
    const { store, commands } = setup([{ ...newShapeLayer("rect"), id: "r" }]);
    const id = commands.addArtboard({ width: 1000, height: 1000 });
    commands.select(["r"]);
    commands.moveLayersToArtboard(["r"], id);
    expect(board(store, 1).layers.map((l) => l.id)).toEqual(["r"]);
    expect(store.getState().selection).toEqual(["r"]);
  });

  it("fits every artboard in view", () => {
    const { ui, commands } = setup();
    ui.setState({ container: { width: 1000, height: 500 } });
    commands.addArtboard({ width: 1000, height: 1000 });
    commands.fit();
    const { viewport } = ui.getState();
    expect(viewport.scale).toBeCloseTo((500 - 96) / 1000, 3);
    expect(viewport.x).toBeGreaterThanOrEqual(0);
    expect(viewport.x + 2100 * viewport.scale).toBeLessThanOrEqual(1000);
  });
});

describe("image trace", () => {
  function raster(width: number, height: number) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const black = x >= 5 && x < 15 && y >= 5 && y < 15;
        data.set(black ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * width + x) * 4);
      }
    }
    return { width, height, data };
  }

  it("lays the traced shapes over the image, right above it, and hides the original in one step", () => {
    const photo = { ...newImageLayer("m-1", { x: 0.5, y: 0.5, w: 0.4, h: 0.4, rotation: 0, opacity: 1 }), id: "photo" };
    const title = { ...newTextLayer("Oi"), id: "title" };
    const { store, commands } = setup([photo, title]);
    const outcome = commands.placeTrace("photo", traceRaster(raster(20, 20), { mode: "bw", colors: 2, threshold: 128, detail: 0.5, noise: 4, ignoreWhite: true }));
    expect(outcome).toMatchObject({ ok: true, count: 1 });
    const layers = board(store).layers;
    expect(layers.map((l) => l.id).indexOf("title")).toBe(layers.length - 1);
    expect(layers[0]).toMatchObject({ id: "photo", hidden: true });
    expect(layers[1]).toMatchObject({ shape: "path", fill: "#000000" });
    expect(layers[1].transform.x).toBeCloseTo(0.5, 2);
    store.getState().undo();
    expect(board(store).layers.map((l) => l.id)).toEqual(["photo", "title"]);
  });

  it("says when there is nothing to trace and changes nothing", () => {
    const photo = { ...newImageLayer("m-1"), id: "photo" };
    const { store, commands } = setup([photo]);
    const blank = { width: 4, height: 4, data: new Uint8ClampedArray(64).fill(255) };
    expect(commands.placeTrace("photo", traceRaster(blank, { mode: "bw", colors: 2, threshold: 128, detail: 0.5, noise: 1, ignoreWhite: true }))).toEqual({ ok: false, reason: "empty" });
    expect(board(store).layers).toHaveLength(1);
  });
});
