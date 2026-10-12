import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "./document";
import { deleteClips, moveClip, splitClip, trimClipEnd } from "./timeline";
import { addTransition, cutsOf, removeTransition, targetCut, trackKindOf, TRANSITION_DEFAULT_MS, transitionWindow, updateTransition } from "./transitions";
import { documentIssue } from "./validate";

function clip(id: string, startMs: number, durationMs: number, extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("video", `asset-${id}`, startMs, durationMs), id, ...extra };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [clip("a", 0, 2000, { fadeOutMs: 300 }), clip("b", 2000, 2000, { fadeInMs: 300 }), clip("c", 5000, 1000)] },
    { id: "t1", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 1000), id: "o" }] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 6000), id: "m" }] },
  ];
  d.durationMs = 6000;
  return d;
}

function added(d: VideoDocument = doc(), input: Partial<Parameters<typeof addTransition>[1]> = {}) {
  const result = addTransition(d, { fromClipId: "a", toClipId: "b", kind: "dissolve", ...input });
  if (!result.ok) throw new Error(result.reason);
  return result;
}

describe("adding transitions", () => {
  it("places a transition on the cut between two touching clips without moving them", () => {
    const { document, transitionId } = added();
    const track = document.tracks[0];
    expect(track.transitions).toEqual([{ id: transitionId, fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: TRANSITION_DEFAULT_MS, alignment: "center", easing: "linear" }]);
    expect(track.clips.map((c) => [c.startMs, c.durationMs])).toEqual([
      [0, 2000],
      [2000, 2000],
      [5000, 1000],
    ]);
    expect(track.clips[0].fadeOutMs).toBe(0);
    expect(track.clips[1].fadeInMs).toBe(0);
    expect(documentIssue("video", document)).toBeNull();
  });

  it("uses the defaults of each kind and keeps only the options that kind has", () => {
    const push = added(doc(), { kind: "push", direction: "up" }).document.tracks[0].transitions![0];
    expect(push).toMatchObject({ kind: "push", direction: "up", easing: "easeInOut" });
    const dip = added(doc(), { kind: "dipToColor", color: "#ffffff" }).document.tracks[0].transitions![0];
    expect(dip).toMatchObject({ kind: "dipToColor", color: "#ffffff", alignment: "center" });
    const refused = addTransition(doc(), { fromClipId: "a", toClipId: "b", kind: "dissolve", direction: "up" });
    expect(refused).toEqual({ ok: false, reason: "option" });
  });

  it("replaces the transition already on that cut", () => {
    const first = added();
    const second = added(first.document, { kind: "wipe", angle: 90 });
    expect(second.document.tracks[0].transitions).toHaveLength(1);
    expect(second.document.tracks[0].transitions![0]).toMatchObject({ kind: "wipe", angle: 90 });
  });

  it("refuses clips that do not touch, a sequential kind off center and a length past half a clip", () => {
    expect(addTransition(doc(), { fromClipId: "b", toClipId: "c", kind: "dissolve" })).toEqual({ ok: false, reason: "apart" });
    expect(addTransition(doc(), { fromClipId: "a", toClipId: "o", kind: "dissolve" })).toEqual({ ok: false, reason: "apart" });
    expect(addTransition(doc(), { fromClipId: "a", toClipId: "b", kind: "zoom", alignment: "start" })).toEqual({ ok: false, reason: "alignment" });
    expect(addTransition(doc(), { fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 50 })).toEqual({ ok: false, reason: "duration" });
    const capped = added(doc(), { durationMs: 4000 });
    expect(capped.document.tracks[0].transitions![0].durationMs).toBe(2000);
  });

  it("lists the cuts of a track and the window of a transition", () => {
    expect(cutsOf(doc().tracks[0])).toEqual([{ fromClipId: "a", toClipId: "b", atMs: 2000 }]);
    const { document } = added(doc(), { durationMs: 600 });
    const track = document.tracks[0];
    expect(transitionWindow(track.transitions![0], track)).toEqual({ startMs: 1700, endMs: 2300, cutMs: 2000 });
    const start = added(doc(), { durationMs: 600, alignment: "start" }).document.tracks[0];
    expect(transitionWindow(start.transitions![0], start)).toEqual({ startMs: 2000, endMs: 2600, cutMs: 2000 });
  });
});

describe("choosing the cut to act on", () => {
  it("uses the selected clip, then two selected neighbours, then the cut nearest the playhead", () => {
    const d = doc();
    d.tracks[0].clips[2] = clip("c", 4000, 1000);
    expect(targetCut(d, ["a"], 0, "visual")).toEqual({ fromClipId: "a", toClipId: "b", atMs: 2000 });
    expect(targetCut(d, ["c", "b"], 0, "visual")).toEqual({ fromClipId: "b", toClipId: "c", atMs: 4000 });
    expect(targetCut(d, ["c"], 0, "visual")).toEqual({ fromClipId: "b", toClipId: "c", atMs: 4000 });
    expect(targetCut(d, [], 3800, "visual")).toEqual({ fromClipId: "b", toClipId: "c", atMs: 4000 });
    expect(targetCut(d, ["o"], 500, "visual")).toEqual({ fromClipId: "a", toClipId: "b", atMs: 2000 });
    const lonely = doc();
    lonely.tracks[0].clips = [clip("a", 0, 1000)];
    expect(targetCut(lonely, [], 0, "visual")).toBeNull();
  });

  it("looks only at the cuts on tracks of the kind the transition is for", () => {
    const d = doc();
    d.tracks.push({ id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "s1", 0, 3000), id: "m1" }, { ...newMediaClip("audio", "s2", 3000, 1000), id: "m2" }] });
    expect(targetCut(d, ["m1"], 0, "audio")).toEqual({ fromClipId: "m1", toClipId: "m2", atMs: 3000 });
    expect(targetCut(d, [], 0, "audio")).toEqual({ fromClipId: "m1", toClipId: "m2", atMs: 3000 });
    expect(targetCut(d, ["m1"], 0, "visual")).toEqual({ fromClipId: "a", toClipId: "b", atMs: 2000 });
    expect(trackKindOf("constantGain")).toBe("audio");
    expect(trackKindOf("wipe")).toBe("visual");
  });
});

describe("changing and removing transitions", () => {
  it("updates the kind and options, refusing options the kind lacks", () => {
    const { document, transitionId } = added();
    const updated = updateTransition(document, transitionId, { kind: "push", direction: "left", durationMs: 800 });
    expect(updated.ok && updated.document.tracks[0].transitions![0]).toMatchObject({ kind: "push", direction: "left", durationMs: 800 });
    expect(updateTransition(document, transitionId, { color: "#000000" })).toEqual({ ok: false, reason: "option" });
    expect(updateTransition(document, "nope", { durationMs: 800 })).toEqual({ ok: false, reason: "missing" });
    const removed = removeTransition(document, transitionId);
    expect(removed.ok && removed.document.tracks[0].transitions).toBeUndefined();
  });

  it("follows timeline edits: dropped when clips stop touching, shortened when a clip gets short, kept on the right piece of a split", () => {
    const { document } = added(doc(), { durationMs: 1000 });
    expect(moveClip(document, "b", "v1", 2500).tracks[0].transitions).toBeUndefined();
    expect(deleteClips(document, ["a"]).tracks[0].transitions).toBeUndefined();
    const trimmed = trimClipEnd(document, "b", 2600);
    expect(trimmed.tracks[0].transitions![0].durationMs).toBe(600);
    const split = splitClip(document, "a", 1000);
    expect(split.document.tracks[0].transitions![0]).toMatchObject({ fromClipId: split.clipId, toClipId: "b" });
    expect(documentIssue("video", split.document)).toBeNull();
  });
});

describe("transitions in the document", () => {
  it.each([
    ["clips that do not touch", (d: VideoDocument) => (d.tracks[0].transitions = [{ id: "x", fromClipId: "b", toClipId: "c", kind: "dissolve", durationMs: 500, alignment: "center", easing: "linear" }])],
    ["a transition on sound", (d: VideoDocument) => (d.tracks[2].transitions = [{ id: "x", fromClipId: "m", toClipId: "m", kind: "dissolve", durationMs: 500, alignment: "center", easing: "linear" }])],
    ["an unknown kind", (d: VideoDocument) => (d.tracks[0].transitions = [{ id: "x", fromClipId: "a", toClipId: "b", kind: "spin" as never, durationMs: 500, alignment: "center", easing: "linear" }])],
    ["a hold easing", (d: VideoDocument) => (d.tracks[0].transitions = [{ id: "x", fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 500, alignment: "center", easing: "hold" }])],
    ["an option the kind lacks", (d: VideoDocument) => (d.tracks[0].transitions = [{ id: "x", fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 500, alignment: "center", easing: "linear", color: "#000000" }])],
    ["a length past half a clip", (d: VideoDocument) => (d.tracks[0].transitions = [{ id: "x", fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 4000, alignment: "center", easing: "linear" }])],
    ["an id used by a clip", (d: VideoDocument) => (d.tracks[0].transitions = [{ id: "c", fromClipId: "a", toClipId: "b", kind: "dissolve", durationMs: 500, alignment: "center", easing: "linear" }])],
  ])("refuses %s like the backend", (_, change) => {
    const d = doc();
    change(d);
    expect(documentIssue("video", d)).not.toBeNull();
  });
});
