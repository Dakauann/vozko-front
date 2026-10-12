import { describe, expect, it } from "vitest";

import { counterCells, counterTokens, newCounter } from "../counter";
import { emptyVideoDocument, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "../document";
import { sheetLayers, sheetLayout, measureCell, unitPieces, centerPieces } from "../glyph-layout";
import { visualPlan } from "../playback";
import { curvePath } from "../paint";
import { videoScene } from "./video-scene";

function film(patch: Partial<Clip>, layer = newTextLayer("Oferta")): VideoDocument {
  const doc = emptyVideoDocument("square");
  const clip: Clip = { ...newOverlayClip({ ...layer, id: "l-text" }, 0, 2000, { x: 0.5, y: 0.5, w: 0.5, h: 0.2, rotation: 0, opacity: 1 }), id: "c-text", ...patch };
  doc.tracks = [{ id: "t-1", kind: "visual", clips: [clip] }];
  doc.durationMs = 2000;
  return doc;
}

function nodeAt(doc: VideoDocument, ms: number) {
  return videoScene(doc, visualPlan(doc, ms)).nodes[0];
}

const counting: Partial<Clip> = { counter: { ...newCounter("pt-BR"), prefix: "R$ " }, keyframes: { counter: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1000, easing: "linear" }] } };

describe("glyph scene", () => {
  it("draws a counter from one glyph sheet whose key holds across frames", () => {
    const doc = film(counting);
    const early = nodeAt(doc, 100);
    const late = nodeAt(doc, 1000);
    expect(early.source.kind).toBe("glyphs");
    expect(early.source.kind === "glyphs" && early.source.key).toBe(late.source.kind === "glyphs" && late.source.key);
    expect(early.glyphs?.parts[0].source.cells).toEqual(counterCells(doc.tracks[0].clips[0].counter!));
    expect(late.glyphs?.run.content).toEqual({ kind: "counter", tokens: counterTokens(doc.tracks[0].clips[0].counter!, 1000), slotCells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
    expect(late.box).toMatchObject({ x: 540, y: 540, width: 540, height: 216 });
    expect(late.glyphs?.frame).toEqual({ width: 540, height: 216 });
    expect(late.text).toBeUndefined();
  });

  it("preloads the sheet before the clip starts", () => {
    const doc = film({ ...counting });
    doc.tracks[0].clips[0].startMs = 1000;
    doc.tracks[0].clips[0].durationMs = 1000;
    expect(nodeAt(doc, 500).source.kind).toBe("glyphs");
  });

  it("carries the text animators and the color keys into the glyph parts", () => {
    const doc = film({ ...counting, textIn: { unit: "char", style: "fade", durationMs: 200, staggerMs: 50, easing: "linear" }, keyframes: { ...counting.keyframes, fill: [{ atMs: 0, color: "#ff0000", easing: "linear" }, { atMs: 1000, color: "#0000ff", easing: "linear" }] } });
    const node = nodeAt(doc, 500);
    expect(node.glyphs?.run.motion?.in?.style).toBe("fade");
    expect(node.glyphs?.parts.map((part) => part.weight)).toEqual([0.5, 0.5]);
    expect(node.glyphs?.parts.map((part) => part.source.layer.fill)).toEqual(["#ff0000", "#0000ff"]);
  });

  it("lays text on its path inside the layer box", () => {
    const doc = film({ textPath: { shape: "arc", bend: 0.5, offset: 0.5, align: "center" }, keyframes: { pathOffset: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }] } });
    const node = nodeAt(doc, 250);
    expect(node.glyphs?.parts[0].source.cells).toEqual(["Oferta"]);
    expect(node.glyphs?.run.path).toEqual({ data: curvePath(540, 216, 0.5), offset: 0.25, align: "center", upright: false, reverse: false });
    expect(node.glyphs?.run.backdrop).toBe(false);
  });

  it("keeps a highlight behind a counter as a backdrop and leaves plain text alone", () => {
    const highlighted = nodeAt(film(counting, { ...newTextLayer("0"), highlight: { color: "#ffcc00", radius: 0.3 } }), 0);
    expect(highlighted.glyphs?.run.backdrop).toBe(true);
    expect(highlighted.glyphs?.parts[0].source.backdrop).toEqual({ width: 540, height: 216 });
    expect(nodeAt(film({}), 0).glyphs).toBeUndefined();
  });
});

describe("sheet layers and pieces", () => {
  const measure = (text: string) => [...text].length * 10;
  const sheet = sheetLayout([measureCell("12", measure, 0), measureCell("R$", measure, 0)], 24, 4, { width: 80, height: 30 });

  it("places one text layer per cell where the sheet expects its pen, plus the backdrop", () => {
    const layers = sheetLayers({ ...newTextLayer("x"), highlight: { color: "#000000", radius: 0.2 } }, sheet, 20);
    expect(layers.map((layer) => layer.text)).toEqual(["", "12", "R$"]);
    expect(layers[0].highlight).toBeDefined();
    expect(layers[1].highlight).toBeUndefined();
    const cell = sheet.cells[1];
    const second = layers[2].transform;
    expect((second.x - second.w / 2) * sheet.width).toBeCloseTo(cell.x + cell.penX, 6);
    expect(second.y * sheet.height).toBeCloseTo(cell.y + cell.penY + 12, 6);
    expect(layers.every((layer) => layer.align === "left" || layer.text === "")).toBe(true);
  });

  it("centers pieces on the frame and turns raster units into pieces", () => {
    const centered = centerPieces([{ tile: { x: 0, y: 0, width: 10, height: 10 }, x: 50, y: 20, width: 10, height: 10, rotation: 0, opacity: 1, blurPx: 0 }], 100, 40);
    expect(centered[0]).toMatchObject({ x: 0, y: 0 });
    const pieces = unitPieces([{ tile: { x: 0, y: 0, width: 50, height: 40 }, look: { dx: 5, dy: -2, scale: 2, rotation: 12, rotationX: 0, rotationY: 0, depth: 0, opacity: 0.5, blurPx: 3, tints: [0.25] } }], 100, 40);
    expect(pieces[0]).toEqual({ tile: { x: 0, y: 0, width: 50, height: 40 }, x: -20, y: -2, width: 100, height: 80, rotation: 12, opacity: 0.5, blurPx: 3, tints: [0.25] });
  });
});
