import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, type VideoDocument } from "../document";
import { LINE_DEFAULTS } from "../line-animation";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { outlineClip } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newOverlayClip(newShapeLayer("line"), 0, 2000), id: "line" }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newShapeLayer("rect"), 0, 2000), id: "box" }] },
    { id: "v3", kind: "visual", clips: [{ ...newMediaClip("video", "m-a", 0, 2000), id: "video" }] },
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

const lineClip = (d: VideoDocument) => findClip(d, "line")!.clip;

describe("line operations", () => {
  it("turns on a travelling wave and a draw on in one batch, as a valid document", () => {
    const plan = run([
      { op: "set_line", clip_id: "line", wave_mode: "bend", wave_amount: 18, wave_length: 140, wave_speed: 1.5 },
      { op: "animate", clip_id: "line", property: "trimEnd", keys: [{ at_ms: 0, value: 0 }, { at_ms: 800, value: 1, easing: "easeOut" }] },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const clip = lineClip(plan.final);
    expect(clip.line?.wave).toEqual({ mode: "bend", amount: 18, wavelength: 140, speed: 1.5, phase: 0 });
    expect(clip.line?.trim).toEqual(LINE_DEFAULTS.trim);
    expect(clip.keyframes?.trimEnd?.map((key) => [key.atMs, key.value, key.easing])).toEqual([
      [0, 0, "easeInOut"],
      [800, 1, "easeOut"],
    ]);
    expect(documentIssue("video", plan.final)).toBeNull();
  });

  it("sets the wiggle, the taper and the sequential trim, and clears groups with their keys", () => {
    const plan = run([
      { op: "set_line", clip_id: "line", wiggle_size: 6, wiggle_detail: 3, wiggle_rate: 4, wiggle_seed: 12, taper_end_length: 0.4, taper_end_width: 0, trim_sequential: true },
      { op: "animate", clip_id: "line", property: "wiggleSize", keys: [{ at_ms: 0, value: 0 }, { at_ms: 500, value: 6 }] },
      { op: "set_line", clip_id: "line", line_clear: ["wiggle"] },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const clip = lineClip(plan.final);
    expect(clip.line?.wiggle).toBeUndefined();
    expect(clip.keyframes?.wiggleSize).toBeUndefined();
    expect(clip.line?.taper).toMatchObject({ endLength: 0.4, endWidth: 0 });
    expect(clip.line?.trim?.sequential).toBe(true);
  });

  it("writes a key at at_ms when the value is animated, and refuses without it", () => {
    const animated: VideoOperation[] = [
      { op: "set_line", clip_id: "line", wave_amount: 10 },
      { op: "animate", clip_id: "line", property: "waveAmount", keys: [{ at_ms: 0, value: 0 }, { at_ms: 1000, value: 20 }] },
    ];
    const refused = run([...animated, { op: "set_line", clip_id: "line", wave_amount: 30 }]);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toContain("at_ms");
    const keyed = run([...animated, { op: "set_line", clip_id: "line", wave_amount: 30, at_ms: 500 }]);
    expect(keyed.ok).toBe(true);
    if (keyed.ok) expect(lineClip(keyed.final).keyframes?.waveAmount?.map((key) => key.value)).toEqual([0, 30, 20]);
  });

  it("refuses layers that cannot animate a stroke, values out of range and unknown modes, explaining the rule", () => {
    const plain = run([{ op: "set_line", clip_id: "box", trim_end: 0.5 }]);
    expect(plain.ok).toBe(false);
    if (!plain.ok) expect(plain.reason).toContain("stroke_width");
    const media = run([{ op: "animate", clip_id: "video", property: "trimEnd", keys: [{ at_ms: 0, value: 0 }] }]);
    expect(media.ok).toBe(false);
    const range = run([{ op: "set_line", clip_id: "line", wave_length: 2 }]);
    expect(range.ok).toBe(false);
    if (!range.ok) expect(range.reason).toContain("wave_length");
    const mode = run([{ op: "set_line", clip_id: "line", wave_mode: "zigzag" as never }]);
    expect(mode.ok).toBe(false);
    const empty = run([{ op: "set_line", clip_id: "line" }]);
    expect(empty.ok).toBe(false);
  });

  it("reads the line back in the outline", () => {
    const plan = run([{ op: "set_line", clip_id: "line", trim_end: 0.5, wave_speed: 2, taper_start_length: 0.2 }]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const outline = outlineClip(lineClip(plan.final), { detail: "full", asset: () => undefined } as never);
    expect(outline.line).toEqual({
      trim: { start: 0, end: 0.5, offset: 0 },
      wave: { mode: "bend", amount: 12, wavelength: 120, speed: 2, phase: 0 },
      taper: { start_length: 0.2, end_length: 0.25, start_width: 0, end_width: 0, start_ease: 0, end_ease: 0 },
    });
  });
});
