import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  arrivalSpeed,
  behavedValue,
  behaviorsIssue,
  levelDbAt,
  loopedValue,
  NO_LEVELS,
  overshootOffset,
  reactShare,
  wiggleOffset,
  type Behavior,
  type TrackLevels,
} from "./behaviors";
import { placementAt } from "./clip-placement";
import { canvasAspect, emptyVideoDocument, newMediaClip, newNullClip, type Clip, type VideoDocument } from "./document";
import { valueAt, type Keyframe } from "./keyframes";
import { clipLookup, frameAt, worldPlacementAt } from "./parenting";
import { visualPlan } from "./playback";
import { removeTrack, splitClip } from "./timeline";
import { copyClips, pasteClips } from "./tools";
import { documentIssue } from "./validate";

const KEYS: Keyframe[] = [
  { atMs: 1000, value: 0, easing: "linear" },
  { atMs: 2000, value: 10, easing: "linear" },
];

function film(clips: Clip[], audio: Clip[] = []): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.tracks = [
    { id: "v1", kind: "visual", clips },
    { id: "music", kind: "audio", clips: audio },
  ];
  doc.durationMs = 6000;
  return doc;
}

function image(behaviors: Behavior[], extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("image", "m-1", 0, 6000), id: "c1", behaviors, ...extra };
}

const wiggle = (extra: Partial<Behavior> = {}): Behavior => ({ id: "w", kind: "wiggle", property: "x", frequency: 2, amount: 0.05, seed: 9, ...extra }) as Behavior;

describe("the behavior contract", () => {
  it("accepts the shared fixture", () => {
    const raw = JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_behaviors.json"), "utf8"));
    expect(documentIssue("video", raw)).toBeNull();
  });

  it("refuses out of range values, unknown kinds, foreign fields and repeats", () => {
    const bad: [Behavior[], string][] = [
      [[wiggle({ frequency: 0 } as Partial<Behavior>)], "out_of_range"],
      [[wiggle({ amount: 4 } as Partial<Behavior>)], "out_of_range"],
      [[wiggle({ seed: 1.5 } as Partial<Behavior>)], "invalid"],
      [[{ ...wiggle(), kind: "spin" } as unknown as Behavior], "unknown"],
      [[{ ...wiggle(), property: "gainDb" } as unknown as Behavior], "unknown"],
      [[{ ...wiggle(), rate: 2 } as unknown as Behavior], "invalid"],
      [[{ id: "l", kind: "loop", property: "x", mode: "bounce", side: "out" } as unknown as Behavior], "unknown"],
      [[{ id: "d", kind: "drift", property: "rotation", rate: 8000 }], "out_of_range"],
      [[{ id: "o", kind: "overshoot", property: "scale", amplitude: 2, frequency: 3, decay: 5 }], "out_of_range"],
      [[{ id: "r", kind: "audioReact", property: "scale", trackId: "music", amount: 0.1, floorDb: -10, ceilingDb: -20 }], "out_of_range"],
      [[wiggle(), wiggle({ id: "w2" })], "duplicate"],
      [[wiggle({ offsetMs: -1 })], "out_of_range"],
    ];
    for (const [behaviors, code] of bad) expect(documentIssue("video", film([image(behaviors)]))?.code, JSON.stringify(behaviors)).toBe(code);
  });

  it("keeps nulls to placement and refuses sound and effect clips", () => {
    const rig = { ...newNullClip(0, 6000), id: "n" };
    expect(documentIssue("video", film([{ ...rig, behaviors: [wiggle()] }]))).toBeNull();
    expect(documentIssue("video", film([{ ...rig, behaviors: [wiggle({ property: "opacity" })] }]))?.code).toBe("invalid");
    expect(behaviorsIssue({ type: "audio", behaviors: [wiggle()] })).toBe("invalid");
    expect(behaviorsIssue({ type: "effect", behaviors: [wiggle()] })).toBe("invalid");
  });

  it("needs the reacting track to be a sound track of the project", () => {
    const react: Behavior = { id: "r", kind: "audioReact", property: "scale", trackId: "music", amount: 0.2, floorDb: -40, ceilingDb: -10 };
    expect(documentIssue("video", film([image([react])]))).toBeNull();
    expect(documentIssue("video", film([image([{ ...react, trackId: "v1" }])]))?.code).toBe("invalid");
    expect(documentIssue("video", film([image([{ ...react, trackId: "ghost" }])]))?.code).toBe("invalid");
  });
});

describe("evaluating behaviors", () => {
  it("gives the same value for the same moment and stays within the amount", () => {
    const behavior = wiggle() as Extract<Behavior, { kind: "wiggle" }>;
    const samples = Array.from({ length: 200 }, (_, i) => wiggleOffset(behavior, i * 37));
    expect(samples).toEqual(Array.from({ length: 200 }, (_, i) => wiggleOffset(behavior, i * 37)));
    expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(0.05);
    expect(new Set(samples.map((value) => value.toFixed(6))).size).toBeGreaterThan(100);
    expect(wiggleOffset({ ...behavior, seed: 10 }, 500)).not.toBe(wiggleOffset(behavior, 500));
    expect(wiggleOffset({ ...behavior, property: "y" }, 500)).not.toBe(wiggleOffset(behavior, 500));
  });

  it("adds the offsets of every behavior to the keyed value", () => {
    const clip = image([wiggle(), { id: "d", kind: "drift", property: "x", rate: 0.1 }], { keyframes: { x: [{ atMs: 0, value: 0.2, easing: "linear" }, { atMs: 4000, value: 0.6, easing: "linear" }] } });
    const keyed = valueAt(clip.keyframes!.x!, 1500);
    expect(behavedValue(clip, "x", keyed, 1500)).toBeCloseTo(keyed + wiggleOffset(clip.behaviors![0] as Extract<Behavior, { kind: "wiggle" }>, 1500) + 0.15, 12);
    expect(behavedValue(clip, "y", 0.4, 1500)).toBe(0.4);
  });

  it("loops keys in all four modes on either side", () => {
    expect(loopedValue(KEYS, { mode: "cycle", side: "out" }, 2500)).toBeCloseTo(5, 9);
    expect(loopedValue(KEYS, { mode: "cycle", side: "out" }, 500)).toBeNull();
    expect(loopedValue(KEYS, { mode: "cycle", side: "in" }, 500)).toBeCloseTo(5, 9);
    expect(loopedValue(KEYS, { mode: "cycle", side: "both" }, 1500)).toBeNull();
    expect(loopedValue(KEYS, { mode: "pingpong", side: "out" }, 2250)).toBeCloseTo(7.5, 9);
    expect(loopedValue(KEYS, { mode: "pingpong", side: "out" }, 3250)).toBeCloseTo(2.5, 9);
    expect(loopedValue(KEYS, { mode: "pingpong", side: "in" }, 750)).toBeCloseTo(2.5, 9);
    expect(loopedValue(KEYS, { mode: "offset", side: "out" }, 3500)).toBeCloseTo(25, 9);
    expect(loopedValue(KEYS, { mode: "offset", side: "in" }, 500)).toBeCloseTo(-5, 9);
    expect(loopedValue(KEYS, { mode: "continue", side: "out" }, 3000)).toBeCloseTo(20, 6);
    expect(loopedValue(KEYS, { mode: "continue", side: "in" }, 0)).toBeCloseTo(-10, 6);
    expect(loopedValue(KEYS.slice(0, 1), { mode: "cycle", side: "both" }, 3000)).toBeNull();
  });

  it("bounces after a key by the arriving speed and settles", () => {
    const keys: Keyframe[] = [
      { atMs: 0, value: 0, easing: "linear" },
      { atMs: 500, value: 1, easing: "linear" },
    ];
    const settle = { amplitude: 0.05, frequency: 4, decay: 8 };
    expect(arrivalSpeed(keys, 1)).toBeCloseTo(2, 6);
    expect(overshootOffset(keys, settle, 250)).toBe(0);
    expect(overshootOffset(keys, settle, 500)).toBeCloseTo(0, 12);
    expect(overshootOffset(keys, settle, 562.5)).toBeCloseTo((2 * 0.05) / Math.exp(0.5), 6);
    expect(Math.abs(overshootOffset(keys, settle, 2500))).toBeLessThan(1e-7);
    expect(overshootOffset([{ ...keys[0], easing: "hold" }, keys[1]], settle, 562.5)).toBe(0);
  });

  it("follows the loudness of the sound track and stays still without it", () => {
    const db = new Float32Array([-90, -40, -25, -10]);
    const levels: TrackLevels = (trackId) => (trackId === "music" ? { stepMs: 10, db } : undefined);
    expect(levelDbAt({ stepMs: 10, db }, 15)).toBeCloseTo(-32.5, 6);
    expect(levelDbAt({ stepMs: 10, db }, 99)).toBe(-90);
    expect(reactShare({ floorDb: -40, ceilingDb: -10 }, -25)).toBeCloseTo(0.5, 9);
    const clip = image([{ id: "r", kind: "audioReact", property: "scale", trackId: "music", amount: 0.4, floorDb: -40, ceilingDb: -10 }], { startMs: 10 });
    expect(behavedValue(clip, "scale", 1, 10, levels)).toBeCloseTo(1.2, 6);
    expect(behavedValue(clip, "scale", 1, 10, NO_LEVELS)).toBe(1);
  });

  it("keeps opacity, blur and scale inside what can be drawn", () => {
    const clip = image([
      { id: "o", kind: "drift", property: "opacity", rate: 1 },
      { id: "s", kind: "drift", property: "scale", rate: -4 },
    ]);
    expect(behavedValue(clip, "opacity", 0.8, 1000)).toBe(1);
    expect(behavedValue(clip, "scale", 1, 1000)).toBe(0);
  });
});

describe("behaviors in the picture", () => {
  it("leaves clips without behaviors exactly as before", () => {
    const doc = film([image([], { behaviors: undefined, transform: { x: 0.3, y: 0.6, w: 0.2, h: 0.2, rotation: 10, opacity: 1 } })]);
    const clip = doc.tracks[0].clips[0];
    expect(visualPlan(doc, 700, 0)[0].transform).toEqual(placementAt(clip, 700, canvasAspect(doc)));
  });

  it("moves the drawn clip by the behavior at each frame, the same on every call", () => {
    const doc = film([image([{ id: "d", kind: "drift", property: "rotation", rate: 90 }, { id: "b", kind: "drift", property: "blur", rate: 4 }])]);
    const first = visualPlan(doc, 2000, 0)[0];
    expect(first.transform.rotation).toBeCloseTo(180, 9);
    expect(first.blurPx).toBeCloseTo(8, 9);
    expect(visualPlan(doc, 2000, 0)[0]).toEqual(first);
  });

  it("carries a parent's behavior to its children", () => {
    const rig: Clip = { ...newNullClip(0, 6000), id: "rig", behaviors: [{ id: "d", kind: "drift", property: "x", rate: 0.05 }] };
    const child: Clip = { ...image([]), id: "kid", behaviors: undefined, parentId: "rig", transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } };
    const doc = film([child]);
    doc.tracks.splice(1, 0, { id: "v2", kind: "visual", clips: [rig] });
    const lookup = clipLookup(doc);
    expect(frameAt(lookup, rig, 2000, canvasAspect(doc)).x).toBeCloseTo(0.6, 9);
    expect(worldPlacementAt(lookup, child, 2000, canvasAspect(doc)).x).toBeCloseTo(0.6, 9);
  });

  it("keeps a drift continuous across a cut", () => {
    const doc = film([image([{ id: "d", kind: "drift", property: "rotation", rate: 30 }])]);
    const before = visualPlan(doc, 3000, 0)[0].transform.rotation;
    const cut = splitClip(doc, "c1", 2000).document;
    expect(cut.tracks[0].clips[1].behaviors![0].offsetMs).toBe(2000);
    expect(visualPlan(cut, 3000, 0)[0].transform.rotation).toBeCloseTo(before, 9);
  });

  it("drops reactions to a removed sound track and to tracks missing on paste", () => {
    const react: Behavior = { id: "r", kind: "audioReact", property: "scale", trackId: "music", amount: 0.2, floorDb: -40, ceilingDb: -10 };
    const doc = film([image([react, wiggle()])]);
    const gone = removeTrack(doc, "music");
    expect(gone.tracks[0].clips[0].behaviors).toEqual([wiggle()]);
    expect(documentIssue("video", gone)).toBeNull();
    const payload = copyClips(doc, ["c1"])!;
    const elsewhere = film([]);
    elsewhere.tracks = elsewhere.tracks.filter((track) => track.kind === "visual");
    const pasted = pasteClips(elsewhere, payload, 0, "overwrite");
    expect(pasted).not.toBeNull();
    expect(pasted!.document.tracks[0].clips[0].behaviors?.map((behavior) => behavior.kind)).toEqual(["wiggle"]);
  });
});
