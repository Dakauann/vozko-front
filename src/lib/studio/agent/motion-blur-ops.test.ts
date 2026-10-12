import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newNullClip, type Clip, type VideoDocument } from "../document";
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
    { id: "v1", kind: "visual", clips: [clip("p"), { ...clip("q"), startMs: 2000 }] },
    { id: "v2", kind: "visual", clips: [{ ...newNullClip(0, 2000), id: "n" }] },
    { id: "au", kind: "audio", clips: [clip("s", "audio")] },
  ];
  d.durationMs = 4000;
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

describe("motion blur for Elo", () => {
  it("turns the switch on and off on several clips", () => {
    const on = final([{ op: "update_clip", clip_ids: ["p", "q"], motion_blur: true }]);
    expect(findClip(on, "p")!.clip.motionBlur).toBe(true);
    expect(findClip(on, "q")!.clip.motionBlur).toBe(true);
    const off = run([{ op: "update_clip", clip_ids: ["p", "q"], motion_blur: true }, { op: "update_clip", clip_id: "p", motion_blur: false }]);
    if (!off.ok) throw new Error(off.reason);
    expect(findClip(off.final, "p")!.clip.motionBlur).toBeUndefined();
    expect(JSON.parse(JSON.stringify(findClip(off.final, "p")!.clip))).not.toHaveProperty("motionBlur");
  });

  it("refuses sound and nulls, saying why", () => {
    expect(refusal([{ op: "update_clip", clip_id: "s", motion_blur: true }])).toContain("motion_blur");
    expect(refusal([{ op: "update_clip", clip_id: "n", motion_blur: true }])).toContain("motion_blur");
  });

  it("warns when the project shutter is closed", () => {
    const plan = run([{ op: "set_canvas", shutter_angle: 0 }, { op: "update_clip", clip_id: "p", motion_blur: true }]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.notes.join(" ")).toContain("shutter_angle");
  });

  it("sets the project shutter angle and phase", () => {
    const next = final([{ op: "set_canvas", shutter_angle: 270, shutter_phase: -45 }]);
    expect(next.canvas).toMatchObject({ shutterAngle: 270, shutterPhase: -45 });
    expect(final([{ op: "set_canvas", shutter_angle: 0 }]).canvas.shutterAngle).toBe(0);
  });

  it("refuses a shutter outside its range", () => {
    expect(refusal([{ op: "set_canvas", shutter_angle: 721 }])).toContain("shutter_angle");
    expect(refusal([{ op: "set_canvas", shutter_angle: -1 }])).toContain("shutter_angle");
    expect(refusal([{ op: "set_canvas", shutter_phase: 400 }])).toContain("shutter_phase");
  });

  it("asks for something to change", () => {
    expect(refusal([{ op: "set_canvas" }])).toContain("shutter_angle");
  });

  it("reads the switch and the shutter back in the outline", () => {
    const next = final([{ op: "update_clip", clip_id: "p", motion_blur: true }]);
    expect(outlineClip(findClip(next, "p")!.clip, outlineCtx)).toMatchObject({ motion_blur: true });
    expect(outlineClip(findClip(next, "q")!.clip, outlineCtx).motion_blur).toBeUndefined();
    expect(videoOutline(next, outlineCtx)).toMatchObject({ shutter_angle: 180, shutter_phase: -90 });
    expect(videoOutline(final([{ op: "set_canvas", shutter_angle: 90, shutter_phase: 0 }]), outlineCtx)).toMatchObject({ shutter_angle: 90, shutter_phase: 0 });
    expect(videoOutline(doc(), outlineCtx).shutter_angle).toBeUndefined();
  });
});
