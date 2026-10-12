import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { outlineClip, type OutlineContext } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  const ball = { ...newShapeLayer("ellipse", { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }), id: "l-ball", fill: "#38bdf8" };
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newOverlayClip(ball, 0, 2000, { x: 0.2, y: 0.5, w: 0.05, h: 0.09, rotation: 0, opacity: 1 }), id: "ball" }, { ...newMediaClip("image", "m-photo", 2000, 1000), id: "photo" }] },
  ];
  doc.durationMs = 3000;
  return doc;
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
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS);
}

function final(ops: VideoOperation[], base?: VideoDocument): VideoDocument {
  const plan = run(ops, base);
  if (!plan.ok) throw new Error(plan.reason);
  expect(documentIssue("video", plan.final)).toBeNull();
  return plan.final;
}

function refusal(ops: VideoOperation[]): string {
  const plan = run(ops);
  if (plan.ok) throw new Error("expected a refusal");
  return plan.reason;
}

describe("clip repeater for Elo", () => {
  it("makes a linear trail and merges later changes into it", () => {
    const doc = final([
      { op: "set_repeat", clip_id: "ball", repeat: { mode: "linear", copies: 5, x: 60, end_opacity: 0.1, order: "below" } },
      { op: "set_repeat", clip_id: "ball", repeat: { rotation: 15 } },
    ]);
    expect(findClip(doc, "ball")!.clip.repeat).toEqual({ mode: "linear", copies: 5, x: 60, endOpacity: 0.1, order: "below", rotation: 15 });
  });

  it("reuses the radial, grid and mirror fields and restarts from defaults on a new mode", () => {
    const doc = final([{ op: "set_repeat", clip_id: "ball", repeat: { mode: "radial", count: 6, radius: 80, upright: true, start_opacity: 0.5 } }]);
    expect(findClip(doc, "ball")!.clip.repeat).toMatchObject({ mode: "radial", count: 6, radius: 80, upright: true, startOpacity: 0.5 });
    const grid = final([{ op: "set_repeat", clip_id: "ball", repeat: { mode: "grid", rows: 2, columns: 3 } }], doc);
    expect(findClip(grid, "ball")!.clip.repeat).toMatchObject({ mode: "grid", rows: 2, columns: 3 });
    expect(findClip(grid, "ball")!.clip.repeat?.radius).toBeUndefined();
  });

  it("animates a value, records keys with at_ms and clears the repeat", () => {
    const keyed = final([
      { op: "set_repeat", clip_id: "ball", repeat: { mode: "linear", copies: 4, x: 50 } },
      { op: "animate_repeat", clip_id: "ball", repeat_property: "shift", keys: [{ at_ms: 0, value: 0 }, { at_ms: 1000, value: 2 }] },
      { op: "set_repeat", clip_id: "ball", repeat: { shift: 1 }, at_ms: 500 },
    ]);
    expect(findClip(keyed, "ball")!.clip.repeat?.keyframes?.shift?.map((frame) => frame.atMs)).toEqual([0, 500, 1000]);
    expect(outlineClip(findClip(keyed, "ball")!.clip, outlineCtx).repeat).toMatchObject({ mode: "linear", copies: 4, x: 50, animated: ["shift"] });
    const cleared = final([{ op: "clear_repeat", clip_id: "ball" }], keyed);
    expect(findClip(cleared, "ball")!.clip.repeat).toBeUndefined();
  });

  it("refuses with reasons the model can act on", () => {
    expect(refusal([{ op: "set_repeat", clip_id: "photo", repeat: { mode: "linear", copies: 2 } }])).toContain("sobreposta");
    expect(refusal([{ op: "set_repeat", clip_id: "ball", repeat: { mode: "spiral" } }])).toContain("mode");
    expect(refusal([{ op: "set_repeat", clip_id: "ball", repeat: { mode: "linear", rows: 2 } }])).toContain("rows");
    expect(refusal([{ op: "set_repeat", clip_id: "ball", repeat: { mode: "radial", x: 20 } }])).toContain("linear");
    expect(refusal([{ op: "set_repeat", clip_id: "ball", repeat: { mode: "linear", copies: 1.5 } }])).toContain("inteiro");
    expect(refusal([{ op: "set_repeat", clip_id: "ball", repeat: { mode: "linear", scale: 30 } }])).toContain("scale");
    expect(refusal([{ op: "animate_repeat", clip_id: "ball", repeat_property: "shift", keys: [] }])).toContain("set_repeat");
    expect(refusal([{ op: "clear_repeat", clip_id: "ball" }])).toContain("não tem repetição");
  });

  it("asks for at_ms before changing an animated value", () => {
    const plan = run([
      { op: "set_repeat", clip_id: "ball", repeat: { mode: "radial", count: 6, radius: 80 } },
      { op: "animate_repeat", clip_id: "ball", repeat_property: "radius", keys: [{ at_ms: 0, value: 40 }, { at_ms: 900, value: 120 }] },
      { op: "set_repeat", clip_id: "ball", repeat: { radius: 60 } },
    ]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("at_ms");
  });
});
