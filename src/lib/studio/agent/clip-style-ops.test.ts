import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { outlineClip, type OutlineContext } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "m-a", 0, 2000), id: "vid" }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oferta"), 0, 2000), id: "title" }] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "m-s", 0, 2000), id: "song" }] },
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

describe("layer styles from Elo", () => {
  it("outlines a video clip, makes its glow pulse and reads both back", () => {
    const plan = run([
      { op: "update_clip", clip_id: "vid", strokes: [{ color: "#ffffff", width: 8, align: "outside" }], effects: [{ type: "outer-glow", color: "#ffd400", blur: 24 }] },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const effectId = findClip(plan.final, "vid")!.clip.effects![0].id;
    const pulsed = run([{ op: "animate_effect", clip_id: "vid", effect_property: "opacity", keys: [{ at_ms: 0, value: 0.2 }, { at_ms: 600, value: 1, easing: "easeOut" }] }], plan.final);
    expect(pulsed.ok).toBe(true);
    if (!pulsed.ok) return;
    const clip = findClip(pulsed.final, "vid")!.clip;
    expect(clip.strokes).toEqual([{ type: "solid", color: "#ffffff", opacity: 1, width: 8, align: "outside" }]);
    expect(clip.effects?.[0].keyframes?.opacity?.map((key) => [key.atMs, key.value, key.easing])).toEqual([
      [0, 0.2, "easeInOut"],
      [600, 1, "easeOut"],
    ]);
    expect(documentIssue("video", pulsed.final)).toBeNull();
    const read = outlineClip(clip, outlineCtx);
    expect(read.strokes?.[0]).toMatchObject({ color: "#ffffff", width: 8, align: "outside" });
    expect(read.effects?.[0]).toMatchObject({ id: effectId, type: "outer-glow", keyframes: { opacity: [{ at_ms: 0, value: 0.2, easing: "easeInOut" }, { at_ms: 600, value: 1, easing: "easeOut" }] } });
  });

  it("gives text fill and effect lists and keeps the keys of an effect sent again by id", () => {
    const plan = run([
      { op: "update_clip", clip_id: "title", fills: [{ color: "#ffffff" }, { type: "gradient", gradient: { from: "#ffd40000", to: "#ffd400" }, opacity: 0.6 }], effects: [{ id: "fx-a", type: "inner-shadow" }] },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const id = findClip(plan.final, "title")!.clip.layer!.effects![0].id;
    const keyed = run([{ op: "animate_effect", clip_id: "title", effect_id: id, effect_property: "x", keys: [{ at_ms: 0, value: -4 }, { at_ms: 2000, value: 4 }] }], plan.final);
    expect(keyed.ok).toBe(true);
    if (!keyed.ok) return;
    const again = run([{ op: "update_clip", clip_id: "title", effects: [{ id, color: "#330000" }] }], keyed.final);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const effect = findClip(again.final, "title")!.clip.layer!.effects![0];
    expect(effect.color).toBe("#330000");
    expect(effect.keyframes?.x).toHaveLength(2);
    expect(findClip(again.final, "title")!.clip.layer!.fills).toHaveLength(2);
  });

  it("explains each refusal", () => {
    const cases: [VideoOperation[], string][] = [
      [[{ op: "update_clip", clip_id: "vid", fills: [{ color: "#ffffff" }] }], "fills não existe"],
      [[{ op: "update_clip", clip_id: "vid", effects: [{ type: "inner-glow" }] }], "drop-shadow e outer-glow"],
      [[{ op: "update_clip", clip_id: "vid", strokes: [{ color: "#ffffff", align: "center" }] }], "silhueta"],
      [[{ op: "update_clip", clip_id: "song", effects: [{ type: "outer-glow" }] }], "audio"],
      [[{ op: "animate_effect", clip_id: "vid", effect_property: "blur", keys: [{ at_ms: 0, value: 4 }] }], "effect_id"],
      [[{ op: "update_clip", clip_id: "vid", effects: [{ type: "outer-glow" }] }, { op: "animate_effect", clip_id: "vid", effect_property: "sparkle", keys: [] }], "effect_property"],
      [[{ op: "update_clip", clip_id: "vid", effects: [{ type: "outer-glow" }] }, { op: "animate_effect", clip_id: "vid", effect_property: "opacity", keys: [{ at_ms: 0, value: 3 }] }], "de 0 a 1"],
      [[{ op: "update_clip", clip_id: "vid", effects: [{ type: "outer-glow" }] }, { op: "animate_effect", clip_id: "vid", effect_id: "nope", effect_property: "blur", keys: [{ at_ms: 0, value: 3 }] }], "nope"],
    ];
    for (const [ops, hint] of cases) {
      const plan = run(ops);
      expect(plan.ok, JSON.stringify(ops)).toBe(false);
      if (!plan.ok) expect(plan.reason).toContain(hint);
    }
  });
});
