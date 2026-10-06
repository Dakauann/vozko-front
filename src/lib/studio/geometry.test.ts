import { describe, expect, it } from "vitest";

import { emptyImageDocument, newShapeLayer, newTextLayer, type Layer, type Transform } from "./document";
import {
  boxPx,
  clickSelection,
  closestAspect,
  fitInside,
  fittedTransform,
  layersInRect,
  nodeResizePatch,
  squareTransform,
  transformFromBoxPx,
} from "./geometry";

const canvas = { width: 1000, height: 500 };

function at(x: number, y: number, w: number, h: number, rotation = 0): Transform {
  return { x, y, w, h, rotation, opacity: 1 };
}

describe("boxPx and transformFromBoxPx", () => {
  it("turns a centered fraction transform into a top left pixel box", () => {
    expect(boxPx(at(0.5, 0.5, 0.2, 0.4), canvas)).toEqual({ left: 400, top: 150, width: 200, height: 200 });
  });

  it("round trips through the pixel box keeping rotation and opacity", () => {
    const base = { ...at(0.3, 0.7, 0.1, 0.2, 30), opacity: 0.5 };
    const back = transformFromBoxPx(boxPx(base, canvas), canvas, base);
    expect(back.x).toBeCloseTo(0.3);
    expect(back.y).toBeCloseTo(0.7);
    expect(back.w).toBeCloseTo(0.1);
    expect(back.h).toBeCloseTo(0.2);
    expect(back.rotation).toBe(30);
    expect(back.opacity).toBe(0.5);
  });

  it("keeps sizes inside the valid range", () => {
    const back = transformFromBoxPx({ left: 0, top: 0, width: 0, height: 99999 }, canvas, at(0.5, 0.5, 0.1, 0.1));
    expect(back.w).toBe(0.001);
    expect(back.h).toBe(4);
  });
});

describe("nodeResizePatch", () => {
  it("reads the scaled node back into the layer size and center", () => {
    const layer = newShapeLayer("rect", at(0.5, 0.5, 0.2, 0.2));
    const patch = nodeResizePatch(layer, { x: 600, y: 200, scaleX: 2, scaleY: 0.5, rotation: 370 }, canvas);
    expect(patch.transform).toEqual({ x: 0.6, y: 0.4, w: 0.4, h: 0.1, rotation: 10, opacity: 1 });
    expect(patch.fontSize).toBeUndefined();
  });

  it("scales the font of text when the corners keep the ratio", () => {
    const layer = newTextLayer("Oi", "body", at(0.5, 0.5, 0.4, 0.1));
    const patch = nodeResizePatch(layer, { x: 500, y: 250, scaleX: 2, scaleY: 2, rotation: 0 }, canvas);
    expect(patch.fontSize).toBeCloseTo((layer.fontSize ?? 0) * 2);
  });

  it("reflows text without touching the font when only one side moves", () => {
    const layer = newTextLayer("Oi", "body", at(0.5, 0.5, 0.4, 0.1));
    const patch = nodeResizePatch(layer, { x: 500, y: 250, scaleX: 1.5, scaleY: 1, rotation: 0 }, canvas);
    expect(patch.fontSize).toBeUndefined();
    expect(patch.transform?.w).toBeCloseTo(0.6);
  });

  it("handles negative scales from flipped drags as positive sizes", () => {
    const layer = newShapeLayer("rect", at(0.5, 0.5, 0.2, 0.2));
    const patch = nodeResizePatch(layer, { x: 500, y: 250, scaleX: -1, scaleY: 1, rotation: 0 }, canvas);
    expect(patch.transform?.w).toBeCloseTo(0.2);
  });
});

describe("fittedTransform and fitInside", () => {
  it("fits a wide image inside the default share of the canvas keeping its pixel ratio", () => {
    const t = fittedTransform(2000, 1000, canvas);
    expect(t.w * canvas.width).toBeCloseTo(600);
    expect(t.h * canvas.height).toBeCloseTo(300);
    expect(t.x).toBe(0.5);
    expect(t.y).toBe(0.5);
  });

  it("fits a tall image by height", () => {
    const t = fittedTransform(100, 400, canvas, 0.5);
    expect(t.h * canvas.height).toBeCloseTo(250);
    expect(t.w * canvas.width).toBeCloseTo(62.5);
  });

  it("fits inside an existing box keeping its center and rotation", () => {
    const box = at(0.25, 0.5, 0.2, 0.4, 15);
    const t = fitInside(100, 100, box, canvas);
    expect(t.x).toBe(0.25);
    expect(t.y).toBe(0.5);
    expect(t.rotation).toBe(15);
    expect(t.w * canvas.width).toBeCloseTo(200);
    expect(t.h * canvas.height).toBeCloseTo(200);
  });
});

describe("closestAspect", () => {
  it("maps canvases to the nearest generation aspect", () => {
    expect(closestAspect(1080, 1080)).toBe("square");
    expect(closestAspect(1080, 1350)).toBe("portrait");
    expect(closestAspect(1080, 1920)).toBe("story");
    expect(closestAspect(1200, 628)).toBe("landscape");
    expect(closestAspect(1920, 1080)).toBe("landscape");
  });
});

function docWith(layers: Layer[]) {
  return { ...emptyImageDocument(canvas), layers };
}

describe("layersInRect", () => {
  const a = { ...newShapeLayer("rect", at(0.1, 0.1, 0.1, 0.1)), id: "a" };
  const b = { ...newShapeLayer("rect", at(0.9, 0.9, 0.1, 0.1)), id: "b" };
  const c = { ...newShapeLayer("rect", at(0.15, 0.15, 0.05, 0.05)), id: "c", hidden: true };
  const d = { ...newShapeLayer("rect", at(0.12, 0.12, 0.05, 0.05)), id: "d", locked: true };
  const e = { ...newShapeLayer("rect", at(0.95, 0.1, 0.05, 0.05)), id: "e", groupId: "g" };
  const f = { ...newShapeLayer("rect", at(0.95, 0.9, 0.05, 0.05)), id: "f", groupId: "g" };

  it("selects visible unlocked layers touching the rectangle and their groups", () => {
    const doc = docWith([a, b, c, d, e, f]);
    expect(layersInRect(doc, { left: 0, top: 0, right: 200, bottom: 100 })).toEqual(["a"]);
    expect(layersInRect(doc, { left: 900, top: 0, right: 1000, bottom: 100 })).toEqual(["e", "f"]);
  });

  it("accepts a rectangle drawn backwards", () => {
    const doc = docWith([a]);
    expect(layersInRect(doc, { left: 200, top: 100, right: 0, bottom: 0 })).toEqual(["a"]);
  });
});

describe("clickSelection", () => {
  const a = { ...newShapeLayer("rect"), id: "a" };
  const b = { ...newShapeLayer("rect"), id: "b", groupId: "g" };
  const c = { ...newShapeLayer("rect"), id: "c", groupId: "g" };
  const doc = docWith([a, b, c]);

  it("selects the whole group of the clicked layer", () => {
    expect(clickSelection(doc, [], "b", false)).toEqual(["b", "c"]);
  });

  it("keeps the current selection when the click lands inside it", () => {
    expect(clickSelection(doc, ["a", "b", "c"], "a", false)).toEqual(["a", "b", "c"]);
  });

  it("toggles with the additive modifier", () => {
    expect(clickSelection(doc, ["a"], "c", true)).toEqual(["a", "b", "c"]);
    expect(clickSelection(doc, ["a", "b", "c"], "b", true)).toEqual(["a"]);
  });
});

describe("squareTransform", () => {
  it("sizes an element as a square share of the shorter side whatever the canvas ratio", () => {
    const t = squareTransform(canvas, 0.2);
    expect(t.w * canvas.width).toBeCloseTo(100);
    expect(t.h * canvas.height).toBeCloseTo(100);
    expect(t.x).toBe(0.5);
    expect(t.y).toBe(0.5);
  });

  it("takes a separate height share for wide elements such as lines", () => {
    const t = squareTransform(canvas, 0.6, 0.05);
    expect(t.w * canvas.width).toBeCloseTo(300);
    expect(t.h * canvas.height).toBeCloseTo(25);
  });
});
