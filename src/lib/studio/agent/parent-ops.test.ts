import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "../document";
import { visualPlan } from "../playback";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { videoOutline } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  const logo = { ...newMediaClip("image", "m-logo", 0, 4000), id: "logo", transform: { x: 0.4, y: 0.4, w: 0.2, h: 0.1, rotation: 0, opacity: 1 } };
  const word = { ...newMediaClip("image", "m-word", 0, 4000), id: "word", transform: { x: 0.6, y: 0.5, w: 0.3, h: 0.1, rotation: 0, opacity: 1 } };
  d.tracks = [
    { id: "a", kind: "visual", clips: [logo] },
    { id: "b", kind: "visual", clips: [word] },
    { id: "s", kind: "audio", clips: [{ ...newMediaClip("audio", "m-song", 0, 4000), id: "song" }] },
  ];
  d.durationMs = 4000;
  return d;
}

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
};

function run(start: VideoDocument, ops: VideoOperation[]) {
  return planBatch(start, ops, (current, op) => applyVideoOperation(current, op, CTX), VIDEO_ID_FIELDS, videoIds);
}

function placed(d: VideoDocument, id: string, atMs: number) {
  return visualPlan(d, atMs, 0).find((item) => item.clipId === id)!.transform;
}

describe("Elo parents clips and adds nulls", () => {
  it("adds a null, links two clips to it keeping their place, turns the null and reads the link back", () => {
    const before = doc();
    const plan = run(before, [
      { op: "add_null", ref: "rig", x: 0.5, y: 0.45 },
      { op: "parent_clip", clip_ids: ["logo", "word"], parent_id: "@rig" },
      { op: "animate", clip_id: "@rig", property: "rotation", keys: [{ at_ms: 0, value: 0 }, { at_ms: 2000, value: 90 }] },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    const after = plan.final;
    expect(documentIssue("video", after)).toBeNull();
    const rig = after.tracks.flatMap((track) => track.clips).find((clip) => clip.type === "null")!;
    expect(findClip(after, "logo")!.clip.parentId).toBe(rig.id);
    expect(placed(after, "logo", 0).x).toBeCloseTo(placed(before, "logo", 0).x, 9);
    expect(placed(after, "word", 2000).rotation).toBeCloseTo(90, 9);
    const outline = videoOutline(after, { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] });
    const clips = outline.tracks.flatMap((track) => track.clips);
    expect(clips.find((clip) => clip.id === "logo")?.parent).toBe(rig.id);
    expect(clips.find((clip) => clip.id === rig.id)?.type).toBe("null");
  });

  it("releases a clip keeping the picture and refuses cycles, sounds and a missing choice", () => {
    const linked = run(doc(), [{ op: "parent_clip", clip_id: "word", parent_id: "logo" }]);
    if (!linked.ok) throw new Error(linked.reason);
    const freed = run(linked.final, [{ op: "parent_clip", clip_id: "word", unparent: true }]);
    if (!freed.ok) throw new Error(freed.reason);
    expect(findClip(freed.final, "word")!.clip.parentId).toBeUndefined();
    const refusal = (ops: VideoOperation[], start = linked.final) => {
      const plan = run(start, ops);
      return plan.ok ? "" : plan.reason;
    };
    expect(refusal([{ op: "parent_clip", clip_id: "logo", parent_id: "word" }])).toContain("círculo");
    expect(refusal([{ op: "parent_clip", clip_id: "song", parent_id: "logo" }])).toContain("som");
    expect(refusal([{ op: "parent_clip", clip_id: "word" }])).toContain("parent_id");
    expect(refusal([{ op: "parent_clip", clip_id: "word", parent_id: "logo", unparent: true }])).toContain("nunca dos dois");
    expect(refusal([{ op: "add_null", x: 1.5 }])).toContain("x vai de 0 a 1");
  });

  it("jumps into the parent's space when keep_position is false", () => {
    const plan = run(doc(), [{ op: "parent_clip", clip_id: "word", parent_id: "logo", keep_position: false }]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(findClip(plan.final, "word")!.clip.transform).toEqual(findClip(doc(), "word")!.clip.transform);
    expect(placed(plan.final, "word", 0).x).not.toBeCloseTo(0.6, 3);
  });
});
