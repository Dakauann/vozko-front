import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newOverlayClip, newShapeLayer, type Clip, type VideoDocument } from "./document";
import { LINE_DEFAULTS } from "./line-animation";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { documentIssue } from "./validate";

function film(clip: Partial<Clip>, layer = newShapeLayer("line")): VideoDocument {
  const doc = emptyVideoDocument("square");
  const base = { ...newOverlayClip(layer, 0, 1000, { x: 0.5, y: 0.5, w: 0.5, h: 0.1, rotation: 0, opacity: 1 }), id: "c-line" };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...base, ...clip }] }];
  doc.durationMs = 1000;
  return doc;
}

const drawOn: Partial<Clip> = {
  line: { trim: LINE_DEFAULTS.trim },
  keyframes: {
    trimEnd: [
      { atMs: 0, value: 0, easing: "linear" },
      { atMs: 1000, value: 1, easing: "linear" },
    ],
  },
};

function nodeAt(doc: VideoDocument, ms: number) {
  return videoScene(doc, visualPlan(doc, ms)).nodes[0];
}

describe("line animation in playback and the scene", () => {
  it("is a valid document that the strict decoder keeps", () => {
    expect(documentIssue("video", film({ ...drawOn, line: { ...LINE_DEFAULTS, trim: { ...LINE_DEFAULTS.trim, sequential: true } } }))).toBeNull();
    const broken = film(drawOn) as unknown as { tracks: { clips: { line: Record<string, unknown> }[] }[] };
    broken.tracks[0].clips[0].line = { trim: { ...LINE_DEFAULTS.trim, extra: 1 } };
    expect(documentIssue("video", broken as unknown as VideoDocument)).not.toBeNull();
  });

  it("resolves the line at the playhead for the renderer", () => {
    const node = nodeAt(film(drawOn), 500);
    expect(node.line?.resolved.trim?.end).toBeCloseTo(0.5);
    expect(node.line?.color).toBe("#111111");
    expect(node.line?.fill).toBe(false);
  });

  it("rasterizes the layer without its stroke, padded for the line, and keeps that raster across frames", () => {
    const early = nodeAt(film(drawOn), 100);
    const late = nodeAt(film(drawOn), 900);
    expect(early.source.kind).toBe("raster");
    if (early.source.kind !== "raster" || late.source.kind !== "raster") return;
    expect(early.source.layer.stroke).toBeUndefined();
    expect(early.source.key).toBe(late.source.key);
    expect(early.line?.key).not.toBe(late.line?.key);
    expect(nodeAt(film(drawOn), 100).line?.key).toBe(early.line?.key);
  });

  it("draws the stroke color keys itself instead of mixing rasters", () => {
    const keyed = film({
      ...drawOn,
      keyframes: {
        ...drawOn.keyframes,
        stroke: [
          { atMs: 0, color: "#000000", easing: "linear" },
          { atMs: 1000, color: "#ffffff", easing: "linear" },
        ],
      },
    });
    const node = nodeAt(keyed, 500);
    expect(node.mix).toBeUndefined();
    expect(node.line?.color).not.toBe("#000000");
    expect(node.line?.color).not.toBe("#ffffff");
  });

  it("keeps the fill of a closed shape in the raster under the line", () => {
    const ring = { ...newShapeLayer("ellipse"), stroke: "#ff0000", strokeWidth: 6 };
    const node = nodeAt(film(drawOn, ring), 500);
    expect(node.line?.fill).toBe(true);
    expect(node.source.kind === "raster" && node.source.layer.fill).toBe(ring.fill);
  });

  it("accepts the same line document the backend contract test reads", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_line.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
    const node = nodeAt(raw as VideoDocument, 450);
    expect(node.line?.resolved.wave?.amount).toBe(0);
    expect(node.line?.resolved.wiggle?.seed).toBe(0);
  });

  it("leaves clips without line animation as they were", () => {
    expect(nodeAt(film({}), 500).line).toBeUndefined();
  });
});
