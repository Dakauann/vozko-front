import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { lineMarkers } from "./arrowheads";
import { newShapeLayer, type Layer } from "./document";
import { layerVectors } from "./export-scene";
import { lineFrame } from "./line-geometry";
import { regularPolygon } from "./paint";
import { documentIssue, layerIssue } from "./validate";
import { vectorLayerOf } from "./vector-layer";

const FIXTURE = resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_line_ends.json");
const canvas = { width: 1000, height: 1000 };

function line(extra: Partial<Layer> = {}): Layer {
  return { ...newShapeLayer("line"), transform: { x: 0.5, y: 0.5, w: 0.4, h: 0.02, rotation: 0, opacity: 1 }, strokeWidth: 8, ...extra };
}

describe("the line ends contract shared with the backend", () => {
  it("accepts the fixture the backend accepts", () => {
    expect(documentIssue("image", JSON.parse(readFileSync(FIXTURE, "utf8")))).toBeNull();
  });

  it("refuses unknown kinds and kinds on an end without a head", () => {
    expect(layerIssue(line({ arrowEnd: true, arrowEndKind: "diamond" }))).toBeNull();
    expect(layerIssue(line({ arrowStart: true, arrowStartKind: "star" as never }))).toBe("unknown");
    expect(layerIssue(line({ arrowEnd: false, arrowEndKind: "dot" }))).toBe("invalid");
    expect(layerIssue(line({ arrowEnd: true, arrowStartKind: "bar" }))).toBe("invalid");
  });

  it("lets polygons carry a side count but never an inner radius", () => {
    const polygon = { ...newShapeLayer("polygon"), points: 8 };
    expect(layerIssue(polygon)).toBeNull();
    expect(layerIssue({ ...polygon, inner: 0.5 })).toBe("invalid");
    expect(layerIssue({ ...polygon, points: 2 })).toBe("out_of_range");
  });
});

describe("regular polygons", () => {
  it("puts one corner on top and spreads the sides evenly in the box", () => {
    const square = regularPolygon({ points: 4 }, 100, 100);
    expect(square.map((v) => Math.round(v))).toEqual([50, 0, 100, 50, 50, 100, 0, 50]);
    expect(regularPolygon({}, 100, 100)).toHaveLength(12);
  });

  it("exports as a closed vector outline with one node per side", () => {
    const vector = vectorLayerOf({ ...newShapeLayer("polygon"), points: 5 }, canvas);
    expect(vector).not.toBeNull();
    const items = layerVectors({ ...newShapeLayer("polygon"), points: 5 }, canvas);
    expect(items?.[0].subpaths[0].closed).toBe(true);
    expect(items?.[0].subpaths[0].nodes).toHaveLength(5);
  });
});

describe("line ends across renderers", () => {
  it("exports marker ends as filled vectors in the stroke color", () => {
    const items = layerVectors(line({ arrowStart: true, arrowStartKind: "dot", arrowEnd: true, arrowEndKind: "bar" }), canvas);
    expect(items).toHaveLength(3);
    expect(items?.[1].fill).toMatchObject({ kind: "solid" });
    expect(items?.[1].stroke).toBeNull();
  });

  it("keeps the stroked arrow on raster export, as before", () => {
    expect(layerVectors(line({ arrowEnd: true }), canvas)).toBeNull();
    expect(layerVectors(line({ arrowEnd: true, arrowEndKind: "openArrow" }), canvas)).toHaveLength(2);
  });

  it("draws the same marker in the animated line path as in the still canvas", () => {
    const layer = line({ arrowEnd: true, arrowEndKind: "diamond" });
    const frame = lineFrame({ layer, widthPx: canvas.width, heightPx: canvas.height, line: {}, color: "#111111", step: 2 });
    expect(frame.heads).toHaveLength(1);
    expect(frame.heads[0].stroked).toBe(false);
    const [still] = lineMarkers(layer, layer.transform.w * canvas.width, layer.transform.h * canvas.height);
    const offsetX = (layer.transform.x - layer.transform.w / 2) * canvas.width;
    const offsetY = (layer.transform.y - layer.transform.h / 2) * canvas.height;
    frame.heads[0].points.forEach((value, i) => expect(value).toBeCloseTo(still[i] + (i % 2 === 0 ? offsetX : offsetY), 3));
  });

  it("keeps the stroked arrow head in the animated line path", () => {
    const frame = lineFrame({ layer: line({ arrowStart: true, arrowEnd: true, arrowEndKind: "round" }), widthPx: canvas.width, heightPx: canvas.height, line: {}, color: "#111111", step: 2 });
    expect(frame.heads.map((head) => head.stroked)).toEqual([true, false]);
  });
});
