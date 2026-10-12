import { describe, expect, it } from "vitest";

import { addBehavior, bakeBehavior, bakeTimes, behaviorTrace, defaultReactTrack, draftBehavior, foreignSettings, removeBehavior, updateBehavior } from "./behavior-edit";
import { NO_LEVELS, type Behavior, type TrackLevels } from "./behaviors";
import { emptyVideoDocument, newMediaClip, newNullClip, type Clip, type VideoDocument } from "./document";
import { exportFrameMs } from "./export-encoding";
import { visualPlan } from "./playback";
import { findClip } from "./timeline";
import { documentIssue } from "./validate";

function film(clips: Clip[], locked = false): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.tracks = [
    { id: "v1", kind: "visual", clips, ...(locked ? { locked: true } : {}) },
    { id: "music", kind: "audio", clips: [newMediaClip("audio", "song", 0, 3000)] },
  ];
  doc.durationMs = 3000;
  return doc;
}

function image(extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("image", "m-1", 0, 3000), id: "c1", transform: { x: 0.5, y: 0.5, w: 0.3, h: 0.3, rotation: 0, opacity: 1 }, ...extra };
}

function behaviors(doc: VideoDocument): Behavior[] {
  return findClip(doc, "c1")?.clip.behaviors ?? [];
}

function ok<T extends { ok: boolean }>(edit: T): Extract<T, { ok: true }> {
  expect(edit.ok, JSON.stringify(edit)).toBe(true);
  return edit as Extract<T, { ok: true }>;
}

describe("drafting a behavior", () => {
  it("fills each kind with its defaults and the chosen sound track", () => {
    const doc = film([image()]);
    expect(draftBehavior("wiggle", "rotation", {}, 7, undefined)).toMatchObject({ kind: "wiggle", property: "rotation", frequency: 2, amount: 5, seed: 7 });
    expect(draftBehavior("loop", "x", { mode: "pingpong" }, 0, undefined)).toMatchObject({ mode: "pingpong", side: "out" });
    expect(draftBehavior("drift", "rotation", {}, 0, undefined)).toMatchObject({ rate: 90 });
    expect(draftBehavior("overshoot", "scale", {}, 0, undefined)).toMatchObject({ amplitude: 0.05, frequency: 4, decay: 8 });
    expect(draftBehavior("audioReact", "scale", {}, 0, defaultReactTrack(doc))).toMatchObject({ trackId: "music", amount: 0.2, floorDb: -40, ceilingDb: -10 });
    expect(draftBehavior("audioReact", "scale", {}, 0, undefined)).toBe("track");
    expect(foreignSettings("drift", { rate: 1, seed: 2 })).toEqual(["seed"]);
  });
});

describe("adding, changing and removing behaviors", () => {
  it("adds, updates and removes, keeping the document valid", () => {
    const wiggle = draftBehavior("wiggle", "x", {}, 3, undefined) as Behavior;
    const added = ok(addBehavior(film([image()]), "c1", wiggle));
    expect(behaviors(added.document)).toEqual([wiggle]);
    const changed = ok(updateBehavior(added.document, "c1", wiggle.id, { amount: 0.1, frequency: 5 }));
    expect(behaviors(changed.document)[0]).toMatchObject({ amount: 0.1, frequency: 5, seed: 3 });
    expect(documentIssue("video", changed.document)).toBeNull();
    const removed = ok(removeBehavior(changed.document, "c1", wiggle.id));
    expect(findClip(removed.document, "c1")!.clip.behaviors).toBeUndefined();
  });

  it("refuses what the clip cannot take", () => {
    const wiggle = draftBehavior("wiggle", "opacity", {}, 3, undefined) as Behavior;
    const rig: Clip = { ...newNullClip(0, 3000), id: "c1" };
    expect(addBehavior(film([rig]), "c1", wiggle)).toEqual({ ok: false, reason: "property" });
    expect(addBehavior(film([image()], true), "c1", wiggle)).toEqual({ ok: false, reason: "locked" });
    expect(addBehavior(film([image()]), "ghost", wiggle)).toEqual({ ok: false, reason: "missing" });
    const twice = ok(addBehavior(film([image()]), "c1", wiggle)).document;
    expect(addBehavior(twice, "c1", { ...wiggle, id: "other" })).toEqual({ ok: false, reason: "duplicate" });
    expect(updateBehavior(twice, "c1", wiggle.id, { rate: 2 })).toEqual({ ok: false, reason: "field" });
    expect(updateBehavior(twice, "c1", wiggle.id, { amount: 3 })).toEqual({ ok: false, reason: "invalid" });
    expect(updateBehavior(twice, "c1", "ghost", { amount: 0.1 })).toEqual({ ok: false, reason: "behaviorMissing" });
    const react = draftBehavior("audioReact", "scale", { trackId: "v1" }, 0, undefined) as Behavior;
    expect(addBehavior(film([image()]), "c1", react)).toEqual({ ok: false, reason: "track" });
  });
});

describe("baking a behavior into keys", () => {
  it("samples one key per frame of the timeline inside the clip", () => {
    const times = bakeTimes({ startMs: 10, durationMs: 100 });
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBe(100);
    expect(times).toContain(Math.round(exportFrameMs(1) - 10));
  });

  it("draws the same picture at every frame after baking", () => {
    const wiggle: Behavior = { id: "w", kind: "wiggle", property: "rotation", frequency: 3, amount: 12, seed: 5 };
    const doc = film([image({ behaviors: [wiggle] })]);
    const baked = ok(bakeBehavior(doc, "c1", "w", NO_LEVELS));
    expect(baked.absorbed).toEqual(["w"]);
    expect(baked.clamped).toBe(0);
    expect(findClip(baked.document, "c1")!.clip.behaviors).toBeUndefined();
    expect(documentIssue("video", baked.document)).toBeNull();
    for (const frame of [0, 7, 31, 66, 89]) {
      const ms = Math.round(exportFrameMs(frame));
      expect(visualPlan(baked.document, ms, 0)[0].transform.rotation).toBeCloseTo(visualPlan(doc, ms, 0)[0].transform.rotation, 4);
    }
  });

  it("takes the loop and overshoot of the property with it and leaves the others", () => {
    const keys = { x: [{ atMs: 0, value: 0.3, easing: "linear" as const }, { atMs: 500, value: 0.6, easing: "linear" as const }] };
    const list: Behavior[] = [
      { id: "l", kind: "loop", property: "x", mode: "pingpong", side: "out" },
      { id: "o", kind: "overshoot", property: "x", amplitude: 0.05, frequency: 4, decay: 8 },
      { id: "d", kind: "drift", property: "x", rate: 0.01 },
      { id: "s", kind: "drift", property: "rotation", rate: 10 },
    ];
    const doc = film([image({ keyframes: keys, behaviors: list })]);
    const baked = ok(bakeBehavior(doc, "c1", "d", NO_LEVELS));
    expect(baked.absorbed.sort()).toEqual(["d", "l", "o"]);
    expect(findClip(baked.document, "c1")!.clip.behaviors!.map((behavior) => behavior.id)).toEqual(["s"]);
    const ms = Math.round(exportFrameMs(40));
    expect(visualPlan(baked.document, ms, 0)[0].transform.x).toBeCloseTo(visualPlan(doc, ms, 0)[0].transform.x, 5);
  });

  it("refuses a curved path, a rival lane and a sound it has not heard", () => {
    const onPath = image({ keyframes: { position: [{ atMs: 0, x: 0.2, y: 0.2, easing: "linear" }, { atMs: 900, x: 0.8, y: 0.4, easing: "linear" }] }, behaviors: [{ id: "w", kind: "wiggle", property: "x", frequency: 2, amount: 0.02, seed: 1 }] });
    expect(bakeBehavior(film([onPath]), "c1", "w", NO_LEVELS)).toEqual({ ok: false, reason: "path" });
    const axes = image({ keyframes: { scaleX: [{ atMs: 0, value: 1, easing: "linear" }] }, behaviors: [{ id: "w", kind: "wiggle", property: "scale", frequency: 2, amount: 0.02, seed: 1 }] });
    expect(bakeBehavior(film([axes]), "c1", "w", NO_LEVELS)).toEqual({ ok: false, reason: "rival" });
    const react = image({ behaviors: [{ id: "r", kind: "audioReact", property: "scale", trackId: "music", amount: 0.2, floorDb: -40, ceilingDb: -10 }] });
    expect(bakeBehavior(film([react]), "c1", "r", NO_LEVELS)).toEqual({ ok: false, reason: "unheard" });
    const levels: TrackLevels = () => ({ stepMs: 10, db: new Float32Array(301).fill(-25) });
    const heard = ok(bakeBehavior(film([react]), "c1", "r", levels));
    expect(findClip(heard.document, "c1")!.clip.keyframes!.scale![0].value).toBeCloseTo(1.1, 6);
  });

  it("counts samples that had to be held inside the key range", () => {
    const doc = film([image({ behaviors: [{ id: "d", kind: "drift", property: "opacity", rate: -1 }] })]);
    const baked = ok(bakeBehavior(doc, "c1", "d", NO_LEVELS));
    expect(baked.clamped).toBeGreaterThan(0);
    expect(Math.min(...findClip(baked.document, "c1")!.clip.keyframes!.opacity!.map((key) => key.value))).toBe(0);
  });
});

describe("the behavior trace", () => {
  it("samples the keyed value with the behaviors on top", () => {
    const clip = image({ behaviors: [{ id: "d", kind: "drift", property: "rotation", rate: 30 }] });
    const trace = behaviorTrace(clip, "rotation", 3, NO_LEVELS);
    expect(trace.map((point) => point.ms)).toEqual([0, 1000, 2000, 3000]);
    expect(trace.map((point) => point.value)).toEqual([0, 30, 60, 90]);
  });
});
