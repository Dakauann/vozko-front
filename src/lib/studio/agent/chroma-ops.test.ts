import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { autoKeySamples } from "./chroma-ops";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "m-a", 0, 2000), id: "a" }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 2000), id: "t" }] },
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

const keyOf = (d: VideoDocument) => findClip(d, "a")!.clip.chromaKey;

describe("chroma key operations", () => {
  it("names the frames to sample before a batch that asks for auto", () => {
    const samples = autoKeySamples(film(), [
      { op: "set_chroma_key", clip_id: "a", chroma_preset: "auto", at_ms: 500 },
      { op: "set_chroma_key", clip_id: "a", chroma_preset: "auto" },
      { op: "set_chroma_key", clip_id: "a", chroma_preset: "auto", chroma_color: "#00ff00", at_ms: 700 },
      { op: "set_chroma_key", clip_id: "t", chroma_preset: "auto" },
      { op: "set_chroma_key", clip_id: "@new", chroma_preset: "auto" },
      { op: "set_chroma_key", clip_id: "a", chroma_preset: "blue", at_ms: 900 },
    ], 300);
    expect(samples).toEqual([
      { assetId: "m-a", sourceMs: 500, still: false },
      { assetId: "m-a", sourceMs: 300, still: false },
    ]);
  });

  it("detects the screen color for chroma_preset auto at the moment asked, and refuses when nothing was found", () => {
    const seeing: VideoOpContext = { ...ctx, keyColor: (sample) => (sample.assetId === "m-a" && sample.sourceMs === 500 ? "#30c050" : undefined) };
    const runSeeing = (ops: VideoOperation[]) => planBatch(film(), ops, (d, op) => applyVideoOperation(d, op, seeing), VIDEO_ID_FIELDS, videoIds);
    const auto = runSeeing([{ op: "set_chroma_key", clip_id: "a", chroma_preset: "auto", at_ms: 500 }]);
    expect(auto.ok && keyOf(auto.final)?.color).toBe("#30c050");
    const blind = runSeeing([{ op: "set_chroma_key", clip_id: "a", chroma_preset: "auto" }]);
    expect(blind.ok).toBe(false);
    if (!blind.ok) expect(blind.reason).toContain("chroma_color");
    const unseeing = run([{ op: "set_chroma_key", clip_id: "a", chroma_preset: "auto" }]);
    expect(unseeing.ok).toBe(false);
    const named = runSeeing([{ op: "set_chroma_key", clip_id: "a", chroma_preset: "auto", chroma_color: "#00FF00" }]);
    expect(named.ok && keyOf(named.final)?.color).toBe("#00ff00");
  });

  it("keys out a blue screen, tunes it, animates it and removes it", () => {
    const plan = run([
      { op: "set_chroma_key", clip_id: "a", chroma_preset: "blue", similarity: 0.35 },
      { op: "animate_chroma", clip_id: "a", chroma_property: "spill", keys: [{ at_ms: 0, value: 0.1 }, { at_ms: 1000, value: 0.3 }] },
      { op: "set_chroma_key", clip_id: "a", spill: 0.2, at_ms: 500 },
    ]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(keyOf(plan.final)).toMatchObject({ color: "#0099ff", similarity: 0.35 });
    expect(keyOf(plan.final)?.keyframes?.spill?.map((k) => k.atMs)).toEqual([0, 500, 1000]);
    expect(documentIssue("video", plan.final)).toBeNull();
    const removed = run([{ op: "remove_chroma_key", clip_id: "a" }], plan.final);
    expect(removed.ok && keyOf(removed.final)).toBeUndefined();
  });

  it("explains each refusal", () => {
    const cases: [VideoOperation[], string][] = [
      [[{ op: "set_chroma_key", clip_id: "t" }], "vídeo"],
      [[{ op: "set_chroma_key", clip_id: "a", chroma_color: "verde" }], "chroma_color"],
      [[{ op: "set_chroma_key", clip_id: "a", chroma_preset: "red" as never }], "chroma_preset"],
      [[{ op: "set_chroma_key", clip_id: "a", smoothness: 0 }], "smoothness"],
      [[{ op: "animate_chroma", clip_id: "a", keys: [] }], "chroma_property"],
      [[{ op: "animate_chroma", clip_id: "a", chroma_property: "spill", keys: [{ at_ms: 9000, value: 0.2 }] }], "2000"],
      [[{ op: "animate_chroma", clip_id: "a", chroma_property: "spill", keys: [{ at_ms: 0, value: 0.2 }] }, { op: "set_chroma_key", clip_id: "a", spill: 0.4 }], "at_ms"],
      [[{ op: "remove_chroma_key", clip_id: "x" }], "não existe"],
    ];
    for (const [ops, hint] of cases) {
      const plan = run(ops);
      expect(plan.ok, JSON.stringify(ops)).toBe(false);
      if (!plan.ok) expect(plan.reason).toContain(hint);
    }
  });
});
