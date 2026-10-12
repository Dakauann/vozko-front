import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { outlineClip, type OutlineContext } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  const box = { ...newOverlayClip(newShapeLayer("rect"), 0, 3000), id: "box" };
  box.keyframes = {
    x: [
      { atMs: 0, value: 0.2, easing: "linear" },
      { atMs: 200, value: 0.5, easing: "linear" },
      { atMs: 2000, value: 0.8, easing: "linear" },
    ],
    fill: [
      { atMs: 0, color: "#000000", easing: "linear" },
      { atMs: 1000, color: "#ffffff", easing: "linear" },
    ],
  };
  d.tracks = [
    { id: "v1", kind: "visual", clips: [box] },
    { id: "v2", kind: "visual", clips: [{ ...newMediaClip("image", "m-a", 0, 3000), id: "still" }] },
  ];
  d.durationMs = 3000;
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

const full: OutlineContext = { detail: "full", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] };

function run(ops: VideoOperation[], base: VideoDocument = film()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS, videoIds);
}

const box = (d: VideoDocument) => findClip(d, "box")!.clip;

function refusal(ops: VideoOperation[]): string {
  const plan = run(ops);
  return plan.ok ? "" : plan.reason;
}

describe("ease_keys", () => {
  it("eases both sides of chosen keys with speed zero by default", () => {
    const plan = run([{ op: "ease_keys", clip_id: "box", property: "x", keys_ms: [200], side: "both" }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(box(plan.final).keyframes!.x!.map((f) => f.easing)).toEqual(["cubic-bezier(0.333,0.333,0.667,1)", "cubic-bezier(0.333,0,0.667,0.667)", "linear"]);
    expect(documentIssue("video", plan.final)).toBeNull();
  });

  it("eases only the arrival of every key of the property when no instants are given", () => {
    const plan = run([{ op: "ease_keys", clip_id: "box", property: "fill", side: "in" }]);
    expect(plan.ok && box(plan.final).keyframes!.fill![0].easing).toBe("cubic-bezier(0.333,0.333,0.667,1)");
  });

  it("sets speed and influence on a side and reads them back in the outline", () => {
    const plan = run([{ op: "ease_keys", clip_id: "box", property: "x", keys_ms: [200], side: "out", key_speed: 0.2, influence: 50 }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const keys = outlineClip(box(plan.final), full).keyframes!.x as { at_ms: number; ease_out?: { speed?: number; influence: number }; ease_in?: unknown }[];
    expect(keys[1].ease_out).toEqual({ speed: 0.2, influence: 50 });
    expect(keys[0].ease_in).toBeUndefined();
  });

  it("refuses a missing side, an unknown instant and a speed the curve cannot reach", () => {
    expect(refusal([{ op: "ease_keys", clip_id: "box", property: "x" }])).toContain("side");
    expect(refusal([{ op: "ease_keys", clip_id: "box", property: "x", side: "both", keys_ms: [700] }])).toContain("700");
    expect(refusal([{ op: "ease_keys", clip_id: "box", property: "x", side: "out", keys_ms: [0], key_speed: 50, influence: 50 }])).toContain("de -");
    expect(refusal([{ op: "ease_keys", clip_id: "still", side: "both" }])).toContain("não tem chaves");
  });
});

describe("smooth_keys", () => {
  it("makes keys smooth so the speed stays continuous, and refuses colors", () => {
    const plan = run([{ op: "smooth_keys", clip_id: "box", property: "x", keys_ms: [200], smooth: true }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const frames = box(plan.final).keyframes!.x!;
    expect(frames[1].smooth).toBe(true);
    expect(frames[0].easing).not.toBe("linear");
    expect((outlineClip(box(plan.final), full).keyframes!.x as { smooth?: boolean }[])[1].smooth).toBe(true);
    expect(refusal([{ op: "smooth_keys", clip_id: "box", property: "fill" }])).toContain("fill");
  });
});

describe("reverse_keys, time_stretch_keys and rove_keys", () => {
  it("reverses keys in place", () => {
    const plan = run([{ op: "reverse_keys", clip_id: "box", property: "x" }]);
    expect(plan.ok && box(plan.final).keyframes!.x!.map((f) => [f.atMs, f.value])).toEqual([
      [0, 0.8],
      [1800, 0.5],
      [2000, 0.2],
    ]);
  });

  it("stretches keys from the first or the last one", () => {
    const plan = run([{ op: "time_stretch_keys", clip_id: "box", property: "x", percent: 50, from_key: "last" }]);
    expect(plan.ok && box(plan.final).keyframes!.x!.map((f) => f.atMs)).toEqual([1000, 1100, 2000]);
    expect(refusal([{ op: "time_stretch_keys", clip_id: "box", property: "x" }])).toContain("percent");
  });

  it("moves middle keys so the speed is constant", () => {
    const plan = run([{ op: "rove_keys", clip_id: "box", property: "x" }]);
    expect(plan.ok && box(plan.final).keyframes!.x!.map((f) => f.atMs)).toEqual([0, 1000, 2000]);
    expect(refusal([{ op: "rove_keys", clip_id: "box", property: "fill" }])).toContain("três");
  });
});

describe("pacing in the outline and speed along a path", () => {
  const path = (d: VideoDocument) => {
    findClip(d, "box")!.clip.keyframes = {
      position: [
        { atMs: 0, x: 0.5, y: 0.2, easing: "linear", spatial: "linear" },
        { atMs: 1000, x: 0.5, y: 0.7, easing: "linear", spatial: "linear" },
      ],
    };
    return d;
  };

  it("reports the peak speed of the segment that leaves each key", () => {
    const keys = outlineClip(box(film()), { ...full, frame: { width: 1080, height: 1920 } }).keyframes!.x as { peak_speed?: number }[];
    expect(keys[0].peak_speed).toBeCloseTo(1.5, 3);
    expect(keys[1].peak_speed).toBeCloseTo(0.1667, 3);
    expect(keys[2].peak_speed).toBeUndefined();
  });

  it("sets a speed along a position path in frame heights per second", () => {
    const plan = run([{ op: "ease_keys", clip_id: "box", property: "position", keys_ms: [0], side: "out", key_speed: 1, influence: 50 }], path(film()));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const keys = outlineClip(box(plan.final), { ...full, frame: { width: 1080, height: 1920 } }).keyframes!.position as { ease_out?: { speed?: number; influence: number }; peak_speed?: number }[];
    expect(keys[0].ease_out).toEqual({ speed: 1, influence: 50 });
    expect(keys[0].peak_speed).toBeGreaterThan(0.5);
  });

  it("still refuses a speed on colors", () => {
    expect(refusal([{ op: "ease_keys", clip_id: "box", property: "fill", side: "out", keys_ms: [0], key_speed: 2 }])).toContain("fill");
  });
});
