import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newNullClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { outlineClip, videoOutline, type OutlineContext } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, type VideoOpContext, type VideoOperation } from "./video-ops";

function clip(id: string, type: "image" | "audio" = "image"): Clip {
  return { ...newMediaClip(type, `m-${id}`, 0, 2000), id };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [clip("p")] },
    { id: "v2", kind: "visual", clips: [{ ...newNullClip(0, 2000), id: "n" }] },
    { id: "v3", kind: "visual", clips: [{ ...newOverlayClip({ ...newTextLayer("Oi"), id: "l-t" }, 0, 2000), id: "t" }] },
    { id: "au", kind: "audio", clips: [clip("s", "audio")] },
  ];
  d.durationMs = 2000;
  return d;
}

const ctx: VideoOpContext = {
  playheadMs: 500,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => 10_000,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: () => undefined,
};

const outlineCtx: OutlineContext = { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] };

function run(ops: VideoOperation[], base: VideoDocument = doc()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS);
}

function final(ops: VideoOperation[]): VideoDocument {
  const plan = run(ops);
  if (!plan.ok) throw new Error(plan.reason);
  expect(documentIssue("video", plan.final)).toBeNull();
  return plan.final;
}

function refusal(ops: VideoOperation[]): string {
  const plan = run(ops);
  if (plan.ok) throw new Error("expected a refusal");
  return plan.reason;
}

describe("3D rotation for Elo", () => {
  it("sets a static turn and clears it with zero", () => {
    const turned = final([{ op: "update_clip", clip_id: "p", rotation_x: 20, rotation_y: -45 }]);
    expect(findClip(turned, "p")!.clip).toMatchObject({ rotationX: 20, rotationY: -45 });
    const level = final([{ op: "update_clip", clip_id: "p", rotation_x: 20 }, { op: "update_clip", clip_id: "p", rotation_x: 0 }]);
    expect(findClip(level, "p")!.clip.rotationX).toBeUndefined();
  });

  it("animates rotationY with keys", () => {
    const flipped = final([{ op: "animate", clip_id: "p", property: "rotationY", keys: [{ at_ms: 0, value: 0 }, { at_ms: 1000, value: 180 }] }]);
    expect(findClip(flipped, "p")!.clip.keyframes?.rotationY?.map((key) => key.value)).toEqual([0, 180]);
  });

  it("refuses turns on nulls and sounds, past the range and over keys", () => {
    expect(refusal([{ op: "update_clip", clip_id: "n", rotation_y: 30 }])).toMatch(/rotation_y vale só/);
    expect(refusal([{ op: "update_clip", clip_id: "s", rotation_x: 30 }])).toMatch(/rotation_x vale só/);
    expect(refusal([{ op: "animate", clip_id: "n", property: "rotationX", keys: [{ at_ms: 0, value: 10 }] }])).toMatch(/rotationX gira em profundidade/);
    expect(refusal([{ op: "update_clip", clip_id: "p", rotation_x: 3601 }])).toMatch(/3600/);
    expect(refusal([{ op: "animate", clip_id: "p", property: "rotationX", keys: [{ at_ms: 0, value: 0 }, { at_ms: 500, value: 30 }] }, { op: "update_clip", clip_id: "p", rotation_x: 10 }])).toMatch(/animate property rotationX/);
  });

  it("sets the project perspective, zero included, and refuses it out of range", () => {
    const flat = final([{ op: "set_canvas", perspective: 0 }]);
    expect(flat.canvas.perspective).toBe(0);
    expect(refusal([{ op: "set_canvas", perspective: 121 }])).toMatch(/perspective vai de 0 a 120/);
  });

  it("flips letters through a text animator", () => {
    const flipped = final([{ op: "add_text_animator", clip_id: "t", animator_properties: { rotationX: 90, opacity: 0 } }]);
    expect(findClip(flipped, "t")!.clip.textAnimators?.[0].properties).toMatchObject({ rotationX: 90, opacity: 0 });
    const preset = final([{ op: "add_text_animator", clip_id: "t", animator_preset: "flipIn" }]);
    expect(findClip(preset, "t")!.clip.textAnimators?.[0].properties.rotationX).toBe(90);
  });

  it("reads the turn and the lens back in the outline once used", () => {
    expect(videoOutline(doc(), outlineCtx).perspective).toBeUndefined();
    const turned = final([{ op: "update_clip", clip_id: "p", rotation_y: 30 }]);
    expect(videoOutline(turned, outlineCtx).perspective).toBe(40);
    expect(outlineClip(findClip(turned, "p")!.clip, outlineCtx)).toMatchObject({ rotation_y: 30 });
  });
});
