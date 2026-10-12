import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newNullClip, type Clip, type VideoDocument } from "../document";
import { LOUDNESS_STEP_MS, type LoudnessProfile } from "../loudness";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { videoOutline } from "./outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const doc = emptyVideoDocument("story");
  const shot: Clip = { ...newMediaClip("video", "m-shot", 0, 6000), id: "shot" };
  const rig: Clip = { ...newNullClip(0, 2000), id: "rig" };
  const song: Clip = { ...newMediaClip("audio", "song", 0, 8000), id: "song", trimInMs: 1000 };
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [shot] },
    { id: "v2", kind: "visual", clips: [rig] },
    { id: "music", kind: "audio", clips: [song] },
  ];
  doc.durationMs = 8000;
  return doc;
}

function pulse(): LoudnessProfile {
  const steps = 2000;
  const energies = new Float32Array(steps).fill(1e-5);
  for (let at = 0; at < steps * LOUDNESS_STEP_MS; at += 500) {
    const k = Math.floor(at / LOUDNESS_STEP_MS);
    for (let d = 0; d < 8 && k + d < steps; d++) energies[k + d] += Math.exp(-d / 2);
  }
  return { durationMs: steps * LOUDNESS_STEP_MS, channels: [energies] };
}

const ctx: VideoOpContext = {
  playheadMs: 1000,
  magnetic: false,
  mediaType: () => null,
  sourceDuration: () => 20_000,
  captions: () => undefined,
  captionTrackName: "Legendas",
  icons: [],
  speech: () => undefined,
  loudness: (id) => (id === "song" ? pulse() : undefined),
};

function run(ops: VideoOperation[], base: VideoDocument = film()) {
  return planBatch(base, ops, (d, op) => applyVideoOperation(d, op, ctx), VIDEO_ID_FIELDS);
}

function done(ops: VideoOperation[], base?: VideoDocument): VideoDocument {
  const plan = run(ops, base);
  if (!plan.ok) throw new Error(JSON.stringify(plan));
  const last = plan.steps.at(-1)!.document;
  expect(documentIssue("video", last)).toBeNull();
  return last;
}

function outline(doc: VideoDocument) {
  return videoOutline(doc, { detail: "summary", playheadMs: 0, selection: [], jobs: [], asset: () => undefined } as never);
}

describe("organization ops", () => {
  it("adds film markers with a range, a color and a note, then edits and clears them", () => {
    const doc = done([
      { op: "add_marker", ref: "chorus", at_ms: 2000, name: "refrão", duration_ms: 3000, marker_color: "orange", note: "entra o coro" },
      { op: "update_marker", marker_id: "@chorus", marker_color: "none", duration_ms: 0 },
    ]);
    expect(doc.markers).toEqual([expect.objectContaining({ atMs: 2000, label: "refrão", note: "entra o coro" })]);
    expect(doc.markers![0].color).toBeUndefined();
    expect(doc.markers![0].durationMs).toBeUndefined();
    expect(outline(doc).markers).toEqual([{ id: doc.markers![0].id, at_ms: 2000, label: "refrão", note: "entra o coro" }]);
  });

  it("adds a clip marker on the timeline that moves with the clip and finds it by id alone", () => {
    const doc = done([
      { op: "add_marker", ref: "hit", clip_id: "song", at_ms: 1500, name: "batida forte" },
      { op: "update_marker", marker_id: "@hit", marker_color: "red" },
      { op: "move_clip", clip_id: "song", start_ms: 0 },
    ]);
    const clip = findClip(doc, "song")!.clip;
    expect(clip.markers).toEqual([expect.objectContaining({ atMs: 2500, label: "batida forte", color: "red" })]);
    const song = outline(doc).tracks[2].clips[0];
    expect(song.markers).toEqual([expect.objectContaining({ at_ms: 1500, label: "batida forte", color: "red" })]);
    const removed = done([{ op: "remove_marker", marker_id: clip.markers![0].id }], doc);
    expect(findClip(removed, "song")!.clip.markers).toBeUndefined();
  });

  it("refuses a clip marker outside the clip and an update with nothing to change", () => {
    const outside = run([{ op: "add_marker", clip_id: "rig", at_ms: 5000 }]);
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.reason).toContain("fora do clipe");
    const empty = run([{ op: "add_marker", ref: "a", at_ms: 100 }, { op: "update_marker", marker_id: "@a" }]);
    expect(empty.ok).toBe(false);
  });

  it("marks the beats of a music clip and reports the tempo", () => {
    const plan = run([{ op: "mark_beats", clip_id: "song", beat_every: 2, marker_color: "pink" }]);
    if (!plan.ok) throw new Error(JSON.stringify(plan));
    const doc = plan.steps.at(-1)!.document;
    const beats = findClip(doc, "song")!.clip.markers!.filter((m) => m.beat);
    expect(beats.length).toBeGreaterThan(5);
    expect(beats.every((m) => m.color === "pink")).toBe(true);
    expect(beats[1].atMs - beats[0].atMs).toBeGreaterThanOrEqual(990);
    expect(beats[1].atMs - beats[0].atMs).toBeLessThanOrEqual(1010);
    expect(plan.notes.join(" ")).toContain("120 BPM");
    const video = run([{ op: "mark_beats", clip_id: "shot" }]);
    expect(video.ok).toBe(false);
  });

  it("names, labels and guides clips and labels and hides tracks from the timeline", () => {
    const doc = done([
      { op: "update_clip", clip_id: "shot", name: "  Abertura  ", label_color: "green", guide: true },
      { op: "update_track", track_id: "v2", label_color: "purple", shy: true },
    ]);
    const shot = findClip(doc, "shot")!.clip;
    expect(shot).toMatchObject({ name: "Abertura", labelColor: "green", guide: true });
    expect(doc.tracks[1]).toMatchObject({ labelColor: "purple", shy: true });
    const read = outline(doc);
    expect(read.tracks[0].clips[0]).toMatchObject({ name: "Abertura", label_color: "green", guide: true });
    expect(read.tracks[1]).toMatchObject({ label_color: "purple", shy: true });
    const cleared = done([{ op: "update_clip", clip_id: "shot", unset: ["name"], label_color: "none", guide: false }], doc);
    const back = findClip(cleared, "shot")!.clip;
    expect(back.name ?? back.labelColor ?? back.guide).toBeUndefined();
    const nullGuide = run([{ op: "update_clip", clip_id: "rig", guide: true }]);
    expect(nullGuide.ok).toBe(false);
  });
});
