import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newTextLayer, type VideoDocument } from "../document";
import { overlayClip } from "../media-clips";
import { findClip } from "../timeline";
import { documentIssue } from "../validate";
import type { TrackOutcome } from "../tracking/track-outcome";
import { planBatch } from "./batch";
import { videoOutline } from "./outline";
import { trackPlanOf, trackPlans } from "./track-ops";
import { applyVideoOperation, VIDEO_ID_FIELDS, videoIds, type VideoOpContext, type VideoOperation } from "./video-ops";

function film(): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.tracks[0].clips = [{ ...newMediaClip("video", "m-1", 0, 1000), id: "shot" }];
  doc.tracks[1].clips = [{ ...overlayClip(newTextLayer("Oi"), 0), id: "tag", durationMs: 1000, transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.1, rotation: 0, opacity: 1 } }];
  doc.durationMs = 1000;
  return doc;
}

const TRACKED: TrackOutcome = {
  kind: "tracked",
  frameWidth: 1920,
  frameHeight: 1080,
  size: 0.06,
  referenceMs: 0,
  loss: null,
  samples: Array.from({ length: 30 }, (_, n) => ({ atMs: Math.round((n * 1000) / 30), x: 0.4 + n * 0.004, y: 0.5, confidence: n === 7 ? 0.88 : 0.98 })),
};

function context(outcome: TrackOutcome | undefined): VideoOpContext {
  return {
    playheadMs: 0,
    magnetic: false,
    mediaType: () => null,
    sourceDuration: () => undefined,
    captions: () => undefined,
    captionTrackName: "Legendas",
    icons: [],
    speech: () => undefined,
    loudness: () => undefined,
    trackOutcome: () => outcome,
  };
}

function run(start: VideoDocument, ops: VideoOperation[], outcome: TrackOutcome | null = TRACKED) {
  return planBatch(start, ops, (current, op) => applyVideoOperation(current, op, context(outcome ?? undefined)), VIDEO_ID_FIELDS, videoIds);
}

describe("planning a track for Elo", () => {
  it("turns a point on the frame at a moment into a job on the source frames", () => {
    const plan = trackPlanOf(film(), { op: "track_point", clip_id: "shot", point: { x: 0.4, y: 0.5 }, at_ms: 200 }, 0);
    if (typeof plan === "string") throw new Error(plan);
    expect(plan.request).toMatchObject({ boxPoint: { x: 0.4, y: 0.5 }, atMs: 200, fromMs: 0, toMs: 1000, direction: "both", fit: "cover" });
    expect(plan.request.boxSize).toBeCloseTo(0.06, 12);
    expect(trackPlans(film(), [{ op: "track_point", clip_id: "shot", point: { x: 0.4, y: 0.5 } }, { op: "seek", at_ms: 0 }], 0)).toHaveLength(1);
  });

  it("refuses what cannot be tracked, saying why", () => {
    const cases: [VideoOperation, string][] = [
      [{ op: "track_point", clip_id: "tag", point: { x: 0.5, y: 0.5 } }, "não é vídeo"],
      [{ op: "track_point", clip_id: "shot", point: { x: 0.5, y: 0.5 }, at_ms: 1500 }, "fora do clipe"],
      [{ op: "track_point", clip_id: "shot" }, "point"],
      [{ op: "track_point", clip_id: "shot", point: { x: 0.5, y: 0.5 }, track_size: 0.9 }, "track_size"],
      [{ op: "track_point", clip_id: "shot", point: { x: 0.5, y: 0.5 }, at_ms: 100, from_ms: 200 }, "from_ms"],
    ];
    for (const [op, text] of cases) {
      const plan = trackPlanOf(film(), op, 0);
      expect(typeof plan === "string" && plan.includes(text), `${JSON.stringify(op)}: ${String(plan)}`).toBe(true);
    }
  });
});

describe("Elo tracks, attaches and stabilizes", () => {
  it("tracks a point, reports its confidence, makes a text follow it and steadies the shot", () => {
    const plan = run(film(), [
      { op: "track_point", ref: "eye", clip_id: "shot", point: { x: 0.4, y: 0.5 }, name: "Olho" },
      { op: "attach_to_track", clip_id: "tag", parent_id: "shot", tracker_id: "@eye" },
      { op: "stabilize_clip", clip_id: "shot", tracker_id: "@eye" },
    ]);
    if (!plan.ok) throw new Error(plan.reason);
    expect(documentIssue("video", plan.final)).toBeNull();
    const shot = findClip(plan.final, "shot")!.clip;
    const tracker = shot.trackers![0];
    expect(tracker).toMatchObject({ name: "Olho", frameWidth: 1920, referenceMs: 0 });
    expect(findClip(plan.final, "tag")!.clip).toMatchObject({ parentId: "shot", parentTracker: tracker.id });
    expect(shot.stabilize?.zoom).toBeGreaterThan(1);
    expect(plan.notes.some((note) => note.includes("confiança média") && note.includes("0.88"))).toBe(true);
    expect(plan.notes.some((note) => note.includes("zoom"))).toBe(true);
    const outline = videoOutline(plan.final, { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] });
    const clips = outline.tracks.flatMap((track) => track.clips);
    expect(clips.find((clip) => clip.id === "shot")).toMatchObject({ trackers: [{ id: tracker.id, name: "Olho", frames: 30, lowest_confidence: 0.88, from_ms: 0, to_ms: 967 }], stabilize: { tracker_id: tracker.id } });
    expect(clips.find((clip) => clip.id === "tag")).toMatchObject({ parent: "shot", parent_tracker: tracker.id });
  });

  it("refuses a lost track unless asked to keep the tracked part", () => {
    const lost: TrackOutcome = { ...TRACKED, samples: TRACKED.samples.slice(0, 12), loss: { direction: "forward", atMs: 400, confidence: 0.41 } };
    const refused = run(film(), [{ op: "track_point", clip_id: "shot", point: { x: 0.4, y: 0.5 } }], lost);
    expect(!refused.ok && refused.reason).toContain("perdeu o ponto seguindo em 400 ms (confiança 0.41");
    const kept = run(film(), [{ op: "track_point", clip_id: "shot", point: { x: 0.4, y: 0.5 }, keep_partial: true }], lost);
    if (!kept.ok) throw new Error(kept.reason);
    expect(findClip(kept.final, "shot")!.clip.trackers![0].samples).toHaveLength(12);
    expect(kept.notes.some((note) => note.includes("guardou o trecho"))).toBe(true);
  });

  it("refuses a track that never ran or failed, and removes a tracker with its links", () => {
    expect(run(film(), [{ op: "track_point", clip_id: "shot", point: { x: 0.4, y: 0.5 } }], null).ok).toBe(false);
    const flat = run(film(), [{ op: "track_point", clip_id: "shot", point: { x: 0.4, y: 0.5 } }], { kind: "flat" });
    expect(!flat.ok && flat.reason).toContain("não tem detalhe");
    const linked = run(film(), [
      { op: "track_point", ref: "eye", clip_id: "shot", point: { x: 0.4, y: 0.5 } },
      { op: "attach_to_track", clip_id: "tag", parent_id: "shot", tracker_id: "@eye", attach_mode: "keys" },
      { op: "remove_tracker", clip_id: "shot", tracker_id: "@eye" },
    ]);
    if (!linked.ok) throw new Error(linked.reason);
    expect(findClip(linked.final, "shot")!.clip.trackers).toBeUndefined();
    expect(findClip(linked.final, "tag")!.clip.keyframes?.x).toHaveLength(30);
  });
});
