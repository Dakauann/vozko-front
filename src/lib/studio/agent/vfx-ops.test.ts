import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "m-a", 0, 3000), id: "a" }] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "m-s", 0, 3000), id: "s" }] },
  ];
  d.durationMs = 3000;
  return d;
}

const ctx: VideoOpContext = {
  playheadMs: 400,
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

function reason(ops: VideoOperation[]): string {
  const plan = run(ops);
  if (plan.ok) throw new Error("expected a refusal");
  return plan.reason;
}

describe("vfx operations", () => {
  it("adds an effect clip above the picture and tunes its only effect without naming it", () => {
    const plan = run([
      { op: "add_effect_clip", ref: "fx", vfx_kind: "lightLeak", at_ms: 500, duration_ms: 1500, vfx_seed: 42, vfx_params: { amount: 0.5, color: "#ffcc00" } },
      { op: "update_vfx", clip_id: "@fx", vfx_params: { size: 1.2 } },
      { op: "animate_vfx", clip_id: "@fx", vfx_property: "amount", keys: [{ at_ms: 0, value: 0 }, { at_ms: 600, value: 0.8 }] },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const id = plan.created.fx[0];
    const found = findClip(plan.final, id)!;
    expect(plan.final.tracks.indexOf(found.track)).toBeGreaterThan(0);
    expect(found.clip).toMatchObject({ type: "effect", startMs: 500, durationMs: 1500 });
    expect(found.clip.vfx?.[0]).toMatchObject({ kind: "lightLeak", seed: 42, params: { amount: 0.5, size: 1.2 }, colors: { color: "#ffcc00" } });
    expect(found.clip.vfx?.[0].keyframes?.amount?.map((key) => [key.atMs, key.value, key.easing])).toEqual([
      [0, 0, "easeInOut"],
      [600, 0.8, "easeInOut"],
    ]);
    expect(documentIssue("video", plan.final)).toBeNull();
  });

  it("adds effects to a clip, reorders, hides and removes them by id", () => {
    const plan = run([
      { op: "add_vfx", ref: "grain", clip_id: "a", vfx_kind: "grain" },
      { op: "add_vfx", ref: "edge", clip_id: "a", vfx_kind: "vignette", vfx_params: { amount: 0.3 } },
      { op: "move_vfx", clip_id: "a", vfx_id: "@edge", to_index: 0 },
      { op: "update_vfx", clip_id: "a", vfx_id: "@grain", vfx_hidden: true },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const list = findClip(plan.final, "a")!.clip.vfx ?? [];
    expect(list.map((vfx) => vfx.kind)).toEqual(["vignette", "grain"]);
    expect(list[1].hidden).toBe(true);
    expect(Number.isInteger(list[0].seed)).toBe(true);
    const removed = run([{ op: "remove_vfx", clip_id: "a", vfx_id: list[0].id }], plan.final);
    if (!removed.ok) throw new Error(removed.reason);
    expect(findClip(removed.final, "a")!.clip.vfx?.map((vfx) => vfx.kind)).toEqual(["grain"]);
  });

  it("writes a key at a moment when the value already moves", () => {
    const plan = run([
      { op: "add_vfx", ref: "g", clip_id: "a", vfx_kind: "grain" },
      { op: "animate_vfx", clip_id: "a", vfx_id: "@g", vfx_property: "amount", keys: [{ at_ms: 0, value: 0.1 }, { at_ms: 2000, value: 0.5 }] },
      { op: "update_vfx", clip_id: "a", vfx_id: "@g", vfx_params: { amount: 0.9 }, at_ms: 1000 },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(findClip(plan.final, "a")!.clip.vfx?.[0].keyframes?.amount?.map((key) => key.atMs)).toEqual([0, 1000, 2000]);
  });

  it("explains refusals in words", () => {
    expect(reason([{ op: "add_vfx", clip_id: "s", vfx_kind: "grain" }])).toContain("áudio");
    expect(reason([{ op: "add_vfx", clip_id: "a", vfx_kind: "smoke" as never }])).toContain("grain");
    expect(reason([{ op: "add_vfx", clip_id: "a", vfx_kind: "grain", vfx_params: { ghosts: 0.2 } }])).toContain("ghosts");
    expect(reason([{ op: "add_vfx", clip_id: "a", vfx_kind: "grain", vfx_params: { amount: 3 } }])).toContain("0 a 1");
    expect(reason([{ op: "add_vfx", ref: "g", clip_id: "a", vfx_kind: "grain" }, { op: "add_vfx", clip_id: "a", vfx_kind: "glitch" }, { op: "update_vfx", clip_id: "a", vfx_params: { amount: 0.2 } }])).toContain("vfx_id");
    expect(reason([{ op: "add_vfx", ref: "p", clip_id: "a", vfx_kind: "particles" }, { op: "animate_vfx", clip_id: "a", vfx_id: "@p", vfx_property: "speed", keys: [{ at_ms: 0, value: 1 }] }])).toContain("speed");
    expect(reason([{ op: "add_vfx", ref: "g", clip_id: "a", vfx_kind: "grain" }, { op: "animate_vfx", clip_id: "a", vfx_id: "@g", vfx_property: "amount", keys: [{ at_ms: 0, value: 0.1 }] }, { op: "update_vfx", clip_id: "a", vfx_id: "@g", vfx_params: { amount: 0.2 } }])).toContain("at_ms");
  });
});
