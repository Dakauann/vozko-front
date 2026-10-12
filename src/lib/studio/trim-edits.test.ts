import { describe, expect, it } from "vitest";

import { emptyVideoDocument, msOfFrame, newMediaClip, type Clip, type VideoDocument } from "./document";
import { findClip } from "./timeline";
import { clipUnder, limitOf, nearestEdge, rollCut, slideClip, trimPreviewFrames } from "./trim-edits";
import { documentIssue } from "./validate";

function clip(id: string, startMs: number, durationMs: number, type: "video" | "image" | "audio" = "video", extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip(type, `m-${id}`, startMs, durationMs), id, ...extra };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "main", kind: "visual", clips: [clip("a", 0, 2000, "video", { linkId: "pa", trimInMs: 1000 }), clip("b", 2000, 2000, "video", { linkId: "pb", trimInMs: 500 }), clip("c", 5000, 1000, "image")] },
    { id: "top", kind: "visual", clips: [] },
    { id: "sound", kind: "audio", clips: [clip("as", 0, 2000, "audio", { linkId: "pa", trimInMs: 1000 }), clip("bs", 2000, 2000, "audio", { linkId: "pb", trimInMs: 500 })] },
  ];
  d.durationMs = 6000;
  return d;
}

function touchingC(): VideoDocument {
  const d = doc();
  d.tracks[0].clips[2] = clip("c", 4000, 1000, "image");
  return d;
}

const source = () => 10_000;
const linked = { linked: true };
const alone = { linked: false };

function at(d: VideoDocument, id: string) {
  const found = findClip(d, id);
  return found ? { start: found.clip.startMs, duration: found.clip.durationMs, trimIn: found.clip.trimInMs } : null;
}

function edited(result: ReturnType<typeof rollCut>): VideoDocument {
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  expect(documentIssue("video", result.document)).toBeNull();
  return result.document;
}

describe("roll", () => {
  it("moves the cut between two touching clips and their linked sound together", () => {
    const result = rollCut(doc(), "a", "end", 2600, source, linked);
    const next = edited(result);
    expect(at(next, "a")).toEqual({ start: 0, duration: 2600, trimIn: 1000 });
    expect(at(next, "b")).toEqual({ start: 2600, duration: 1400, trimIn: 1100 });
    expect(at(next, "as")?.duration).toBe(2600);
    expect(at(next, "bs")).toEqual({ start: 2600, duration: 1400, trimIn: 1100 });
    expect(result.ok && result.atMs).toBe(2600);
    expect(result.ok && result.block).toBeNull();
    expect(result.ok && [...result.changed].sort()).toEqual(["a", "as", "b", "bs"]);
  });

  it("names the cut from either side and leaves the sound alone when unlinked", () => {
    const next = edited(rollCut(doc(), "b", "start", 2600, source, alone));
    expect(at(next, "a")?.duration).toBe(2600);
    expect(at(next, "b")?.start).toBe(2600);
    expect(at(next, "as")?.duration).toBe(2000);
    expect(at(next, "bs")?.start).toBe(2000);
  });

  it("stops where the incoming clip runs out of media and says so", () => {
    const result = rollCut(doc(), "a", "end", 1000, source, alone);
    expect(at(edited(result), "b")).toEqual({ start: 1500, duration: 2500, trimIn: 0 });
    expect(result.ok && result.block).toEqual({ limit: "source", clipId: "b", atMs: 1500 });
  });

  it("clamps the whole group to its tightest linked clip", () => {
    const d = doc();
    d.tracks[2].clips[1] = clip("bs", 2000, 2000, "audio", { linkId: "pb", trimInMs: 200 });
    const result = rollCut(d, "a", "end", 1000, source, linked);
    expect(at(edited(result), "b")?.start).toBe(1800);
    expect(result.ok && result.block).toEqual({ limit: "source", clipId: "bs", atMs: 1800 });
  });

  it("refuses with the reason when nothing can move", () => {
    const d = doc();
    d.tracks[0].clips[1] = clip("b", 2000, 2000, "video", { trimInMs: 0 });
    expect(rollCut(d, "a", "end", 1500, source, alone)).toEqual({ ok: false, reason: "blocked", block: { limit: "source", clipId: "b", atMs: 2000 } });
    expect(rollCut(doc(), "a", "end", 2000, source, linked)).toEqual({ ok: false, reason: "unchanged" });
    expect(rollCut(doc(), "nope", "end", 2500, source, linked)).toEqual({ ok: false, reason: "missing" });
  });

  it("keeps every clip at the minimum length", () => {
    const result = rollCut(doc(), "a", "end", 3990, source, alone);
    expect(at(edited(result), "b")?.duration).toBe(100);
    expect(result.ok && result.block).toEqual({ limit: "minimum", clipId: "b", atMs: 3900 });
  });

  it("treats a gap as a neighbour with unlimited media", () => {
    expect(at(edited(rollCut(doc(), "b", "end", 4600, source, linked)), "bs")?.duration).toBe(2600);
    const result = rollCut(doc(), "b", "end", 5400, source, alone);
    expect(at(edited(result), "b")?.duration).toBe(3000);
    expect(result.ok && result.block).toEqual({ limit: "neighbour", clipId: "c", atMs: 5000 });
  });

  it("reads the media left at the clip speed", () => {
    const d = doc();
    d.tracks[0].clips[1] = clip("b", 2000, 2000, "video", { trimInMs: 500, speed: 2 });
    const next = edited(rollCut(d, "a", "end", 1000, source, alone));
    expect(at(next, "b")).toEqual({ start: 1750, duration: 2250, trimIn: 0 });
  });

  it("keeps the transition on the cut and shortens it to half of the shorter clip", () => {
    const d = doc();
    d.tracks[0].transitions = [{ id: "t1", fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 1000, alignment: "center", easing: "easeInOut" }];
    expect(edited(rollCut(d, "a", "end", 2400, source, alone)).tracks[0].transitions).toEqual([expect.objectContaining({ id: "t1", durationMs: 1000 })]);
    expect(edited(rollCut(d, "a", "end", 3700, source, alone)).tracks[0].transitions).toEqual([expect.objectContaining({ id: "t1", durationMs: 300 })]);
  });

  it("refuses when a linked clip sits on a locked track", () => {
    const d = doc();
    d.tracks[2].locked = true;
    expect(rollCut(d, "a", "end", 2600, source, linked)).toEqual({ ok: false, reason: "locked", trackId: "sound" });
    expect(rollCut(d, "a", "end", 2600, source, alone).ok).toBe(true);
  });
});

describe("slide", () => {
  it("moves a clip between its neighbours keeping its content while they trim", () => {
    const result = slideClip(touchingC(), "b", 2300, source, linked);
    const next = edited(result);
    expect(at(next, "a")).toEqual({ start: 0, duration: 2300, trimIn: 1000 });
    expect(at(next, "b")).toEqual({ start: 2300, duration: 2000, trimIn: 500 });
    expect(at(next, "c")).toEqual({ start: 4300, duration: 700, trimIn: 0 });
    expect(at(next, "bs")?.start).toBe(2300);
    expect(at(next, "as")?.duration).toBe(2300);
    expect(result.ok && result.atMs).toBe(2300);
  });

  it("slides only the clip when unlinked", () => {
    const next = edited(slideClip(touchingC(), "b", 2300, source, alone));
    expect(at(next, "bs")?.start).toBe(2000);
    expect(at(next, "as")?.duration).toBe(2000);
  });

  it("is limited by the media left in the clip before it, at its speed", () => {
    const d = touchingC();
    d.tracks[0].clips[0] = clip("a", 0, 2000, "video", { trimInMs: 1000, speed: 2 });
    expect(slideClip(d, "b", 2300, () => 5000, alone)).toEqual({ ok: false, reason: "blocked", block: { limit: "source", clipId: "a", atMs: 2000 } });
    expect(at(edited(slideClip(d, "b", 1700, () => 5000, alone)), "a")?.duration).toBe(1700);
  });

  it("keeps the next clip at the minimum length", () => {
    const result = slideClip(touchingC(), "b", 2950, source, alone);
    expect(at(edited(result), "c")?.duration).toBe(100);
    expect(result.ok && result.block).toEqual({ limit: "minimum", clipId: "c", atMs: 2900 });
  });

  it("uses a gap on one side as the neighbour", () => {
    const result = slideClip(doc(), "b", 3500, source, linked);
    expect(at(edited(result), "b")?.start).toBe(3000);
    expect(result.ok && result.block).toEqual({ limit: "neighbour", clipId: "c", atMs: 3000 });
  });

  it("carries the transitions on both cuts with the clip", () => {
    const d = touchingC();
    d.tracks[0].transitions = [
      { id: "t1", fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 400, alignment: "center", easing: "easeInOut" },
      { id: "t2", fromClipId: "b", toClipId: "c", kind: "dissolve", durationMs: 400, alignment: "center", easing: "easeInOut" },
    ];
    const next = edited(slideClip(d, "b", 2300, source, alone));
    expect(next.tracks[0].transitions?.map((t) => [t.id, t.durationMs])).toEqual([
      ["t1", 400],
      ["t2", 400],
    ]);
  });

  it("refuses on a locked track and for an unknown clip", () => {
    const d = touchingC();
    d.tracks[2].locked = true;
    expect(slideClip(d, "b", 2300, source, linked)).toEqual({ ok: false, reason: "locked", trackId: "sound" });
    expect(slideClip(d, "nope", 2300, source, linked)).toEqual({ ok: false, reason: "missing" });
    expect(slideClip(d, "b", 2000, source, alone)).toEqual({ ok: false, reason: "unchanged" });
  });
});

describe("limit feedback", () => {
  it("reads the limit an edit reached or was refused by", () => {
    expect(limitOf(rollCut(doc(), "a", "end", 1000, source, alone))).toBe("source");
    expect(limitOf(slideClip(touchingC(), "b", 2950, source, alone))).toBe("minimum");
    expect(limitOf(rollCut(doc(), "a", "end", 2600, source, linked))).toBeUndefined();
    expect(limitOf(rollCut(doc(), "nope", "end", 2600, source, linked))).toBeUndefined();
  });
});

describe("trim preview", () => {
  const last = (durationMs: number) => durationMs - msOfFrame(1);

  it("shows the outgoing and incoming frames of a roll", () => {
    expect(trimPreviewFrames(doc(), { mode: "roll", clipId: "b", edge: "start" })).toEqual([
      [
        { clipId: "a", localMs: last(2000), live: true },
        { clipId: "b", localMs: 0, live: true },
      ],
    ]);
    expect(trimPreviewFrames(doc(), { mode: "roll", clipId: "b", edge: "end" })).toEqual([[{ clipId: "b", localMs: last(2000), live: true }, null]]);
  });

  it("shows the slid clip fixed above and its neighbours moving below", () => {
    expect(trimPreviewFrames(doc(), { mode: "slide", clipId: "b", edge: "start" })).toEqual([
      [
        { clipId: "b", localMs: 0, live: false },
        { clipId: "b", localMs: last(2000), live: false },
      ],
      [{ clipId: "a", localMs: last(2000), live: true }, null],
    ]);
    expect(trimPreviewFrames(doc(), { mode: "slide", clipId: "nope", edge: "start" })).toBeNull();
  });
});

describe("edit targets", () => {
  it("prefers the selected clip under the playhead, then the main track, then the topmost", () => {
    const d = doc();
    expect(clipUnder(d, ["bs"], 2500)).toBe("bs");
    expect(clipUnder(d, ["c"], 2500)).toBe("b");
    expect(clipUnder(d, [], 4500)).toBeNull();
    d.tracks[0].clips = [];
    expect(clipUnder(d, [], 2500)).toBe("bs");
  });

  it("picks the edge nearest the playhead", () => {
    const b = findClip(doc(), "b")!.clip;
    expect(nearestEdge(b, 2400)).toBe("start");
    expect(nearestEdge(b, 3500)).toBe("end");
  });
});
