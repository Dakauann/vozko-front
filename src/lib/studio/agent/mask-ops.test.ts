import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "m-a", 0, 2000), id: "a" }] },
    { id: "v2", kind: "visual", clips: [{ ...newMediaClip("image", "m-b", 0, 2000), id: "b" }] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "m-s", 0, 2000), id: "s" }] },
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

function run(ops: VideoOperation[], base: VideoDocument = film()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS, videoIds);
}

const masksOf = (d: VideoDocument, clipId = "a") => findClip(d, clipId)!.clip.masks ?? [];

describe("mask operations", () => {
  it("adds a soft circle, animates it in and reads the result back as a valid document", () => {
    const plan = run([
      { op: "add_mask", ref: "m", clip_id: "a", mask_shape: "ellipse", w: 0.6, h: 0.4, feather: 0.1 },
      { op: "animate_mask", clip_id: "a", mask_id: "@m", mask_property: "opacity", keys: [{ at_ms: 500, value: 0 }, { at_ms: 900, value: 1, easing: "easeOut" }] },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const [mask] = masksOf(plan.final);
    expect(mask).toMatchObject({ shape: "ellipse", w: 0.6, h: 0.4, feather: 0.1, mode: "add" });
    expect(mask.keyframes?.opacity?.map((k) => [k.atMs, k.value, k.easing])).toEqual([
      [500, 0, "easeInOut"],
      [900, 1, "easeOut"],
    ]);
    expect(documentIssue("video", plan.final)).toBeNull();
  });

  it("updates, reorders and removes masks, and writes a key at a moment when the value is animated", () => {
    const plan = run([
      { op: "add_mask", ref: "one", clip_id: "a", mask_shape: "rectangle" },
      { op: "add_mask", ref: "two", clip_id: "a", mask_shape: "star", mask_mode: "subtract", points: 6 },
      { op: "animate_mask", clip_id: "a", mask_id: "@one", mask_property: "x", keys: [{ at_ms: 0, value: 0.2 }, { at_ms: 1000, value: 0.8 }] },
      { op: "update_mask", clip_id: "a", mask_id: "@one", x: 0.5, at_ms: 500, invert: true, roundness: 0.2 },
      { op: "move_mask", clip_id: "a", mask_id: "@two", to_index: 0 },
      { op: "update_mask", clip_id: "a", mask_id: "@two", mask_shape: "heart" },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const [first, second] = masksOf(plan.final);
    expect(first).toMatchObject({ shape: "heart", mode: "subtract" });
    expect(first.points).toBeUndefined();
    expect(second.keyframes?.x?.map((k) => k.atMs)).toEqual([0, 500, 1000]);
    expect(second).toMatchObject({ invert: true, roundness: 0.2 });
    const removed = run([{ op: "add_mask", ref: "m", clip_id: "a", mask_shape: "ellipse" }, { op: "remove_mask", clip_id: "a", mask_id: "@m" }]);
    expect(removed.ok && findClip(removed.final, "a")!.clip.masks).toBeUndefined();
  });

  it("explains each refusal", () => {
    const cases: [VideoOperation[], string][] = [
      [[{ op: "add_mask", clip_id: "s", mask_shape: "ellipse" }], "áudio"],
      [[{ op: "add_mask", clip_id: "a" }], "mask_shape"],
      [[{ op: "add_mask", clip_id: "a", mask_shape: "blob" as never }], "mask_shape"],
      [[{ op: "add_mask", clip_id: "a", mask_shape: "ellipse", feather: 2 }], "feather"],
      [[{ op: "add_mask", clip_id: "a", mask_shape: "ellipse", points: 5 }], "points"],
      [[{ op: "update_mask", clip_id: "a", mask_id: "nope", x: 0.1 }], "nope"],
      [[{ op: "add_mask", ref: "m", clip_id: "a", mask_shape: "ellipse" }, { op: "animate_mask", clip_id: "a", mask_id: "@m", keys: [] }], "mask_property"],
      [[{ op: "add_mask", ref: "m", clip_id: "a", mask_shape: "ellipse" }, { op: "animate_mask", clip_id: "a", mask_id: "@m", mask_property: "x", keys: [{ at_ms: 5000, value: 0.1 }] }], "2000"],
      [[{ op: "add_mask", ref: "m", clip_id: "a", mask_shape: "ellipse" }, { op: "animate_mask", clip_id: "a", mask_id: "@m", mask_property: "x", keys: [{ at_ms: 0, value: 0.1 }] }, { op: "update_mask", clip_id: "a", mask_id: "@m", x: 0.3 }], "at_ms"],
    ];
    for (const [ops, hint] of cases) {
      const plan = run(ops);
      expect(plan.ok, JSON.stringify(ops)).toBe(false);
      if (!plan.ok) expect(plan.reason).toContain(hint);
    }
  });

  it("turns a clip into a matte through update_clip", () => {
    const plan = run([{ op: "update_clip", clip_id: "b", matte: true }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(findClip(plan.final, "b")!.clip.matte).toBe(true);
    const off = run([{ op: "update_clip", clip_id: "b", matte: false }], plan.final);
    expect(off.ok && findClip(off.final, "b")!.clip.matte).toBeUndefined();
    const sound = run([{ op: "update_clip", clip_id: "s", matte: true }]);
    expect(sound.ok).toBe(false);
  });
});
