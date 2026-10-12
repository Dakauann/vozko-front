import { describe, expect, it } from "vitest";

import { gainToDb } from "../audio-gain";
import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "../document";
import { clipLoudness, loudnessProfile, trackLoudness, type LoudnessProfile } from "../loudness";
import { findClip } from "../timeline";
import { planBatch } from "./batch";
import { applyVideoOperation, VIDEO_ID_FIELDS, type VideoOpContext, type VideoOperation } from "./video-ops";

const RATE = 8000;
const tone = (amplitude: number) => Float32Array.from({ length: RATE * 6 }, (_, i) => amplitude * Math.sin((2 * Math.PI * 1000 * i) / RATE));
const profiles = new Map<string, LoudnessProfile>([
  ["loud", loudnessProfile([tone(0.5)], RATE)],
  ["quiet", loudnessProfile([tone(0.15)], RATE)],
]);

function clip(id: string, assetId: string, startMs: number, durationMs: number, type: "audio" | "video" = "audio"): Clip {
  return { ...newMediaClip(type, assetId, startMs, durationMs), id };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [clip("a", "img", 0, 4000, "video")] },
    { id: "au", kind: "audio", clips: [clip("m1", "loud", 0, 2000), clip("m2", "quiet", 2000, 2000)] },
    { id: "fx", kind: "audio", clips: [clip("n", "missing", 0, 2000)] },
  ];
  d.durationMs = 4000;
  return d;
}

const ctx: VideoOpContext = {
  playheadMs: 0,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: (id) => (profiles.has(id) ? 6000 : undefined),
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: (id) => profiles.get(id),
};

function run(ops: VideoOperation[], base: VideoDocument = doc()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS);
}

function finalDoc(ops: VideoOperation[]): VideoDocument {
  const plan = run(ops);
  if (!plan.ok) throw new Error(plan.reason);
  return plan.final;
}

function refusal(ops: VideoOperation[]): string {
  const plan = run(ops);
  if (plan.ok) throw new Error("expected a refusal");
  return plan.reason;
}

describe("Elo pans sound", () => {
  it("pans an audio clip, keys the pan and pans a whole track", () => {
    const next = finalDoc([
      { op: "update_clip", clip_id: "m1", pan: -0.5 },
      { op: "animate", clip_id: "m2", property: "pan", keys: [{ at_ms: 0, value: -1 }, { at_ms: 2000, value: 1 }] },
      { op: "update_track", track_id: "fx", pan: 0.25 },
    ]);
    expect(findClip(next, "m1")!.clip.pan).toBe(-0.5);
    expect(findClip(next, "m2")!.clip.keyframes?.pan?.map((key) => key.value)).toEqual([-1, 1]);
    expect(next.tracks.find((track) => track.id === "fx")!.pan).toBe(0.25);
    expect(findClip(finalDoc([{ op: "update_clip", clip_id: "m1", pan: -0.5 }, { op: "update_clip", clip_id: "m1", pan: 0 }]), "m1")!.clip.pan).toBeUndefined();
  });

  it("refuses pan where there is no sound, out of range or over pan keys", () => {
    expect(refusal([{ op: "update_clip", clip_id: "a", pan: 0.5 }])).toMatch(/pan/);
    expect(refusal([{ op: "update_clip", clip_id: "m1", pan: 2 }])).toMatch(/-1 .* 1/);
    expect(refusal([{ op: "animate", clip_id: "m1", property: "pan", keys: [{ at_ms: 0, value: 0 }] }, { op: "update_clip", clip_id: "m1", pan: 0.3 }])).toMatch(/animate property pan/);
    expect(refusal([{ op: "animate", clip_id: "a", property: "pan", keys: [{ at_ms: 0, value: 0 }] }])).toMatch(/pan/);
    expect(refusal([{ op: "animate", clip_id: "m1", property: "x", keys: [{ at_ms: 0, value: 0 }] }])).toMatch(/gainDb .* pan/);
    expect(refusal([{ op: "update_track", track_id: "v1", pan: 0.5 }])).toMatch(/pan/);
    expect(refusal([{ op: "update_track", track_id: "au", pan: -3 }])).toMatch(/-1 .* 1/);
  });
});

describe("Elo crossfades sound", () => {
  it("adds an audio crossfade on an audio cut and names the audio kinds when a picture kind is asked", () => {
    const next = finalDoc([{ op: "add_transition", clip_id: "m1", transition_kind: "constantGain" }]);
    expect(next.tracks[1].transitions).toMatchObject([{ fromClipId: "m1", toClipId: "m2", kind: "constantGain", durationMs: 1000 }]);
    expect(refusal([{ op: "add_transition", clip_id: "m1", transition_kind: "dissolve" }])).toMatch(/constantPower, constantGain/);
  });
});

describe("Elo normalizes loudness", () => {
  it("brings each clip to the target and reports what it measured", () => {
    const plan = run([{ op: "normalize_loudness", clip_ids: ["m1", "m2"], target_lufs: -16 }]);
    if (!plan.ok) throw new Error(plan.reason);
    for (const id of ["m1", "m2"]) {
      const found = findClip(plan.final, id)!.clip;
      expect(clipLoudness(profiles.get(found.assetId!)!, found)! + gainToDb(found.volume)).toBeCloseTo(-16, 1);
    }
    expect(plan.notes.join(" ")).toMatch(/m1: medido .* LUFS, ganho .* dB/);
    const capped = run([{ op: "normalize_loudness", clip_id: "m2", target_lufs: -5 }]);
    expect(capped.ok && capped.notes.join(" ")).toMatch(/m2: .*chegou ao máximo/);
  });

  it("normalizes a whole track through its gain", () => {
    const next = finalDoc([{ op: "normalize_loudness", track_id: "au", target_lufs: -23 }]);
    expect(trackLoudness(next, "au", (id) => profiles.get(id))! + next.tracks[1].gainDb!).toBeCloseTo(-23, 0);
  });

  it("refuses without a target, outside the target range or when the sound is not measured", () => {
    expect(refusal([{ op: "normalize_loudness", clip_id: "m1" }])).toMatch(/target_lufs/);
    expect(refusal([{ op: "normalize_loudness", clip_id: "m1", target_lufs: 0 }])).toMatch(/-40 .* -5/);
    expect(refusal([{ op: "normalize_loudness", track_id: "fx", target_lufs: -14 }])).toMatch(/medir/);
    expect(refusal([{ op: "normalize_loudness", clip_id: "a", target_lufs: -14 }])).toMatch(/áudio/);
    expect(refusal([{ op: "normalize_loudness", target_lufs: -14 }])).toMatch(/clip_ids|track_id/);
  });
});
