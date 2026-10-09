import { describe, expect, it } from "vitest";

import { emptyArtboard, STUDIO_LIMITS, type ImageSurface, type Layer } from "./document";
import {
  addLayers,
  alignLayers,
  deleteLayers,
  distributeLayers,
  duplicateLayers,
  groupLayers,
  layerBounds,
  reorderLayers,
  resizeCanvas,
  selectionBounds,
  setLayersHidden,
  setLayersLocked,
  translateLayers,
  ungroupLayers,
  updateLayers,
  withGroupMembers,
} from "./layers";
import { surfaceIssue } from "./validate";

function rect(id: string, x: number, y: number, w = 0.1, h = 0.1): Layer {
  return { id, type: "shape", shape: "rect", fill: "#000000", transform: { x, y, w, h, rotation: 0, opacity: 1 } };
}

function doc(): ImageSurface {
  const d = emptyArtboard({ width: 1000, height: 1000 });
  d.layers = [rect("a", 0.2, 0.2), rect("b", 0.5, 0.5), rect("c", 0.8, 0.8), rect("d", 0.5, 0.2)];
  return d;
}

function order(d: ImageSurface): string[] {
  return d.layers.map((l) => l.id);
}

function close(value: number, expected: number) {
  expect(value).toBeCloseTo(expected, 6);
}

describe("layer list", () => {
  it("adds layers on top, as many as the design needs", () => {
    expect(order(addLayers(doc(), [rect("e", 0.5, 0.5)]))).toEqual(["a", "b", "c", "d", "e"]);
    expect(order(addLayers(doc(), [rect("e", 0.5, 0.5)], 1))).toEqual(["a", "e", "b", "c", "d"]);
    const crowded = { ...doc(), layers: Array.from({ length: 600 }, (_, i) => rect(`l${i}`, 0.5, 0.5)) };
    expect(order(addLayers(crowded, [rect("x", 0.5, 0.5)])).at(-1)).toBe("x");
  });

  it("updates, moves and deletes only unlocked layers", () => {
    const locked = setLayersLocked(doc(), ["b"], true);
    const updated = updateLayers(locked, ["a", "b"], { fill: "#ff0000" });
    expect(updated.layers.map((l) => l.fill)).toEqual(["#ff0000", "#000000", "#000000", "#000000"]);
    const moved = translateLayers(locked, ["a", "b"], 0.1, -0.1);
    expect([moved.layers[0].transform.x, moved.layers[1].transform.x]).toEqual([0.30000000000000004, 0.5]);
    expect(order(deleteLayers(locked, ["a", "b"]))).toEqual(["b", "c", "d"]);
    expect(setLayersLocked(locked, ["b"], false).layers[1].locked).toBeUndefined();
  });

  it("hides and shows", () => {
    expect(setLayersHidden(doc(), ["c"], true).layers[2].hidden).toBe(true);
  });

  it("duplicates above the selection with an offset and fresh ids", () => {
    const { document, ids } = duplicateLayers(doc(), ["a", "b"]);
    expect(ids).toHaveLength(2);
    expect(order(document).slice(0, 2)).toEqual(["a", "b"]);
    expect(order(document).slice(2, 4)).toEqual(ids);
    close(document.layers[2].transform.x, 0.22);
    expect(surfaceIssue(document)).toBeNull();
  });

  it("reorders one step, or to the front and back", () => {
    expect(order(reorderLayers(doc(), ["a"], "forward"))).toEqual(["b", "a", "c", "d"]);
    expect(order(reorderLayers(doc(), ["c", "d"], "forward"))).toEqual(["a", "b", "c", "d"]);
    expect(order(reorderLayers(doc(), ["b", "c"], "backward"))).toEqual(["b", "c", "a", "d"]);
    expect(order(reorderLayers(doc(), ["a", "c"], "front"))).toEqual(["b", "d", "a", "c"]);
    expect(order(reorderLayers(doc(), ["d"], "back"))).toEqual(["d", "a", "b", "c"]);
  });
});

describe("groups", () => {
  it("groups layers contiguously under the topmost member", () => {
    const { document, groupId } = groupLayers(doc(), ["a", "c"]);
    expect(order(document)).toEqual(["b", "a", "c", "d"]);
    expect(document.layers.filter((l) => l.groupId === groupId).map((l) => l.id)).toEqual(["a", "c"]);
    expect(withGroupMembers(document, ["a"])).toEqual(["a", "c"]);
    expect(surfaceIssue(document)).toBeNull();
    expect(groupLayers(doc(), ["a"]).groupId).toBeNull();
  });

  it("ungroups every group touched by the selection", () => {
    const grouped = groupLayers(doc(), ["a", "c"]).document;
    expect(ungroupLayers(grouped, ["c"]).layers.every((l) => l.groupId === undefined)).toBe(true);
  });

  it("drops a group left with a single member and keeps a duplicated child in its group", () => {
    const grouped = groupLayers(doc(), ["a", "c"]).document;
    expect(deleteLayers(grouped, ["a"]).layers.every((l) => l.groupId === undefined)).toBe(true);
    const copied = duplicateLayers(grouped, ["a"]);
    expect(copied.document.layers.find((l) => l.id === copied.ids[0])!.groupId).toBe(grouped.layers.find((l) => l.id === "a")!.groupId);
    const whole = duplicateLayers(grouped, ["a", "c"]);
    expect(whole.document.layers.find((l) => l.id === whole.ids[0])!.groupId).not.toBe(grouped.layers.find((l) => l.id === "a")!.groupId);
  });
});

describe("geometry", () => {
  it("measures rotated bounds in pixels", () => {
    const b = layerBounds({ x: 0.5, y: 0.5, w: 0.2, h: 0.1, rotation: 90, opacity: 1 }, { width: 1000, height: 1000 });
    close(b.left, 450);
    close(b.right, 550);
    close(b.top, 400);
    close(b.bottom, 600);
  });

  it("aligns a single layer to the canvas and several to their bounds", () => {
    close(alignLayers(doc(), ["b"], "left").layers[1].transform.x, 0.05);
    const aligned = alignLayers(doc(), ["a", "c"], "right");
    close(aligned.layers[0].transform.x, 0.8);
    close(aligned.layers[2].transform.x, 0.8);
    const middle = alignLayers(doc(), ["a", "c"], "middle");
    close(middle.layers[0].transform.y, 0.5);
  });

  it("moves a group as one unit", () => {
    const grouped = groupLayers(doc(), ["a", "d"]).document;
    const aligned = alignLayers(grouped, ["a"], "top");
    close(aligned.layers.find((l) => l.id === "a")!.transform.y, 0.05);
    close(aligned.layers.find((l) => l.id === "d")!.transform.y, 0.05);
    close(aligned.layers.find((l) => l.id === "a")!.transform.x, 0.2);
  });

  it("distributes with equal gaps", () => {
    const d = doc();
    d.layers[1].transform.x = 0.3;
    const spread = distributeLayers(d, ["a", "b", "c"], "horizontal");
    close(spread.layers[1].transform.x, 0.5);
    expect(distributeLayers(d, ["a", "b"], "horizontal")).toBe(d);
  });

  it("reports the selection bounds", () => {
    expect(selectionBounds(doc(), ["a", "c"])).toEqual({ left: 150, top: 150, right: 850, bottom: 850 });
    expect(selectionBounds(doc(), [])).toBeNull();
  });
});

describe("magic resize", () => {
  it("keeps sizes in pixels, anchors to the nearest edge and fills with backgrounds", () => {
    const d = doc();
    d.layers.push({ id: "bg", type: "image", assetId: "m-1", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } });
    d.layers.push({ id: "t", type: "text", text: "Oi", fontId: "inter", fontSize: 0.1, transform: { x: 0.5, y: 0.9, w: 0.5, h: 0.1, rotation: 0, opacity: 1 } });
    const story = resizeCanvas(d, { width: 1000, height: 2000 });
    const by = (id: string) => story.layers.find((l) => l.id === id)!;
    expect(story.canvas).toEqual({ width: 1000, height: 2000, background: "#ffffff" });
    close(by("a").transform.y, 0.1);
    close(by("a").transform.h, 0.05);
    close(by("a").transform.w, 0.1);
    close(by("c").transform.y, 0.9);
    close(by("b").transform.y, 0.5);
    close(by("t").transform.y, 0.95);
    close(by("t").fontSize!, 0.05);
    close(by("bg").transform.w, 2);
    close(by("bg").transform.h, 1);
    expect(surfaceIssue(story)).toBeNull();
  });

  it("keeps a group together", () => {
    const grouped = groupLayers(doc(), ["a", "d"]).document;
    const wide = resizeCanvas(grouped, { width: 2000, height: 1000 });
    const a = wide.layers.find((l) => l.id === "a")!.transform;
    const d = wide.layers.find((l) => l.id === "d")!.transform;
    close((d.x - a.x) * 2000, 300);
  });

  it("clamps to the canvas limits", () => {
    expect(resizeCanvas(doc(), { width: 99999, height: 10 }).canvas).toMatchObject({ width: STUDIO_LIMITS.maxCanvasSide, height: STUDIO_LIMITS.minCanvasSide });
  });
});
