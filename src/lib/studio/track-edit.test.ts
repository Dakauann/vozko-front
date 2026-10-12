import { describe, expect, it } from "vitest";

import { anchorOf, placedPivot } from "./clip-placement";
import { canvasAspect, emptyVideoDocument, newMediaClip, newTextLayer, type Clip, type VideoDocument } from "./document";
import { overlayClip } from "./media-clips";
import { clipLookup, trackedPointIn, worldPlacementAt } from "./parenting";
import { attachToTracker, putTracker, removeTracker, stabilizeClip, unstabilizeClip } from "./track-edit";
import type { PointTracker } from "./point-track";
import { deleteClips, findClip, splitClip } from "./timeline";
import { documentIssue } from "./validate";

const FRAMES = 31;

function moving(id = "pt"): PointTracker {
  return {
    id,
    frameWidth: 1920,
    frameHeight: 1080,
    size: 0.06,
    referenceMs: 0,
    samples: Array.from({ length: FRAMES }, (_, n) => ({ atMs: Math.round((n * 1000) / 30), x: 0.3 + n * 0.01, y: 0.5 + 0.05 * Math.sin(n / 4), confidence: 0.97 })),
  };
}

function film(extra: Partial<Clip> = {}): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  const video: Clip = { ...newMediaClip("video", "m-1", 0, 1000), id: "v", ...extra };
  const title: Clip = { ...overlayClip(newTextLayer("Oi"), 0), id: "t", durationMs: 1000, transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.1, rotation: 0, opacity: 1 } };
  doc.tracks[0].clips = [video];
  doc.tracks[1].clips = [title];
  doc.durationMs = 1000;
  return doc;
}

function tracked(extra: Partial<Clip> = {}): VideoDocument {
  const edit = putTracker(film(extra), "v", moving());
  if (!edit.ok) throw new Error(edit.reason);
  return edit.document;
}

function pivot(doc: VideoDocument, id: string, ms: number) {
  const lookup = clipLookup(doc);
  const clip = lookup.get(id)!;
  return placedPivot(worldPlacementAt(lookup, clip, ms - clip.startMs, canvasAspect(doc)), anchorOf(clip), canvasAspect(doc));
}

function point(doc: VideoDocument, ms: number) {
  const lookup = clipLookup(doc);
  const video = lookup.get("v")!;
  return trackedPointIn(lookup, video, video.trackers![0], ms, canvasAspect(doc));
}

function near(a: { x: number; y: number }, b: { x: number; y: number }, digits = 9) {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
}

describe("storing a point track", () => {
  it("adds a tracker to a video clip and replaces one with the same id", () => {
    const doc = tracked();
    expect(findClip(doc, "v")!.clip.trackers).toHaveLength(1);
    const again = putTracker(doc, "v", { ...moving(), size: 0.1 });
    expect(again.ok && findClip(again.document, "v")!.clip.trackers).toEqual([{ ...moving(), size: 0.1 }]);
    const second = putTracker(doc, "v", moving("pt-2"));
    expect(second.ok && findClip(second.document, "v")!.clip.trackers).toHaveLength(2);
  });

  it("refuses clips that are not moving video and locked tracks", () => {
    expect(putTracker(film(), "t", moving())).toEqual({ ok: false, reason: "notVideo" });
    expect(putTracker(film({ freeze: true }), "v", moving())).toEqual({ ok: false, reason: "frozen" });
    const locked = film();
    locked.tracks[0].locked = true;
    expect(putTracker(locked, "v", moving())).toEqual({ ok: false, reason: "locked" });
    expect(putTracker(film(), "ghost", moving())).toEqual({ ok: false, reason: "missing" });
  });
});

describe("making a clip follow a tracked point", () => {
  it("links live and keeps the picture at the moment of linking", () => {
    const doc = tracked();
    const before = pivot(doc, "t", 400);
    const edit = attachToTracker(doc, ["t"], "v", "pt", { mode: "link", keepVisual: true, atMs: 400 });
    if (!edit.ok) throw new Error(edit.reason);
    const linked = findClip(edit.document, "t")!.clip;
    expect(linked).toMatchObject({ parentId: "v", parentTracker: "pt" });
    near(pivot(edit.document, "t", 400), before);
    for (const ms of [0, 200, 700, 999]) {
      const shift = { x: point(edit.document, ms).x - point(edit.document, 400).x, y: point(edit.document, ms).y - point(edit.document, 400).y };
      near(pivot(edit.document, "t", ms), { x: before.x + shift.x, y: before.y + shift.y });
    }
  });

  it("jumps onto the point when the position is not kept", () => {
    const edit = attachToTracker(tracked(), ["t"], "v", "pt", { mode: "link", keepVisual: false, atMs: 0 });
    if (!edit.ok) throw new Error(edit.reason);
    for (const ms of [0, 333, 900]) near(pivot(edit.document, "t", ms), point(edit.document, ms));
  });

  it("bakes position keys on every frame, keeping the offset", () => {
    const doc = tracked();
    const before = pivot(doc, "t", 0);
    const edit = attachToTracker(doc, ["t"], "v", "pt", { mode: "keys", keepVisual: true, atMs: 0 });
    if (!edit.ok) throw new Error(edit.reason);
    const title = findClip(edit.document, "t")!.clip;
    expect(title.parentId).toBeUndefined();
    expect(title.keyframes?.x).toHaveLength(30);
    expect(title.keyframes?.position).toBeUndefined();
    for (const ms of [0, 100, 500, 967]) near(pivot(edit.document, "t", ms), { x: before.x + point(doc, ms).x - point(doc, 0).x, y: before.y + point(doc, ms).y - point(doc, 0).y }, 6);
  });

  it("refuses a clip following itself, a missing tracker and clips without picture", () => {
    expect(attachToTracker(tracked(), ["v"], "v", "pt", { mode: "link", keepVisual: true, atMs: 0 })).toEqual({ ok: false, reason: "self" });
    expect(attachToTracker(tracked(), ["v"], "v", "pt", { mode: "keys", keepVisual: true, atMs: 0 })).toEqual({ ok: false, reason: "self" });
    expect(attachToTracker(tracked(), ["t"], "v", "ghost", { mode: "link", keepVisual: true, atMs: 0 })).toEqual({ ok: false, reason: "noTracker" });
    expect(attachToTracker(tracked(), ["t"], "t", "pt", { mode: "link", keepVisual: true, atMs: 0 })).toEqual({ ok: false, reason: "notVideo" });
  });

  it("frees followers keeping their picture when the tracker is removed", () => {
    const linked = attachToTracker(tracked(), ["t"], "v", "pt", { mode: "link", keepVisual: true, atMs: 0 });
    if (!linked.ok) throw new Error(linked.reason);
    const before = pivot(linked.document, "t", 0);
    const removed = removeTracker(linked.document, "v", "pt");
    if (!removed.ok) throw new Error(removed.reason);
    const title = findClip(removed.document, "t")!.clip;
    expect(title.parentTracker).toBeUndefined();
    expect(title.parentId).toBe("v");
    expect(findClip(removed.document, "v")!.clip.trackers).toBeUndefined();
    near(pivot(removed.document, "t", 0), before);
  });

  it("drops the link when the video is deleted and keeps it on the right piece after a cut", () => {
    const linked = attachToTracker(tracked(), ["t"], "v", "pt", { mode: "link", keepVisual: true, atMs: 0 });
    if (!linked.ok) throw new Error(linked.reason);
    const deleted = deleteClips(linked.document, ["v"]);
    expect(findClip(deleted, "t")!.clip.parentTracker).toBeUndefined();
    expect(documentIssue("video", deleted)).toBeNull();
    const moved = { ...linked.document, tracks: linked.document.tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => (clip.id === "t" ? { ...clip, startMs: 600, durationMs: 400 } : clip)) })) };
    const cut = splitClip(moved, "v", 500);
    const title = findClip(cut.document, "t")!.clip;
    expect(title).toMatchObject({ parentId: cut.clipId, parentTracker: "pt" });
    expect(documentIssue("video", cut.document)).toBeNull();
  });
});

describe("stabilizing a clip", () => {
  it("finds the zoom, checks the choice and removes the steadiness", () => {
    const steady = stabilizeClip(tracked(), "v", { trackerId: "pt" });
    if (!steady.ok) throw new Error(steady.reason);
    const zoom = findClip(steady.document, "v")!.clip.stabilize!.zoom;
    expect(zoom).toBeGreaterThan(1);
    expect(stabilizeClip(tracked(), "v", { trackerId: "pt", rotation: true })).toEqual({ ok: false, reason: "needsSecond" });
    expect(stabilizeClip(tracked(), "v", { trackerId: "ghost" })).toEqual({ ok: false, reason: "noTracker" });
    expect(stabilizeClip(tracked(), "v", { trackerId: "pt", zoom: 6 })).toEqual({ ok: false, reason: "outOfRange" });
    const off = unstabilizeClip(steady.document, "v");
    expect(off.ok && findClip(off.document, "v")!.clip.stabilize).toBeUndefined();
  });

  it("refuses motion too large to hide with the zoom", () => {
    const wild = putTracker(film(), "v", { ...moving(), samples: [{ atMs: 0, x: 0.5, y: 0.5, confidence: 1 }, { atMs: 500, x: 0.97, y: 0.5, confidence: 1 }] });
    if (!wild.ok) throw new Error(wild.reason);
    expect(stabilizeClip(wild.document, "v", { trackerId: "pt" })).toEqual({ ok: false, reason: "tooMuchMotion" });
  });

  it("keeps a follower of the steadied point still on the canvas", () => {
    const steady = stabilizeClip(tracked(), "v", { trackerId: "pt" });
    if (!steady.ok) throw new Error(steady.reason);
    const linked = attachToTracker(steady.document, ["t"], "v", "pt", { mode: "link", keepVisual: true, atMs: 0 });
    if (!linked.ok) throw new Error(linked.reason);
    const start = pivot(linked.document, "t", 0);
    for (const ms of [100, 400, 999]) near(pivot(linked.document, "t", ms), start);
    const removed = removeTracker(linked.document, "v", "pt");
    expect(removed.ok && findClip(removed.document, "v")!.clip.stabilize).toBeUndefined();
  });
});
