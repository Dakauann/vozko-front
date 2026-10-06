import { describe, expect, it } from "vitest";

import { emptyImageDocument, type ImageDocument, type Layer } from "./document";
import { addLayers, translateLayers } from "./layers";
import { createStudioStore, HISTORY_LIMIT } from "./store";

function rect(id: string): Layer {
  return { id, type: "shape", shape: "rect", fill: "#000000", transform: { x: 0.5, y: 0.5, w: 0.1, h: 0.1, rotation: 0, opacity: 1 } };
}

function store() {
  return createStudioStore<ImageDocument>(emptyImageDocument({ width: 1000, height: 1000 }));
}

describe("studio editor store", () => {
  it("applies operations and undoes and redoes them", () => {
    const s = store();
    s.getState().apply((d) => addLayers(d, [rect("a")]), ["a"]);
    s.getState().update((draft) => {
      draft.layers[0].fill = "#ff0000";
    });
    expect(s.getState().document.layers[0].fill).toBe("#ff0000");
    expect(s.getState().selection).toEqual(["a"]);
    s.getState().undo();
    expect(s.getState().document.layers[0].fill).toBe("#000000");
    s.getState().undo();
    expect(s.getState().document.layers).toEqual([]);
    expect(s.getState().selection).toEqual([]);
    expect(s.getState().canUndo).toBe(false);
    s.getState().redo();
    expect(s.getState().document.layers.map((l) => l.id)).toEqual(["a"]);
    expect(s.getState().selection).toEqual(["a"]);
    expect(s.getState().canRedo).toBe(true);
  });

  it("ignores operations that change nothing", () => {
    const s = store();
    s.getState().apply((d) => d);
    s.getState().update(() => {});
    expect(s.getState().canUndo).toBe(false);
    expect(s.getState().revision).toBe(0);
  });

  it("drops the redo branch after a new change", () => {
    const s = store();
    s.getState().apply((d) => addLayers(d, [rect("a")]));
    s.getState().undo();
    s.getState().apply((d) => addLayers(d, [rect("b")]));
    expect(s.getState().canRedo).toBe(false);
  });

  it("coalesces a gesture into one undo step", () => {
    const s = store();
    s.getState().apply((d) => addLayers(d, [rect("a")]));
    s.getState().beginTransaction();
    for (let i = 0; i < 10; i++) s.getState().apply((d) => translateLayers(d, ["a"], 0.01, 0));
    s.getState().commitTransaction();
    expect(s.getState().document.layers[0].transform.x).toBeCloseTo(0.6);
    s.getState().undo();
    expect(s.getState().document.layers[0].transform.x).toBe(0.5);
    s.getState().redo();
    expect(s.getState().document.layers[0].transform.x).toBeCloseTo(0.6);
  });

  it("cancels a gesture back to where it started", () => {
    const s = store();
    s.getState().apply((d) => addLayers(d, [rect("a")]));
    s.getState().beginTransaction();
    s.getState().apply((d) => translateLayers(d, ["a"], 0.2, 0));
    s.getState().cancelTransaction();
    expect(s.getState().document.layers[0].transform.x).toBe(0.5);
    s.getState().undo();
    expect(s.getState().document.layers).toEqual([]);
  });

  it("does not record an empty gesture", () => {
    const s = store();
    s.getState().beginTransaction();
    s.getState().commitTransaction();
    expect(s.getState().canUndo).toBe(false);
  });

  it("keeps at most the history limit", () => {
    const s = store();
    s.getState().apply((d) => addLayers(d, [rect("a")]));
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s.getState().apply((d) => translateLayers(d, ["a"], 0.001, 0));
    let steps = 0;
    while (s.getState().canUndo) {
      s.getState().undo();
      steps++;
    }
    expect(steps).toBe(HISTORY_LIMIT);
    expect(s.getState().document.layers).toHaveLength(1);
  });

  it("resets to a new document without history", () => {
    const s = store();
    s.getState().apply((d) => addLayers(d, [rect("a")]));
    s.getState().reset(emptyImageDocument({ width: 500, height: 500 }));
    expect(s.getState().canUndo).toBe(false);
    expect(s.getState().document.canvas.width).toBe(500);
  });
});
