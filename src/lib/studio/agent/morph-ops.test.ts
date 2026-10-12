import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, newTextLayer, type VideoDocument } from "../document";
import { morphFramesOf } from "../keyframes";
import { newMask } from "../masks";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { outlineClip, type OutlineContext } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

const SQUARE = "M0 0 L1 0 L1 1 L0 1 Z";
const STAR = "M0.5 0 L0.62 0.35 L1 0.35 L0.69 0.57 L0.81 0.91 L0.5 0.7 L0.19 0.91 L0.31 0.57 L0 0.35 L0.38 0.35 Z";

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "m-a", 0, 2000), id: "plate", masks: [{ ...newMask("path", "blob"), path: SQUARE }, newMask("ellipse", "round")] }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newShapeLayer("rect"), 0, 2000), id: "box" }] },
    { id: "v3", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 2000), id: "word" }] },
  ];
  d.durationMs = 2000;
  return d;
}

const ctx: VideoOpContext = {
  playheadMs: 0,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => 10_000,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
};

const outlineCtx: OutlineContext = { detail: "full", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] };

function run(ops: VideoOperation[], base: VideoDocument = film()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS, videoIds);
}

describe("path keys from Elo", () => {
  it("turns a rectangle into a path, morphs it into a star with a chosen first vertex and reads it back", () => {
    const plan = run([
      {
        op: "animate",
        clip_id: "box",
        property: "path",
        keys: [
          { at_ms: 0, path: SQUARE, easing: "easeInOut" },
          { at_ms: 800, path: STAR, first_vertex: 2 },
        ],
      },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const clip = findClip(plan.final, "box")!.clip;
    expect(clip.layer?.shape).toBe("path");
    expect(morphFramesOf(clip.keyframes).map((key) => [key.atMs, key.easing, key.firstVertex])).toEqual([
      [0, "easeInOut", undefined],
      [800, "easeInOut", { x: 1, y: 0.35 }],
    ]);
    expect(documentIssue("video", plan.final)).toBeNull();
    const read = outlineClip(clip, outlineCtx);
    expect(read.keyframes?.path).toEqual([
      expect.objectContaining({ at_ms: 0, path: SQUARE, easing: "easeInOut" }),
      expect.objectContaining({ at_ms: 800, path: STAR, first_vertex: 2 }),
    ]);
  });

  it("morphs a path mask and lists its path keys", () => {
    const plan = run([{ op: "animate_mask", clip_id: "plate", mask_id: "blob", mask_property: "path", keys: [{ at_ms: 0, path: SQUARE }, { at_ms: 1500, path: STAR, first_vertex: 0 }] }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const clip = findClip(plan.final, "plate")!.clip;
    expect(clip.masks?.[0].keyframes?.path?.map((key) => key.atMs)).toEqual([0, 1500]);
    expect(documentIssue("video", plan.final)).toBeNull();
    const read = outlineClip(clip, outlineCtx);
    expect(read.masks?.[0].animated).toContain("path");
    expect(read.masks?.[0].keyframes?.path).toEqual([expect.objectContaining({ at_ms: 0, path: SQUARE }), expect.objectContaining({ at_ms: 1500, first_vertex: 0 })]);
  });

  it("explains each refusal", () => {
    const cases: [VideoOperation[], string][] = [
      [[{ op: "animate", clip_id: "word", property: "path", keys: [{ at_ms: 0, path: SQUARE }] }], "formas"],
      [[{ op: "animate", clip_id: "box", property: "path", keys: [{ at_ms: 0, value: 1 }] }], "precisam de path"],
      [[{ op: "animate", clip_id: "box", property: "path", keys: [{ at_ms: 0, path: "Q1" }] }], "caminho SVG"],
      [[{ op: "animate", clip_id: "box", property: "path", keys: [{ at_ms: 0, path: SQUARE, first_vertex: 9 }] }], "4 pontos"],
      [[{ op: "animate", clip_id: "box", property: "path", keys: [{ at_ms: 5000, path: SQUARE }] }], "2000"],
      [[{ op: "animate_mask", clip_id: "plate", mask_id: "round", mask_property: "path", keys: [{ at_ms: 0, path: SQUARE }] }], "ellipse"],
      [[{ op: "animate_mask", clip_id: "plate", mask_id: "blob", mask_property: "path", keys: [{ at_ms: 0, path: "Z" }] }], "path"],
    ];
    for (const [ops, hint] of cases) {
      const plan = run(ops);
      expect(plan.ok, JSON.stringify(ops)).toBe(false);
      if (!plan.ok) expect(plan.reason).toContain(hint);
    }
  });
});
