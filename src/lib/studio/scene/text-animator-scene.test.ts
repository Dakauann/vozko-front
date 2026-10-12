import { describe, expect, it } from "vitest";

import { newCounter } from "../counter";
import { emptyVideoDocument, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "../document";
import { composeGlyphs, measureCell, sheetLayout, type GlyphRun } from "../glyph-layout";
import { visualPlan } from "../playback";
import { newRangeSelector, newTextUnitAnimator } from "../text-animator";
import { animatorFrameAt, type AnimatorProperties } from "../text-selectors";
import { videoScene } from "./video-scene";

function film(patch: Partial<Clip>): VideoDocument {
  const doc = emptyVideoDocument("square");
  const clip: Clip = { ...newOverlayClip({ ...newTextLayer("Oferta de hoje"), id: "l-text", fill: "#ffffff" }, 0, 2000, { x: 0.5, y: 0.5, w: 0.5, h: 0.2, rotation: 0, opacity: 1 }), id: "c-text", ...patch };
  doc.tracks = [{ id: "t-1", kind: "visual", clips: [clip] }];
  doc.durationMs = 2000;
  return doc;
}

function nodeAt(doc: VideoDocument, ms: number) {
  return videoScene(doc, visualPlan(doc, ms)).nodes[0];
}

const tinted = newTextUnitAnimator("char", { fill: "#ff0000" }, newRangeSelector(1));

describe("text animators in the scene", () => {
  it("gives a raster text one raster per animator color and a plan to weigh each letter", () => {
    const node = nodeAt(film({ textAnimators: [tinted] }), 500);
    expect(node.text?.animators).toHaveLength(1);
    expect(node.mix?.map((part) => [part.source.layer.fill, part.weight])).toEqual([
      ["#ffffff", 1],
      ["#ff0000", 0],
    ]);
    expect(node.textPaint?.fill.steps).toEqual([1]);
  });

  it("keeps a single raster when the animators do not change color", () => {
    const node = nodeAt(film({ textAnimators: [newTextUnitAnimator("char", { y: 10 }, newRangeSelector(1))] }), 500);
    expect(node.mix).toBeUndefined();
    expect(node.textPaint).toBeUndefined();
  });

  it("gives a counter the same color parts on its glyph sheet", () => {
    const counter = { counter: newCounter("pt-BR"), keyframes: { counter: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 1000, value: 100, easing: "linear" as const }] } };
    const node = nodeAt(film({ ...counter, textAnimators: [tinted] }), 500);
    expect(node.glyphs?.parts.map((part) => part.source.layer.fill)).toEqual(["#ffffff", "#ff0000"]);
    expect(node.glyphs?.plan?.fill.steps).toEqual([1]);
    expect(node.glyphs?.run.motion?.animators).toHaveLength(1);
  });
});

describe("animators on glyph runs", () => {
  const sheet = sheetLayout([measureCell("Oi oi", (text) => text.length * 10, 0)], 20, 2);
  const run = (properties: AnimatorProperties, path?: GlyphRun["path"]): GlyphRun => ({
    box: { x: 0, y: 0, width: 200, height: 40 },
    align: "left",
    content: { kind: "text", cells: [0] },
    backdrop: false,
    ...(path ? { path } : {}),
    motion: { animators: [animatorFrameAt(newTextUnitAnimator("char", properties, newRangeSelector(1)), 0)], localMs: 0, durationMs: 1000 },
  });

  it("turns every letter of a straight run and carries the color share", () => {
    const pieces = composeGlyphs(run({ rotation: 90, fill: "#ff0000" }), sheet);
    expect(pieces).toHaveLength(4);
    expect(pieces.every((piece) => piece.rotation === 90 && piece.tints?.[0] === 1)).toBe(true);
  });

  it("adds the animator turn to the turn of the curve on a path", () => {
    const path = { data: "M 0 40 Q 100 -20 200 40", offset: 0.5, align: "center" as const, upright: false, reverse: false };
    const plain = composeGlyphs({ ...run({}, path), motion: undefined }, sheet);
    const turned = composeGlyphs(run({ rotation: 30 }, path), sheet);
    turned.forEach((piece, i) => expect(Math.abs(piece.rotation - (plain[i].rotation + 30))).toBeLessThan(0.5));
  });

  it("moves letters along the line with tracking", () => {
    const plain = composeGlyphs({ ...run({}), motion: undefined }, sheet);
    const spaced = composeGlyphs(run({ tracking: 5 }), sheet);
    expect(spaced.map((piece, i) => Math.round(piece.x - plain[i].x))).toEqual([0, 5, 10, 15]);
  });
});
