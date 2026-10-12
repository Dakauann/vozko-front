import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "./document";
import { addClipMarker, placeBeatMarkers, removeClipMarker, updateClipMarker } from "./clip-marker-edits";
import { clipMarkersIssue, placedClipMarkers, shiftClipMarkers, splitClipMarkers } from "./clip-markers";
import { addMarker } from "./markers";
import { findClip, snapCandidates, splitClip, trimClipStart } from "./timeline";
import { documentIssue } from "./validate";

function film(clip: Clip): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.tracks = [{ id: "a1", kind: clip.type === "audio" ? "audio" : "visual", clips: [clip] }];
  doc.durationMs = 20_000;
  return doc;
}

function music(): Clip {
  return { ...newMediaClip("audio", "song", 2000, 8000), id: "song", trimInMs: 1000 };
}

function title(): Clip {
  return { ...newOverlayClip(newTextLayer("Oi"), 1000, 4000), id: "title" };
}

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result as Extract<T, { ok: true }>;
}

describe("clip markers", () => {
  it("keeps markers on a sound clip in source time, so they follow the clip and its trims", () => {
    const added = ok(addClipMarker(film(music()), "song", 3500, { label: "drop", color: "red" }));
    const clip = findClip(added.document, "song")!.clip;
    expect(clip.markers?.[0]).toMatchObject({ atMs: 2500, label: "drop", color: "red" });
    expect(placedClipMarkers(clip).map((p) => p.startMs)).toEqual([3500]);
    const trimmed = trimClipStart(added.document, "song", 3000);
    expect(placedClipMarkers(findClip(trimmed, "song")!.clip).map((p) => p.startMs)).toEqual([3500]);
    expect(documentIssue("video", trimmed)).toBeNull();
  });

  it("keeps markers on a text clip in clip time and moves them on a start trim", () => {
    const added = ok(addClipMarker(film(title()), "title", 2500, { durationMs: 1000 }));
    expect(findClip(added.document, "title")!.clip.markers?.[0]).toMatchObject({ atMs: 1500, durationMs: 1000 });
    const trimmed = trimClipStart(added.document, "title", 2000);
    const placed = placedClipMarkers(findClip(trimmed, "title")!.clip);
    expect(placed.map((p) => [p.startMs, p.endMs])).toEqual([[2500, 3500]]);
  });

  it("refuses a spot outside the clip, a taken spot and an unknown marker", () => {
    const doc = film(music());
    expect(addClipMarker(doc, "song", 500, {})).toEqual({ ok: false, reason: "outside" });
    const added = ok(addClipMarker(doc, "song", 4000, {}));
    expect(addClipMarker(added.document, "song", 4000, {})).toEqual({ ok: false, reason: "taken" });
    expect(updateClipMarker(added.document, "song", "nope", { label: "x" })).toEqual({ ok: false, reason: "missing" });
    expect(addClipMarker(doc, "ghost", 4000, {})).toEqual({ ok: false, reason: "missing" });
  });

  it("moves, recolors and removes a clip marker", () => {
    const added = ok(addClipMarker(film(music()), "song", 4000, { label: "a" }));
    const moved = ok(updateClipMarker(added.document, "song", added.markerId, { atMs: 6000, color: "blue", durationMs: 500 }));
    const placed = placedClipMarkers(findClip(moved.document, "song")!.clip);
    expect(placed.map((p) => [p.startMs, p.endMs, p.marker.color])).toEqual([[6000, 6500, "blue"]]);
    const removed = ok(removeClipMarker(moved.document, "song", added.markerId));
    expect(findClip(removed.document, "song")!.clip.markers).toBeUndefined();
  });

  it("splits markers between the two pieces of a cut", () => {
    let doc = ok(addClipMarker(film(title()), "title", 1500, {})).document;
    doc = ok(addClipMarker(doc, "title", 4000, {})).document;
    const cut = splitClip(doc, "title", 3000);
    const left = findClip(cut.document, "title")!.clip;
    const right = findClip(cut.document, cut.clipId!)!.clip;
    expect(placedClipMarkers(left).map((p) => p.startMs)).toEqual([1500]);
    expect(placedClipMarkers(right).map((p) => p.startMs)).toEqual([4000]);
    expect(documentIssue("video", cut.document)).toBeNull();
  });

  it("shifts and splits by the clip time base", () => {
    const text = { ...title(), markers: [{ id: "m1", atMs: 500 }, { id: "m2", atMs: 3000, durationMs: 400 }] };
    expect(shiftClipMarkers(text, -500)).toEqual([{ id: "m1", atMs: 0 }, { id: "m2", atMs: 2500, durationMs: 400 }]);
    const sound = { ...music(), markers: [{ id: "m1", atMs: 1500 }] };
    expect(shiftClipMarkers(sound, -500)).toBe(sound.markers);
    expect(splitClipMarkers(text, 2000)).toEqual({ left: [{ id: "m1", atMs: 500 }], right: [{ id: "m2", atMs: 1000, durationMs: 400 }] });
  });

  it("validates clip markers on every clip type", () => {
    expect(clipMarkersIssue({ ...music(), markers: [{ id: "m1", atMs: 100, beat: true }] })).toBeNull();
    expect(clipMarkersIssue({ ...music(), markers: [{ id: "m1", atMs: -1 }] })).toBe("out_of_range");
    expect(clipMarkersIssue({ ...music(), markers: [{ id: "m1", atMs: 1 }, { id: "m1", atMs: 2 }] })).toBe("duplicate");
    const doc = film({ ...music(), markers: [{ id: "m1", atMs: 100, color: "green", note: "entra o coro" }] });
    expect(documentIssue("video", doc)).toBeNull();
  });

  it("offers film marker ranges and clip markers as snap points, but not the markers of the clips being moved", () => {
    let doc = ok(addClipMarker(film(music()), "song", 4500, { durationMs: 1000 })).document;
    doc = addMarker(doc, 7000, { durationMs: 1500 }).document;
    expect(snapCandidates(doc)).toEqual([0, 2000, 4500, 5500, 7000, 8500, 10000]);
    expect(snapCandidates(doc, { exclude: ["song"] })).toEqual([0, 7000, 8500]);
  });

  it("places beats inside the heard window, every nth one, replacing old beats and keeping other markers", () => {
    let doc = ok(addClipMarker(film(music()), "song", 3000, { label: "voz" })).document;
    doc = ok(placeBeatMarkers(doc, "song", [500, 1000, 1500, 2000, 2500, 3000, 20_000])).document;
    const beats = () => findClip(doc, "song")!.clip.markers!.filter((m) => m.beat).map((m) => m.atMs);
    expect(beats()).toEqual([1000, 1500, 2500, 3000]);
    const again = ok(placeBeatMarkers(doc, "song", [1000, 1500, 2000, 2500, 3000], { every: 2, color: "red" }));
    doc = again.document;
    expect(again.placed).toBe(2);
    expect(beats()).toEqual([1000, 3000]);
    expect(findClip(doc, "song")!.clip.markers!.find((m) => m.label === "voz")).toBeDefined();
    expect(findClip(doc, "song")!.clip.markers!.filter((m) => m.beat).every((m) => m.color === "red")).toBe(true);
    expect(documentIssue("video", doc)).toBeNull();
  });
});
