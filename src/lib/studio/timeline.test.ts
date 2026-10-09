import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import {
  addTrack,
  addTrackNextTo,
  clipsAt,
  deleteClips,
  duplicateClips,
  findClip,
  insertClip,
  isClipPickable,
  moveClip,
  moveTrack,
  nearestFreeStart,
  removeTrack,
  rippleDeleteClips,
  shiftTarget,
  shiftTrack,
  snapCandidates,
  snapMs,
  snapRangeStart,
  splitClip,
  splitClipsAt,
  trimClipEnd,
  trimClipStart,
  updateClip,
  updateTrack,
} from "./timeline";
import { documentIssue } from "./validate";

function clip(id: string, startMs: number, durationMs: number, type: Clip["type"] = "video"): Clip {
  return { ...newMediaClip(type === "overlay" ? "image" : type, `m-${id}`, startMs, durationMs), id, type };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [clip("a", 0, 2000), clip("b", 3000, 2000)] },
    { id: "v2", kind: "visual", clips: [] },
    { id: "au", kind: "audio", clips: [clip("m", 0, 5000, "audio")] },
  ];
  d.durationMs = 5000;
  return d;
}

function starts(d: VideoDocument, trackId: string): [string, number, number][] {
  return d.tracks.find((t) => t.id === trackId)!.clips.map((c) => [c.id, c.startMs, c.durationMs]);
}

describe("timeline placement", () => {
  it("finds the nearest free start without overlapping", () => {
    const track = doc().tracks[0];
    expect(nearestFreeStart(track, 1500, 1000)).toBe(2000);
    expect(nearestFreeStart(track, 4000, 500)).toBe(5000);
    expect(nearestFreeStart(track, 2400, 800)).toBe(2200);
    expect(nearestFreeStart(track, 1000, 2000, new Set(["a"]))).toBe(1000);
  });

  it("inserts a clip only where it fits, on a track of the right kind", () => {
    const inserted = insertClip(doc(), "v1", clip("c", 2000, 1000));
    expect(inserted.clipId).toBe("c");
    expect(starts(inserted.document, "v1").map(([id]) => id)).toEqual(["a", "c", "b"]);
    expect(insertClip(doc(), "v1", clip("d", 1500, 1000)).clipId).toBeNull();
    expect(insertClip(doc(), "au", clip("e", 6000, 1000)).clipId).toBeNull();
    expect(insertClip(doc(), "v2", clip("f", 0, 50)).clipId).toBeNull();
    const added = insertClip(doc(), "v2", clip("g", 8000, 1000)).document;
    expect(added.durationMs).toBe(9000);
    expect(documentIssue("video", added)).toBeNull();
  });

  it("moves a clip to the nearest free spot, across tracks of the same kind", () => {
    const moved = moveClip(doc(), "b", "v1", 1000);
    expect(starts(moved, "v1")).toEqual([["a", 0, 2000], ["b", 2000, 2000]]);
    const across = moveClip(doc(), "b", "v2", 500);
    expect(starts(across, "v2")).toEqual([["b", 500, 2000]]);
    expect(across.durationMs).toBe(5000);
    expect(moveClip(doc(), "b", "au", 0)).toEqual(doc());
  });

  it("refuses edits on locked tracks", () => {
    const locked = updateTrack(doc(), "v1", { locked: true });
    expect(moveClip(locked, "a", "v2", 0)).toBe(locked);
    expect(trimClipEnd(locked, "a", 2500)).toBe(locked);
    expect(deleteClips(locked, ["a"]).tracks[0].clips).toHaveLength(2);
    expect(removeTrack(locked, "v1")).toBe(locked);
  });
});

describe("trimming and splitting", () => {
  it("trims the start against the previous clip and the source start", () => {
    const d = doc();
    d.tracks[0].clips[1].trimInMs = 500;
    const trimmed = trimClipStart(d, "b", 2000);
    const b = findClip(trimmed, "b")!.clip;
    expect([b.startMs, b.durationMs, b.trimInMs]).toEqual([2500, 2500, 0]);
    const shorter = trimClipStart(doc(), "b", 4950);
    expect(findClip(shorter, "b")!.clip.durationMs).toBe(STUDIO_LIMITS.minClipMs);
  });

  it("lets an image grow freely to the left while video stops at its source", () => {
    const d = doc();
    d.tracks[0].clips[1] = { ...clip("b", 3000, 2000), type: "image" };
    const grown = trimClipStart(d, "b", 2200);
    const b = findClip(grown, "b")!.clip;
    expect([b.startMs, b.durationMs, b.trimInMs]).toEqual([2200, 2800, 0]);
  });

  it("trims the end against the next clip and the source length", () => {
    expect(findClip(trimClipEnd(doc(), "a", 4000), "a")!.clip.durationMs).toBe(3000);
    expect(findClip(trimClipEnd(doc(), "b", 9000, 3500), "b")!.clip.durationMs).toBe(3500);
    expect(findClip(trimClipEnd(doc(), "b", 1000), "b")!.clip.durationMs).toBe(STUDIO_LIMITS.minClipMs);
  });

  it("splits a clip keeping the source continuous", () => {
    const d = doc();
    d.tracks[0].clips[0].fadeInMs = 300;
    d.tracks[0].clips[0].fadeOutMs = 300;
    const { document, clipId } = splitClip(d, "a", 800);
    const right = findClip(document, clipId!)!.clip;
    const left = findClip(document, "a")!.clip;
    expect([left.startMs, left.durationMs, left.fadeInMs, left.fadeOutMs]).toEqual([0, 800, 300, 0]);
    expect([right.startMs, right.durationMs, right.trimInMs, right.fadeInMs, right.fadeOutMs]).toEqual([800, 1200, 800, 0, 300]);
    expect(documentIssue("video", document)).toBeNull();
    expect(splitClip(doc(), "a", 50).clipId).toBeNull();
  });

  it("splits every clip under the playhead on unlocked tracks", () => {
    const split = splitClipsAt(doc(), 1000);
    expect(split.tracks[0].clips).toHaveLength(3);
    expect(split.tracks[2].clips).toHaveLength(2);
    const onlyAudio = splitClipsAt(doc(), 1000, ["m"]);
    expect(onlyAudio.tracks[0].clips).toHaveLength(2);
  });

  it("gives split overlays their own layer id", () => {
    const d = doc();
    d.tracks[1].clips = [newOverlayClip(newTextLayer("Oi"), 0, 2000)];
    const overlayId = d.tracks[1].clips[0].id;
    const { document, clipId } = splitClip(d, overlayId, 1000);
    expect(findClip(document, clipId!)!.clip.layer!.id).not.toBe(findClip(document, overlayId)!.clip.layer!.id);
    expect(findClip(document, clipId!)!.clip.trimInMs).toBe(0);
  });
});

describe("deleting and duplicating", () => {
  it("deletes clips and shrinks the duration", () => {
    const d = deleteClips(doc(), ["b", "m"]);
    expect(starts(d, "v1")).toEqual([["a", 0, 2000]]);
    expect(d.durationMs).toBe(2000);
  });

  it("ripple deletes by closing the removed time on the same track", () => {
    const d = doc();
    d.tracks[0].clips.push(clip("c", 6000, 1000));
    const rippled = rippleDeleteClips(d, ["a"]);
    expect(starts(rippled, "v1")).toEqual([["b", 1000, 2000], ["c", 4000, 1000]]);
    expect(starts(rippled, "au")).toEqual([["m", 0, 5000]]);
    expect(documentIssue("video", rippled)).toBeNull();
  });

  it("duplicates right after the original, or at the next free place", () => {
    const { document, clipIds } = duplicateClips(doc(), ["a", "b"]);
    expect(clipIds).toHaveLength(2);
    expect(starts(document, "v1").map(([, start]) => start)).toEqual([0, 3000, 5000, 7000]);
    expect(documentIssue("video", document)).toBeNull();
  });

  it("clamps volume and fades on update", () => {
    const d = updateClip(doc(), "a", { volume: 5, fadeInMs: 1500, fadeOutMs: 1500 });
    const a = findClip(d, "a")!.clip;
    expect([a.volume, a.fadeInMs, a.fadeOutMs]).toEqual([2, 1500, 500]);
  });
});

describe("tracks", () => {
  it("adds as many tracks as the edit needs, removes and reorders", () => {
    let d = doc();
    for (let i = 0; i < 30; i++) d = addTrack(d, "visual").document;
    expect(d.tracks.filter((t) => t.kind === "visual")).toHaveLength(32);
    let a = d;
    for (let i = 0; i < 20; i++) a = addTrack(a, "audio").document;
    expect(a.tracks.filter((t) => t.kind === "audio")).toHaveLength(21);
    expect(documentIssue("video", a)).toBeNull();
    const reordered = moveTrack(doc(), "au", 0);
    expect(reordered.tracks.map((t) => t.id)).toEqual(["au", "v1", "v2"]);
    const removed = removeTrack(doc(), "au");
    expect(removed.tracks.map((t) => t.id)).toEqual(["v1", "v2"]);
    expect(removed.durationMs).toBe(5000);
  });
});

describe("track lanes", () => {
  function interleaved(): VideoDocument {
    const d = doc();
    d.tracks = [
      { id: "v1", kind: "visual", clips: [] },
      { id: "au", kind: "audio", clips: [] },
      { id: "v2", kind: "visual", clips: [] },
      { id: "a2", kind: "audio", clips: [] },
    ];
    return d;
  }

  const ids = (d: VideoDocument) => d.tracks.map((t) => t.id);

  it("moves a track one lane up or down among its own kind, the way the timeline stacks them", () => {
    const d = interleaved();
    expect(ids(shiftTrack(d, "v1", "up"))).toEqual(["au", "v2", "v1", "a2"]);
    expect(ids(shiftTrack(d, "v2", "down"))).toEqual(["v2", "v1", "au", "a2"]);
    expect(ids(shiftTrack(d, "au", "down"))).toEqual(["v1", "v2", "a2", "au"]);
    expect(ids(shiftTrack(d, "a2", "up"))).toEqual(["v1", "a2", "au", "v2"]);
  });

  it("leaves the document alone at the end of a lane or for a missing track", () => {
    const d = interleaved();
    expect(shiftTrack(d, "v2", "up")).toBe(d);
    expect(shiftTrack(d, "v1", "down")).toBe(d);
    expect(shiftTrack(d, "au", "up")).toBe(d);
    expect(shiftTrack(d, "a2", "down")).toBe(d);
    expect(shiftTrack(d, "gone", "up")).toBe(d);
    expect(shiftTarget(d.tracks, "v2", "up")).toBeNull();
    expect(shiftTarget(d.tracks, "v2", "down")).toBe(0);
  });

  it("adds a track of the same kind right above or below another one", () => {
    const d = interleaved();
    const above = addTrackNextTo(d, "v1", "up")!;
    expect(ids(above.document)).toEqual(["v1", above.trackId, "au", "v2", "a2"]);
    const below = addTrackNextTo(d, "v1", "down")!;
    expect(ids(below.document)).toEqual([below.trackId, "v1", "au", "v2", "a2"]);
    const audioAbove = addTrackNextTo(d, "a2", "up")!;
    expect(ids(audioAbove.document)).toEqual(["v1", "au", "v2", audioAbove.trackId, "a2"]);
    expect(audioAbove.document.tracks[3].kind).toBe("audio");
    expect(addTrackNextTo(d, "gone", "up")).toBeNull();
  });
});

describe("locked tracks", () => {
  it("keep their clips out of reach of the pointer and the selection", () => {
    const locked = updateTrack(doc(), "v1", { locked: true });
    expect(isClipPickable(locked, "a")).toBe(false);
    expect(isClipPickable(locked, "m")).toBe(true);
    expect(isClipPickable(locked, "ghost")).toBe(false);
  });
});

describe("snapping and lookup", () => {
  it("collects edges and the playhead, skipping the dragged clip", () => {
    expect(snapCandidates(doc(), { playheadMs: 1234, exclude: ["b"] })).toEqual([0, 1234, 2000, 5000]);
  });

  it("snaps a time and a range to the closest edge within the threshold", () => {
    expect(snapMs(1990, [0, 2000], 50)).toEqual({ ms: 2000, snapped: 2000 });
    expect(snapMs(1900, [0, 2000], 50)).toEqual({ ms: 1900, snapped: null });
    expect(snapRangeStart(2950, 1000, [2000, 3000, 5000], 80)).toEqual({ ms: 3000, snapped: 3000 });
    expect(snapRangeStart(1030, 960, [2000], 80)).toEqual({ ms: 1040, snapped: 2000 });
  });

  it("lists the clips playing at a time, bottom first, skipping hidden tracks", () => {
    expect(clipsAt(doc(), 3500).map((a) => [a.clip.id, a.localMs])).toEqual([["b", 500], ["m", 3500]]);
    expect(clipsAt(updateTrack(doc(), "v1", { hidden: true }), 3500).map((a) => a.clip.id)).toEqual(["m"]);
  });
});
