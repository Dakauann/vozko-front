import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, STUDIO_LIMITS, type Clip, type VideoDocument } from "./document";
import {
  clearRange,
  closeGaps,
  duplicateGroup,
  insertGroup,
  linkClips,
  linkGroup,
  magnetize,
  mainTrackId,
  moveGroup,
  overwriteGroup,
  placeGroup,
  placementMode,
  placeStack,
  rearrange,
  rippleTrim,
  splitAt,
  trimLinked,
  unlinkClips,
  withLinked,
} from "./edits";
import { findClip } from "./timeline";
import { documentIssue } from "./validate";

function clip(id: string, startMs: number, durationMs: number, type: "video" | "image" | "audio" = "video", linkId?: string): Clip {
  return { ...newMediaClip(type, `m-${id}`, startMs, durationMs), id, ...(linkId ? { linkId } : {}) };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "main", kind: "visual", clips: [clip("a", 0, 2000, "video", "pa"), clip("b", 2000, 2000, "video", "pb"), clip("c", 5000, 1000, "image")] },
    { id: "top", kind: "visual", clips: [] },
    { id: "sound", kind: "audio", clips: [clip("as", 0, 2000, "audio", "pa"), clip("bs", 2000, 2000, "audio", "pb")] },
    { id: "music", kind: "audio", clips: [clip("m", 0, 6000, "audio")] },
  ];
  d.durationMs = 6000;
  return d;
}

function at(d: VideoDocument, id: string) {
  const found = findClip(d, id);
  return found ? { track: found.track.id, start: found.clip.startMs, duration: found.clip.durationMs, trimIn: found.clip.trimInMs } : null;
}

describe("rearrange", () => {
  it("applies moves only when the result keeps every rule", () => {
    const d = doc();
    const moved = rearrange(d, new Map([["c", { trackId: "top", startMs: 100 }]]));
    expect(moved && at(moved, "c")).toMatchObject({ track: "top", start: 100 });
    expect(rearrange(d, new Map([["c", { startMs: 3000 }]]))).toBeNull();
    expect(rearrange(d, new Map([["c", { trackId: "sound" }]]))).toBeNull();
    expect(rearrange(d, new Map([["c", { startMs: STUDIO_LIMITS.maxVideoMs }]]))).toBeNull();
    const locked = doc();
    locked.tracks[1].locked = true;
    expect(rearrange(locked, new Map([["c", { trackId: "top" }]]))).toBeNull();
  });
});

describe("links", () => {
  it("finds the linked pair and expands a selection", () => {
    expect(linkGroup(doc(), "a").sort()).toEqual(["a", "as"]);
    expect(withLinked(doc(), ["a", "c"]).sort()).toEqual(["a", "as", "c"]);
  });

  it("links and unlinks clips", () => {
    const linked = linkClips(doc(), ["c", "m"]);
    expect(linkGroup(linked, "c").sort()).toEqual(["c", "m"]);
    expect(documentIssue("video", linked)).toBeNull();
    const unlinked = unlinkClips(doc(), ["as"]);
    expect(linkGroup(unlinked, "a")).toEqual(["a"]);
    expect(linkClips(doc(), ["c"])).toEqual(doc());
  });
});

describe("moving groups", () => {
  it("moves a pair together and changes the track of the dragged clip only", () => {
    const moved = moveGroup(doc(), "a", ["a", "as"], "top", 6000);
    expect(at(moved, "a")).toMatchObject({ track: "top", start: 6000 });
    expect(at(moved, "as")).toMatchObject({ track: "sound", start: 6000 });
    expect(documentIssue("video", moved)).toBeNull();
  });

  it("refuses a group move that collides", () => {
    const d = doc();
    expect(moveGroup(d, "a", ["a", "as"], null, 1000)).toBe(d);
  });

  it("inserts and pushes the clips after the insertion point with their links", () => {
    const inserted = insertGroup(doc(), "c", ["c"], "main", 1900);
    expect(at(inserted, "c")).toMatchObject({ start: 2000 });
    expect(at(inserted, "b")).toMatchObject({ start: 3000 });
    expect(at(inserted, "bs")).toMatchObject({ start: 3000 });
    expect(at(inserted, "a")).toMatchObject({ start: 0 });
    expect(documentIssue("video", inserted)).toBeNull();
  });

  it("overwrites what lies under the moved clip", () => {
    const written = overwriteGroup(doc(), "c", ["c"], "main", 1500);
    expect(at(written, "c")).toMatchObject({ track: "main", start: 1500 });
    expect(at(written, "a")).toMatchObject({ duration: 1500 });
    expect(at(written, "b")).toMatchObject({ start: 2500, duration: 1500, trimIn: 500 });
    expect(documentIssue("video", written)).toBeNull();
  });

  it("clears a range by trimming, splitting and removing", () => {
    const cleared = clearRange(doc(), "music", 1000, 2000)!;
    const pieces = cleared.tracks[3].clips.map((c) => [c.startMs, c.durationMs, c.trimInMs]);
    expect(pieces).toEqual([
      [0, 1000, 0],
      [2000, 4000, 2000],
    ]);
    expect(clearRange(doc(), "main", 0, 4000)!.tracks[0].clips.map((c) => c.id)).toEqual(["c"]);
  });
});

describe("trims", () => {
  it("trims a linked pair together", () => {
    const trimmed = trimLinked(doc(), "b", "end", 3500);
    expect(at(trimmed, "b")?.duration).toBe(1500);
    expect(at(trimmed, "bs")?.duration).toBe(1500);
    const start = trimLinked(doc(), "b", "start", 2400);
    expect(at(start, "bs")).toMatchObject({ start: 2400, trimIn: 400 });
  });

  it("stops a linked trim at the source end of either clip", () => {
    const d = doc();
    expect(trimLinked(d, "b", "end", 4800, (id) => (id === "bs" ? 2200 : 5000))).toEqual(trimLinked(d, "b", "end", 4200));
    expect(at(trimLinked(d, "b", "end", 4800, (id) => (id === "bs" ? 2200 : 5000)), "b")?.duration).toBe(2200);
  });

  it("ripple trims the end and moves what follows", () => {
    const rippled = rippleTrim(doc(), "a", "end", 1500);
    expect(at(rippled, "a")?.duration).toBe(1500);
    expect(at(rippled, "as")?.duration).toBe(1500);
    expect(at(rippled, "b")?.start).toBe(1500);
    expect(at(rippled, "bs")?.start).toBe(1500);
    expect(at(rippled, "c")?.start).toBe(4500);
    expect(documentIssue("video", rippled)).toBeNull();
  });

  it("ripple trims the start keeping the clip in place", () => {
    const rippled = rippleTrim(doc(), "b", "start", 2500);
    expect(at(rippled, "b")).toMatchObject({ start: 2000, duration: 1500, trimIn: 500 });
    expect(at(rippled, "c")?.start).toBe(4500);
  });
});

describe("magnetic track", () => {
  it("closes the gaps of the main track and keeps links in sync", () => {
    const d = doc();
    d.tracks[0].clips[1] = clip("b", 2500, 2000, "video", "pb");
    d.tracks[2].clips[1] = clip("bs", 2500, 2000, "audio", "pb");
    const packed = closeGaps(d, "main");
    expect(at(packed, "b")?.start).toBe(2000);
    expect(at(packed, "bs")?.start).toBe(2000);
    expect(at(packed, "c")?.start).toBe(4000);
  });
});

describe("duplicate and split", () => {
  it("duplicates a pair after itself with a fresh link", () => {
    const { document, clipIds } = duplicateGroup(doc(), ["b", "bs"]);
    expect(clipIds).toHaveLength(2);
    const [copy, sound] = clipIds.map((id) => findClip(document, id)!.clip);
    expect(copy.startMs).toBe(6000);
    expect(copy.linkId).toBe(sound.linkId);
    expect(copy.linkId).not.toBe("pb");
  });

  it("splits a pair into two pairs", () => {
    const split = splitAt(doc(), 1000, ["a", "as"]);
    const right = split.tracks[0].clips.find((c) => c.startMs === 1000)!;
    const rightSound = split.tracks[2].clips.find((c) => c.startMs === 1000)!;
    expect(right.linkId).toBe(rightSound.linkId);
    expect(right.linkId).not.toBe("pa");
    expect(linkGroup(split, "a").sort()).toEqual(["a", "as"]);
    expect(documentIssue("video", split)).toBeNull();
  });
});

describe("placeStack", () => {
  it("keeps each clip above the previous one", () => {
    const d = doc();
    const placed = placeStack(d, [clip("bar", 0, 1000, "image"), clip("label", 0, 1000, "image")])!;
    const tracks = placed.ids.map((id) => placed.document.tracks.findIndex((t) => t.id === findClip(placed.document, id)!.track.id));
    expect(tracks[0]).toBeLessThan(tracks[1]);
    expect(tracks[0]).toBe(1);
    expect(documentIssue("video", placed.document)).toBeNull();
  });
});

describe("magnetize", () => {
  it("packs only the main track and only when enabled", () => {
    const d = doc();
    expect(mainTrackId(d)).toBe("main");
    expect(magnetize(d, false)).toBe(d);
    expect(at(magnetize(d, true), "c")?.start).toBe(4000);
  });
});

describe("placement mode", () => {
  it("prefers overwrite, then insert, and inserts on a magnetic main track", () => {
    const base = { insert: false, overwrite: false, magnetic: false, onMainTrack: true };
    expect(placementMode(base)).toBe("move");
    expect(placementMode({ ...base, magnetic: true })).toBe("insert");
    expect(placementMode({ ...base, magnetic: true, onMainTrack: false })).toBe("move");
    expect(placementMode({ ...base, insert: true })).toBe("insert");
    expect(placementMode({ ...base, insert: true, overwrite: true })).toBe("overwrite");
  });

  it("routes a drag to the matching edit", () => {
    expect(at(placeGroup(doc(), "insert", "c", ["c"], "main", 1900), "b")?.start).toBe(3000);
    expect(at(placeGroup(doc(), "overwrite", "c", ["c"], "main", 1500), "a")?.duration).toBe(1500);
    expect(at(placeGroup(doc(), "move", "c", ["c"], "top", 100), "c")).toMatchObject({ track: "top", start: 100 });
  });
});

describe("keyframes follow the content", () => {
  it("shifts clip local keys when the start is trimmed", () => {
    const d = doc();
    d.tracks[0].clips[1] = { ...d.tracks[0].clips[1], keyframes: { opacity: [{ atMs: 1000, value: 0.5, easing: "linear" }] } };
    const trimmed = trimLinked(d, "b", "start", 2400);
    expect(findClip(trimmed, "b")?.clip.keyframes?.opacity?.[0].atMs).toBe(600);
    const moved = moveGroup(d, "b", ["b", "bs"], null, 6000);
    expect(findClip(moved, "b")?.clip.keyframes?.opacity?.[0].atMs).toBe(1000);
  });

  it("refuses edits that would pass the timeline key cap", () => {
    const d = doc();
    const frames = Array.from({ length: 32 }, (_, i) => ({ atMs: i * 10, value: 0.5, easing: "linear" as const }));
    const many = { x: frames, y: frames, scale: frames.map((f) => ({ ...f, value: 1 })), rotation: frames, opacity: frames };
    d.tracks[0].clips = d.tracks[0].clips.map((c) => ({ ...c, keyframes: many }));
    expect(duplicateGroup(d, ["c"]).clipIds).toEqual([]);
  });
});
