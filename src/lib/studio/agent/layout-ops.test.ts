import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type Clip, type Transform, type VideoDocument } from "../document";
import { findClip } from "../timeline";
import { applyVideoOperation, VIDEO_OPERATIONS, type VideoOpContext, type VideoOperation } from "./video-ops";
import { LAYOUT_OPERATIONS } from "./layout-ops";
import { videoOutline } from "./outline";

function box(x: number, y: number, w: number, h: number): Transform {
  return { x, y, w, h, rotation: 0, opacity: 1 };
}

function image(id: string, startMs: number, transform: Transform, extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("image", `m-${id}`, startMs, 1000), id, transform, ...extra };
}

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [image("a", 0, box(0.2, 0.2, 0.1, 0.1))] },
    { id: "v2", kind: "visual", clips: [image("b", 0, box(0.5, 0.6, 0.2, 0.2))] },
    { id: "v3", kind: "visual", clips: [image("c", 0, box(0.9, 0.3, 0.1, 0.2))] },
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

function run(op: Partial<VideoOperation>, doc: VideoDocument = film()) {
  return applyVideoOperation(doc, { op: "select", ...op } as VideoOperation, ctx);
}

function done(op: Partial<VideoOperation>, doc?: VideoDocument): VideoDocument {
  const outcome = run(op, doc);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.document;
}

describe("layout operations", () => {
  it("are video operations", () => {
    for (const name of LAYOUT_OPERATIONS) expect(VIDEO_OPERATIONS).toContain(name);
  });

  it("align_clips aligns to the frame or to the selection", () => {
    expect(findClip(done({ op: "align_clips", clip_id: "a", frame_align: "center" }), "a")!.clip.transform.x).toBeCloseTo(0.5);
    const together = done({ op: "align_clips", clip_ids: ["a", "b"], frame_align: "bottom" });
    expect(findClip(together, "a")!.clip.transform.y).toBeCloseTo(0.65);
    const framed = done({ op: "align_clips", clip_ids: ["a", "b"], frame_align: "top", relative_to: "frame" });
    expect(findClip(framed, "b")!.clip.transform.y).toBeCloseTo(0.1);
  });

  it("align_clips explains what it needs", () => {
    const missing = run({ op: "align_clips", clip_ids: ["a"] });
    expect(missing.ok).toBe(false);
    expect(!missing.ok && missing.reason).toContain("frame_align");
  });

  it("distribute_clips spaces three clips and refuses two", () => {
    expect(findClip(done({ op: "distribute_clips", clip_ids: ["a", "b", "c"], axis: "horizontal" }), "b")!.clip.transform.x).toBeCloseTo(0.55);
    const two = run({ op: "distribute_clips", clip_ids: ["a", "b"], axis: "vertical" });
    expect(!two.ok && two.reason).toContain("três");
  });

  it("sequence_clips places clips end to end with a gap and names a blocking clip", () => {
    const next = done({ op: "sequence_clips", clip_ids: ["a", "b", "c"], gap_ms: 200 });
    expect(["a", "b", "c"].map((id) => findClip(next, id)!.clip.startMs)).toEqual([0, 1200, 2400]);
    const d = film();
    d.tracks[1].clips.push(image("x", 1500, box(0.5, 0.5, 0.1, 0.1)));
    const blocked = run({ op: "sequence_clips", clip_ids: ["a", "b"] }, d);
    expect(!blocked.ok && blocked.reason).toContain("x");
  });

  it("stagger_clips offsets starts by a step and needs step_ms", () => {
    const next = done({ op: "stagger_clips", clip_ids: ["c", "b", "a"], step_ms: 150 });
    expect(["c", "b", "a"].map((id) => findClip(next, id)!.clip.startMs)).toEqual([0, 150, 300]);
    const missing = run({ op: "stagger_clips", clip_ids: ["a", "b"] });
    expect(!missing.ok && missing.reason).toContain("step_ms");
  });
});

describe("outline edges", () => {
  it("reads the on screen edges in frame pixels for clips under the playhead", () => {
    const context = { detail: "full" as const, asset: () => undefined, playheadMs: 500, selection: [], jobs: [] };
    const outline = videoOutline(film(), context);
    const a = outline.tracks[0].clips[0];
    expect(a.edges_px).toEqual({ left: 162, top: 162, right: 270, bottom: 270 });
    const later = videoOutline(film(), { ...context, playheadMs: 3000 });
    expect(later.tracks[0].clips[0].edges_px).toBeUndefined();
  });
});
