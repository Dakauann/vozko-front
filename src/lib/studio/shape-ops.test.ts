import { describe, expect, it } from "vitest";

import { emptyArtboard, newPathLayer, newShapeLayer, newTextLayer, type ImageSurface, type Layer, type Transform } from "./document";
import { layerById } from "./layers";
import { pathToSubpaths } from "./path-nodes";
import { combineShapes, layerNodeCount, outlineStrokes, releaseCompound, reversePaths, shapeOpsFor, simplifyPaths } from "./shape-ops";
import { canvasSubpaths } from "./vector-layer";
import { pathBounds } from "./path-nodes";

const canvas = { width: 1000, height: 1000 };

function box(x: number, y: number, w: number, h: number, rotation = 0): Transform {
  return { x, y, w, h, rotation, opacity: 1 };
}

function doc(layers: Layer[], groups: ImageSurface["groups"] = []): ImageSurface {
  return { ...emptyArtboard(canvas), layers, groups };
}

const bottom: Layer = { ...newShapeLayer("rect", box(0.3, 0.3, 0.2, 0.2)), id: "bottom", fill: "#ff0000", name: "Base" };
const top: Layer = { ...newShapeLayer("rect", box(0.4, 0.4, 0.2, 0.2)), id: "top", fill: "#0000ff", stroke: "#111111", strokeWidth: 2, lineJoin: "bevel", name: "Topo" };
const text: Layer = { ...newTextLayer("Oi"), id: "text" };

describe("combineShapes", () => {
  it("replaces the shapes with one path where the top one was, styled like the top one on union", () => {
    const result = combineShapes(doc([text, bottom, top]), ["bottom", "top"], "union");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.layers.map((l) => l.id)).toEqual(["text", result.ids[0]]);
    const merged = layerById(result.document, result.ids[0])!;
    expect(merged).toMatchObject({ shape: "path", fill: "#0000ff", stroke: "#111111", strokeWidth: 2, lineJoin: "bevel", fillRule: "evenodd", name: "Topo" });
    expect(merged.transform.rotation).toBe(0);
    const bounds = pathBounds(canvasSubpaths(merged, canvas));
    expect(bounds.left).toBeCloseTo(200, 6);
    expect(bounds.bottom).toBeCloseTo(500, 6);
  });

  it("keeps the bottom style when subtracting, and works on rotated shapes", () => {
    const turned = { ...top, transform: box(0.4, 0.4, 0.2, 0.2, 45) };
    const result = combineShapes(doc([bottom, turned]), ["top", "bottom"], "subtract");
    expect(result.ok && layerById(result.document, result.ids[0])).toMatchObject({ fill: "#ff0000", name: "Base" });
  });

  it("joins shapes into one compound path without cutting them", () => {
    const result = combineShapes(doc([bottom, top]), ["bottom", "top"], "flatten");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const merged = layerById(result.document, result.ids[0])!;
    expect(pathToSubpaths(merged.path ?? "")).toHaveLength(2);
    expect(merged.fillRule).toBeUndefined();
  });

  it("stays inside the group of the top shape", () => {
    const grouped = [{ ...bottom, groupId: "g" }, { ...top, groupId: "g" }, { ...text, groupId: "g" }];
    const result = combineShapes(doc(grouped, [{ id: "g", name: "Grupo" }]), ["bottom", "top"], "intersect");
    expect(result.ok && layerById(result.document, result.ids[0])?.groupId).toBe("g");
    expect(result.ok && result.document.groups).toHaveLength(1);
  });

  it("refuses with a reason and changes nothing", () => {
    const far = { ...top, transform: box(0.9, 0.9, 0.05, 0.05) };
    expect(combineShapes(doc([bottom, far]), ["bottom", "top"], "intersect")).toEqual({ ok: false, issue: "empty" });
    expect(combineShapes(doc([bottom, top]), ["bottom"], "union")).toEqual({ ok: false, issue: "too_few" });
    expect(combineShapes(doc([bottom, text]), ["bottom", "text"], "union")).toEqual({ ok: false, issue: "unsupported" });
    expect(combineShapes(doc([bottom, { ...top, locked: true }]), ["bottom", "top"], "union")).toEqual({ ok: false, issue: "locked" });
    const line = { ...newShapeLayer("line"), id: "line" };
    expect(combineShapes(doc([bottom, line]), ["bottom", "line"], "union")).toEqual({ ok: false, issue: "unsupported" });
  });
});

describe("releaseCompound", () => {
  it("splits every subpath into its own layer, keeping style and rotation", () => {
    const ring: Layer = { id: "ring", type: "shape", shape: "path", path: "M0 0 L1 0 L1 1 L0 1 Z M0.3 0.3 L0.7 0.3 L0.7 0.7 L0.3 0.7 Z", fillRule: "evenodd", fill: "#00ff00", transform: box(0.5, 0.5, 0.4, 0.4, 30) };
    const result = releaseCompound(doc([bottom, ring, top]), ["ring"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ids).toHaveLength(2);
    expect(result.document.layers.map((l) => l.id)).toEqual(["bottom", ...result.ids, "top"]);
    for (const id of result.ids) expect(layerById(result.document, id)).toMatchObject({ fill: "#00ff00", transform: { rotation: 30 } });
    expect(releaseCompound(doc([bottom]), ["bottom"])).toEqual({ ok: false, issue: "unsupported" });
  });
});

describe("reversePaths", () => {
  it("flips the direction of path layers so arrow heads and holes follow", () => {
    const arrow: Layer = { id: "a", type: "shape", shape: "path", path: "M0 0 L1 1", stroke: "#111111", strokeWidth: 4, arrowEnd: true, transform: box(0.5, 0.5, 0.2, 0.2) };
    const result = reversePaths(doc([arrow]), ["a"]);
    expect(result.ok && layerById(result.document, "a")?.path).toBe("M1 1 L0 0");
    expect(reversePaths(doc([bottom]), ["bottom"])).toEqual({ ok: false, issue: "unsupported" });
  });
});

describe("simplifyPaths", () => {
  it("drops points a heavy path does not need and keeps it where it was", () => {
    const heavy: Layer = { id: "h", type: "shape", shape: "path", path: Array.from({ length: 120 }, (_, i) => `${i === 0 ? "M" : "L"}${(0.5 + 0.5 * Math.cos((2 * Math.PI * i) / 120)).toFixed(4)} ${(0.5 + 0.5 * Math.sin((2 * Math.PI * i) / 120)).toFixed(4)}`).join(" ") + " Z", fill: "#000000", transform: box(0.5, 0.5, 0.4, 0.4, 20) };
    const result = simplifyPaths(doc([heavy]), ["h"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const light = layerById(result.document, "h")!;
    expect(layerNodeCount(light)).toBeLessThanOrEqual(8);
    expect(light.transform.rotation).toBe(20);
    expect(light.transform.x).toBeCloseTo(0.5, 3);
    expect(light.transform.w).toBeCloseTo(0.4, 2);
    const square: Layer = { ...heavy, id: "s", path: "M0 0 L1 0 L1 1 L0 1 Z" };
    expect(simplifyPaths(doc([square]), ["s"])).toEqual({ ok: false, issue: "unchanged" });
  });
});

describe("outlineStrokes", () => {
  it("turns a stroke into a filled shape in the stroke colour, arrow heads included, where the stroke was", () => {
    const stroke = { ...newPathLayer("M0 0.5 L1 0.5", box(0.5, 0.5, 0.2, 0.05, 30), true), id: "s", stroke: "#ff0000", strokeWidth: 10, arrowEnd: true };
    const result = outlineStrokes(doc([bottom, stroke, top]), ["s"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.layers.map((l) => l.id)).toEqual(["bottom", result.ids[0], "top"]);
    const shape = layerById(result.document, result.ids[0])!;
    expect(shape).toMatchObject({ shape: "path", fill: "#ff0000", transform: { rotation: 30 } });
    expect(shape.strokeWidth ?? 0).toBe(0);
    expect(shape.transform.w * canvas.width).toBeGreaterThan(200 + 10);
  });

  it("keeps the fill as its own layer under the outlined stroke", () => {
    const framed = { ...bottom, stroke: "#111111", strokeWidth: 6, dashArray: [3, 1] };
    const result = outlineStrokes(doc([framed]), ["bottom"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [fill, ring] = result.document.layers;
    expect(fill).toMatchObject({ id: "bottom", fill: "#ff0000" });
    expect(fill.strokeWidth ?? 0).toBe(0);
    expect(fill.dashArray).toBeUndefined();
    expect(ring).toMatchObject({ shape: "path", fill: "#111111" });
    expect(result.ids).toEqual(["bottom", ring.id]);
  });

  it("outlines lines and refuses shapes without a stroke", () => {
    const line = { ...newShapeLayer("line"), id: "line" };
    expect(outlineStrokes(doc([line]), ["line"]).ok).toBe(true);
    expect(outlineStrokes(doc([bottom, text]), ["bottom", "text"])).toEqual({ ok: false, issue: "unsupported" });
  });
});

describe("shapeOpsFor", () => {
  it("says which shape operations the selection allows", () => {
    const ring: Layer = { id: "ring", type: "shape", shape: "path", path: "M0 0 L1 0 L1 1 Z M0.2 0.2 L0.5 0.2 L0.5 0.5 Z", transform: box(0.5, 0.5, 0.2, 0.2) };
    expect(shapeOpsFor(doc([bottom, top, ring, text]), ["bottom", "top"])).toEqual({ combine: true, release: false, reverse: false, simplify: false, outline: true });
    expect(shapeOpsFor(doc([bottom, top, ring, text]), ["ring"])).toEqual({ combine: false, release: true, reverse: true, simplify: true, outline: false });
    expect(shapeOpsFor(doc([bottom, top, ring, text]), ["bottom", "text"])).toEqual({ combine: false, release: false, reverse: false, simplify: false, outline: false });
  });
});
