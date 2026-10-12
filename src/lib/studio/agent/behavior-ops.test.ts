import { describe, expect, it } from "vitest";

import type { TrackLevels } from "../behaviors";
import { emptyVideoDocument, newMediaClip, newNullClip, type VideoDocument } from "../document";
import { visualPlan } from "../playback";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { videoOutline } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  const logo = { ...newMediaClip("image", "m-logo", 0, 4000), id: "logo", transform: { x: 0.4, y: 0.4, w: 0.2, h: 0.1, rotation: 0, opacity: 1 }, keyframes: { scale: [{ atMs: 0, value: 0.5, easing: "linear" as const }, { atMs: 400, value: 1, easing: "linear" as const }] } };
  d.tracks = [
    { id: "a", kind: "visual", clips: [logo] },
    { id: "rig-track", kind: "visual", clips: [{ ...newNullClip(0, 4000), id: "rig" }] },
    { id: "s", kind: "audio", clips: [{ ...newMediaClip("audio", "m-song", 0, 4000), id: "song" }] },
  ];
  d.durationMs = 4000;
  return d;
}

const LOUD: TrackLevels = (trackId) => (trackId === "s" ? { stepMs: 10, db: new Float32Array(401).fill(-10) } : undefined);

const CTX: VideoOpContext = {
  playheadMs: 0,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => undefined,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
  levels: () => LOUD,
};

function run(start: VideoDocument, ops: VideoOperation[], ctx: VideoOpContext = CTX) {
  return planBatch(start, ops, (current, op) => applyVideoOperation(current, op, ctx), VIDEO_ID_FIELDS, videoIds);
}

function refusal(ops: VideoOperation[], ctx: VideoOpContext = CTX): string {
  const plan = run(doc(), ops, ctx);
  expect(plan.ok).toBe(false);
  return plan.ok ? "" : plan.reason;
}

describe("Elo animates with behaviors", () => {
  it("adds a wiggle, a spin and a pulse with refs, changes and reads them back", () => {
    const plan = run(doc(), [
      { op: "add_behavior", ref: "shake", clip_id: "logo", property: "x", behavior_kind: "wiggle", behavior: { frequency: 3, amount: 0.02, seed: 11 } },
      { op: "add_behavior", clip_id: "logo", property: "rotation", behavior_kind: "drift", behavior: { rate: 45 } },
      { op: "add_behavior", clip_id: "logo", property: "scale", behavior_kind: "audioReact", audio_track_id: "s", behavior: { amount: 0.3, floor_db: -40, ceiling_db: -10 } },
      { op: "update_behavior", clip_id: "logo", behavior_id: "@shake", behavior: { amount: 0.04 } },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(documentIssue("video", plan.final)).toBeNull();
    const list = findClip(plan.final, "logo")!.clip.behaviors!;
    expect(list.map((behavior) => behavior.kind)).toEqual(["wiggle", "drift", "audioReact"]);
    expect(list[0]).toMatchObject({ amount: 0.04, frequency: 3, seed: 11 });
    expect(visualPlan(plan.final, 2000, 0)[0].transform.rotation).toBeCloseTo(90, 9);
    const outline = videoOutline(plan.final, { detail: "full", playheadMs: 0, selection: [], jobs: [], library: [], icons: [], asset: () => undefined });
    const behaviors = outline.tracks[0].clips[0].behaviors!;
    expect(behaviors[0]).toMatchObject({ kind: "wiggle", property: "x", frequency: 3, amount: 0.04, seed: 11 });
    expect(behaviors[2]).toMatchObject({ kind: "audioReact", audio_track_id: "s", floor_db: -40, ceiling_db: -10 });
  });

  it("bakes into keys with the levels Elo was given and removes a behavior", () => {
    const added = run(doc(), [{ op: "add_behavior", clip_id: "logo", property: "scale", behavior_kind: "audioReact", behavior: { amount: 0.3 } }]);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const id = findClip(added.final, "logo")!.clip.behaviors![0].id;
    const baked = run(added.final, [{ op: "bake_behavior", clip_id: "logo", behavior_id: id }]);
    expect(baked.ok).toBe(true);
    if (!baked.ok) return;
    expect(baked.notes.join(" ")).toContain("chaves lineares");
    expect(findClip(baked.final, "logo")!.clip.keyframes!.scale!.at(-1)!.value).toBeCloseTo(1.3, 6);
    const unheard = run(added.final, [{ op: "bake_behavior", clip_id: "logo", behavior_id: id }], { ...CTX, levels: undefined });
    expect(unheard.ok).toBe(false);
    const removed = run(added.final, [{ op: "remove_behavior", clip_id: "logo", behavior_id: id }]);
    expect(removed.ok && findClip(removed.final, "logo")!.clip.behaviors).toBeUndefined();
  });

  it("explains every refusal in words Elo can act on", () => {
    expect(refusal([{ op: "add_behavior", clip_id: "logo", property: "x" }])).toContain("behavior_kind");
    expect(refusal([{ op: "add_behavior", clip_id: "rig", property: "opacity", behavior_kind: "wiggle" }])).toContain("nulos aceitam");
    expect(refusal([{ op: "add_behavior", clip_id: "logo", property: "x", behavior_kind: "drift", behavior: { seed: 2 } }])).toContain("drift não usa seed");
    expect(refusal([{ op: "add_behavior", clip_id: "logo", property: "opacity", behavior_kind: "wiggle", behavior: { amount: 3 } }])).toContain("amount de wiggle em opacity vai de 0 a 1");
    expect(refusal([{ op: "add_behavior", clip_id: "logo", property: "x", behavior_kind: "loop", behavior: { mode: "bounce" as never } }])).toContain("mode deve ser um de");
    expect(refusal([{ op: "add_behavior", clip_id: "logo", property: "scale", behavior_kind: "audioReact", audio_track_id: "a" }])).toContain("faixa de som");
    expect(refusal([{ op: "add_behavior", clip_id: "ghost", property: "x", behavior_kind: "wiggle" }])).toContain("não existe");
    expect(
      refusal([
        { op: "add_behavior", clip_id: "logo", property: "x", behavior_kind: "wiggle" },
        { op: "add_behavior", clip_id: "logo", property: "x", behavior_kind: "wiggle" },
      ]),
    ).toContain("update_behavior");
    expect(refusal([{ op: "update_behavior", clip_id: "logo", behavior_id: "ghost", behavior: { amount: 0.1 } }])).toContain("não existe");
  });

  it("notes when a loop has no keys to repeat yet", () => {
    const plan = run(doc(), [{ op: "add_behavior", clip_id: "logo", property: "rotation", behavior_kind: "loop", behavior: { mode: "pingpong", side: "both" } }]);
    expect(plan.ok && plan.notes.join(" ")).toContain("duas chaves");
  });
});
