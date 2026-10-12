import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyArtboard, newIconLayer, newImageLayer, newShapeLayer, newTextLayer, type ImageSurface, type Layer } from "./document";
import { newEffect, type Paint, type StrokePaint } from "./layer-paint";
import { DEFAULT_PATTERN } from "./pattern";
import { documentIssue, layerIssue, surfaceIssue } from "./validate";

const solid = (color: string): Paint => ({ type: "solid", color, opacity: 1 });
const outside = (color: string, width: number): StrokePaint => ({ ...solid(color), width, align: "outside" });

function painted(): ImageSurface {
  const doc = emptyArtboard({ width: 1080, height: 1080 });
  doc.layers = [
    { ...newShapeLayer("rect"), id: "card", pattern: { ...DEFAULT_PATTERN, tile: "brick-row", offset: 0.5, spacing: { x: 4, y: 4 }, origin: { x: 0.25, y: 0 }, angle: 15, blendMode: "multiply" } },
    { ...newImageLayer("m-1"), id: "photo", gradientMap: { stops: [{ at: 0, color: "#1b1464" }, { at: 1, color: "#ffd166ff" }], intensity: 0.8, interpolation: "srgb" }, strokes: [outside("#ffffff", 12)], effects: [newEffect("drop-shadow", "fx-1")] },
    {
      ...newTextLayer("Oferta"),
      id: "title",
      fill: undefined,
      fills: [solid("#ffffff"), { type: "gradient", gradient: { from: "#ffffff00", to: "#ffd16680", angle: 90 }, opacity: 0.6, blendMode: "overlay" }, { type: "pattern", pattern: { source: "asset", assetId: "m-2", size: 64, opacity: 1 }, opacity: 1 }],
      strokes: [{ ...outside("#e4003a", 6), dashArray: [2, 1], lineJoin: "round" }, { type: "gradient", gradient: { from: "#000000", to: "#333333", angle: 0 }, opacity: 1, width: 14, align: "center" }],
      effects: [newEffect("outer-glow", "glow"), { ...newEffect("inner-glow", "inner"), source: "center" }, { ...newEffect("drop-shadow", "drop"), showBehind: true }, newEffect("inner-shadow", "carve")],
    },
    { ...newIconLayer("star"), id: "star", fill: undefined, fills: [{ type: "pattern", pattern: DEFAULT_PATTERN, opacity: 1 }], strokes: [outside("#000000", 3)] },
  ];
  return doc;
}

function layer(doc: ImageSurface, id: string): Layer {
  return doc.layers.find((l) => l.id === id)!;
}

describe("patterns, gradient maps, paint lists and effects in the document", () => {
  it("accepts the full set the backend accepts", () => {
    expect(surfaceIssue(painted())).toBeNull();
    const saved = { schema: "studio.image", version: 2, artboards: [{ id: "a1", x: 0, y: 0, ...painted() }] };
    expect(documentIssue("image", JSON.parse(JSON.stringify(saved)))).toBeNull();
  });

  it.each<[string, (d: ImageSurface) => void]>([
    ["a pattern on an image", (d) => Object.assign(layer(d, "photo"), { pattern: DEFAULT_PATTERN })],
    ["a pattern on a line", (d) => d.layers.push({ ...newShapeLayer("line"), id: "line", pattern: DEFAULT_PATTERN })],
    ["a pattern with a gradient", (d) => Object.assign(layer(d, "card"), { gradient: { from: "#000000", to: "#ffffff", angle: 0 } })],
    ["a pattern with fills", (d) => Object.assign(layer(d, "title"), { pattern: DEFAULT_PATTERN })],
    ["a broken pattern", (d) => Object.assign(layer(d, "card").pattern!, { size: 0 })],
    ["a gradient map on a shape", (d) => Object.assign(layer(d, "card"), { gradientMap: { stops: [{ at: 0, color: "#000000" }, { at: 1, color: "#ffffff" }], intensity: 1 } })],
    ["a gradient map with one stop", (d) => Object.assign(layer(d, "photo").gradientMap!, { stops: [{ at: 0, color: "#000000" }] })],
    ["fills on an image", (d) => Object.assign(layer(d, "photo"), { fills: [solid("#000000")] })],
    ["fills with a legacy fill", (d) => Object.assign(layer(d, "title"), { fill: "#000000" })],
    ["a solid paint without a color", (d) => Object.assign(layer(d, "title").fills![0], { color: "" })],
    ["a solid paint with a gradient", (d) => Object.assign(layer(d, "title").fills![0], { gradient: { from: "#000000", to: "#ffffff", angle: 0 } })],
    ["a gradient paint with a color", (d) => Object.assign(layer(d, "title").fills![1], { color: "#000000" })],
    ["an unknown paint", (d) => Object.assign(layer(d, "title").fills![0], { type: "noise" })],
    ["a paint opacity past 1", (d) => Object.assign(layer(d, "title").fills![0], { opacity: 1.5 })],
    ["strokes with a legacy outline", (d) => Object.assign(layer(d, "title"), { strokeWidth: 2 })],
    ["strokes with a legacy dash", (d) => Object.assign(layer(d, "title"), { dash: true })],
    ["strokes on an arrow", (d) => d.layers.push({ ...newShapeLayer("arrow"), id: "arrow", stroke: undefined, strokeWidth: undefined, strokes: [outside("#000000", 2)] })],
    ["a stroke without an alignment", (d) => Object.assign(layer(d, "title").strokes![0], { align: "" })],
    ["a stroke past 200 px", (d) => Object.assign(layer(d, "title").strokes![0], { width: 300 })],
    ["a stroke with a bad dash", (d) => Object.assign(layer(d, "title").strokes![0], { dashArray: [0, 0] })],
    ["an inside outline around a picture", (d) => Object.assign(layer(d, "photo").strokes![0], { align: "inside" })],
    ["a gradient outline around a picture", (d) => Object.assign(layer(d, "photo"), { strokes: [{ type: "gradient", gradient: { from: "#000000", to: "#ffffff", angle: 0 }, opacity: 1, width: 4, align: "outside" }] })],
    ["a dashed outline around an icon", (d) => Object.assign(layer(d, "star").strokes![0], { dashArray: [2, 2] })],
    ["a blended outline around a picture", (d) => Object.assign(layer(d, "photo").strokes![0], { blendMode: "multiply" })],
    ["effects with a legacy shadow", (d) => Object.assign(layer(d, "title"), { shadow: { color: "#000000", blur: 2, x: 0, y: 0 } })],
    ["a repeated effect id", (d) => Object.assign(layer(d, "title").effects![1], { id: "glow" })],
    ["an effect id that is not a token", (d) => Object.assign(layer(d, "title").effects![1], { id: "Glow Two" })],
    ["an unknown effect", (d) => Object.assign(layer(d, "title").effects![0], { type: "bevel" })],
    ["a blend on an outer effect", (d) => Object.assign(layer(d, "title").effects![0], { blendMode: "screen" })],
    ["show behind on a glow", (d) => Object.assign(layer(d, "title").effects![0], { showBehind: true })],
    ["a source on a shadow", (d) => Object.assign(layer(d, "title").effects![3], { source: "edge" })],
    ["an unknown glow source", (d) => Object.assign(layer(d, "title").effects![1], { source: "corner" })],
    ["an effect blur past 200", (d) => Object.assign(layer(d, "title").effects![0], { blur: 201 })],
    ["an effect spread past 100", (d) => Object.assign(layer(d, "title").effects![0], { spread: -101 })],
    ["an effect offset past 500", (d) => Object.assign(layer(d, "title").effects![2], { x: 501 })],
    ["an effect without a color", (d) => Object.assign(layer(d, "title").effects![2], { color: "" })],
  ])("refuses %s", (_, mutate) => {
    const doc = painted();
    mutate(doc);
    expect(surfaceIssue(doc)).not.toBeNull();
  });

  it("refuses unknown fields inside the new objects", () => {
    const doc = painted();
    const raw = JSON.parse(JSON.stringify({ schema: "studio.image", version: 2, artboards: [{ id: "a1", x: 0, y: 0, ...doc }] }));
    raw.artboards[0].layers[0].pattern.scale = 2;
    expect(documentIssue("image", raw)).toEqual({ field: "document", code: "invalid" });
  });

  it("checks layers built in memory with absent optional fields the same way", () => {
    expect(layerIssue({ ...newShapeLayer("ellipse"), pattern: { source: "preset", presetId: "waves", color: "#000000", size: 24, opacity: 1 } })).toBeNull();
    expect(layerIssue({ ...newShapeLayer("ellipse"), effects: [{ id: "a", type: "drop-shadow", color: "#000000", opacity: 1, x: 0, y: 0, blur: 0, spread: 0 }] })).toBeNull();
  });
});

describe("the paint contract shared with the backend", () => {
  it("accepts the fixture the backend accepts", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_paint.json"), "utf8"));
    expect(documentIssue("image", raw)).toBeNull();
  });
});
