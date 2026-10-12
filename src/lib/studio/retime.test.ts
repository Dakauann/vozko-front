import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { documentIssue } from "./validate";
import { freezeFrame, rampSpeed, retimeClip } from "./retime";
import { syncVideo, visualPlan } from "./playback";
import { findClip } from "./timeline";

function clip(id: string, type: "video" | "audio" | "image", startMs: number, durationMs: number, extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip(type, `m-${id}`, startMs, durationMs), id, ...extra };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v", kind: "visual", clips: [clip("a", "video", 0, 2000, { linkId: "k", trimInMs: 1000, keyframes: { opacity: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }] } }), clip("b", "video", 2000, 1000)] },
    { id: "au", kind: "audio", clips: [clip("a2", "audio", 0, 2000, { linkId: "k", trimInMs: 1000 }), clip("m", "audio", 2000, 1000)] },
  ];
  d.durationMs = 3000;
  return d;
}

const source = () => 20_000;
const at = (d: VideoDocument, id: string) => findClip(d, id)!.clip;

describe("changing the speed of a clip", () => {
  it("halves the duration at 2x, keeps the source window, stretches keys and pulls the rest of the track", () => {
    const result = retimeClip(doc(), "a", { speed: 2 }, source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.document;
    expect(at(next, "a")).toMatchObject({ durationMs: 1000, speed: 2, trimInMs: 1000 });
    expect(at(next, "a2")).toMatchObject({ durationMs: 1000, speed: 2 });
    expect(at(next, "a").keyframes?.opacity?.map((key) => key.atMs)).toEqual([0, 500]);
    expect(at(next, "b").startMs).toBe(1000);
    expect(at(next, "m").startMs).toBe(1000);
    expect(documentIssue("video", next)).toBeNull();
  });

  it("keeps the duration when asked, so more of the source plays, and refuses to run past the media", () => {
    const kept = retimeClip(doc(), "a", { speed: 2, keep: "duration" }, source);
    expect(kept.ok && at(kept.document, "a")).toMatchObject({ durationMs: 2000, speed: 2 });
    const past = retimeClip(doc(), "a", { speed: 16, keep: "duration" }, source);
    expect(past).toEqual({ ok: false, reason: "source" });
  });

  it("fits a clip to a duration, slows it down without ripple only when there is room, and resets to normal speed", () => {
    const fitted = retimeClip(doc(), "a", { durationMs: 4000 }, source);
    expect(fitted.ok && at(fitted.document, "a")).toMatchObject({ durationMs: 4000, speed: 0.5 });
    expect(fitted.ok && at(fitted.document, "b").startMs).toBe(4000);
    expect(retimeClip(doc(), "a", { speed: 0.5, ripple: false }, source)).toEqual({ ok: false, reason: "noRoom" });
    const normal = fitted.ok ? retimeClip(fitted.document, "a", { speed: 1 }, source) : null;
    expect(normal?.ok && at(normal.document, "a").speed).toBeUndefined();
    expect(normal?.ok && at(normal.document, "a").durationMs).toBe(2000);
  });

  it("reverses and mutes pitch correction on the linked pair without moving anything", () => {
    const result = retimeClip(doc(), "a2", { reverse: true, preservePitch: false }, source);
    expect(result.ok && at(result.document, "a")).toMatchObject({ reverse: true, preservePitch: false, durationMs: 2000 });
    expect(result.ok && at(result.document, "a2")).toMatchObject({ reverse: true, preservePitch: false });
  });

  it("refuses images, speeds out of range and frozen clips", () => {
    const d = doc();
    d.tracks[0].clips[1] = clip("b", "image", 2000, 1000);
    expect(retimeClip(d, "b", { speed: 2 }, source)).toEqual({ ok: false, reason: "notSourced" });
    expect(retimeClip(doc(), "a", { speed: 40 }, source)).toEqual({ ok: false, reason: "range" });
    const frozen = freezeFrame(doc(), "a", 500, 2000);
    expect(frozen.ok).toBe(true);
    if (frozen.ok) expect(retimeClip(frozen.document, frozen.clipId, { speed: 2 }, source)).toEqual({ ok: false, reason: "frozen" });
  });
});

describe("freeze frame", () => {
  it("holds the frame under the playhead for two seconds and pushes the rest, sound included", () => {
    const result = freezeFrame(doc(), "a", 500, 2000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.document;
    const frozen = at(next, result.clipId);
    expect(frozen).toMatchObject({ startMs: 500, durationMs: 2000, freeze: true, trimInMs: 1500, type: "video" });
    expect(frozen.keyframes).toBeUndefined();
    expect(frozen.transform.opacity).toBeCloseTo(0.5);
    expect(next.tracks[0].clips.map((c) => [c.startMs, c.durationMs])).toEqual([
      [0, 500],
      [500, 2000],
      [2500, 1500],
      [4000, 1000],
    ]);
    expect(next.tracks[1].clips.map((c) => c.startMs)).toEqual([0, 2500, 4000]);
    expect(documentIssue("video", next)).toBeNull();
  });

  it("pushes the clip itself when the frame is its first one", () => {
    const result = freezeFrame(doc(), "a", 0, 1000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.tracks[0].clips.map((c) => [c.startMs, c.durationMs])).toEqual([
      [0, 1000],
      [1000, 2000],
      [3000, 1000],
    ]);
    expect(result.document.tracks[1].clips.map((c) => c.startMs)).toEqual([1000, 3000]);
    expect(documentIssue("video", result.document)).toBeNull();
  });

  it("freezes only video", () => {
    expect(freezeFrame(doc(), "a2", 500, 2000)).toEqual({ ok: false, reason: "notVideo" });
  });
});

describe("playing a retimed clip", () => {
  it("reads the source at the clip speed and tells the decoder which way to go", () => {
    const d = doc();
    d.tracks[0].clips[0] = { ...d.tracks[0].clips[0], speed: 2, reverse: true, keyframes: undefined };
    const item = visualPlan(d, 500).find((entry) => entry.clipId === "a")!;
    expect(item).toMatchObject({ sourceMs: 3998, speed: 2, backward: true });
    const frozen = freezeFrame(doc(), "a", 500, 2000);
    const still = frozen.ok ? visualPlan(frozen.document, 1000).find((entry) => entry.clipId === frozen.clipId) : null;
    expect(still).toMatchObject({ sourceMs: 1500, speed: 0, backward: false });
  });

  it("drives a video element at the clip speed, and steps it frame by frame when it cannot play that way", () => {
    expect(syncVideo(1000, 1000, { playing: true, rate: 1, active: true, speed: 2, backward: false })).toEqual({ seekToMs: null, play: true, playbackRate: 2 });
    expect(syncVideo(1000, 900, { playing: true, rate: 1, active: true, speed: 2, backward: true })).toEqual({ seekToMs: 900, play: false, playbackRate: 1 });
    expect(syncVideo(1000, 1000, { playing: true, rate: 1, active: true, speed: 0, backward: false })).toEqual({ seekToMs: null, play: false, playbackRate: 1 });
  });
});

describe("speed ramp", () => {
  it("eases from the current speed to the target in steps and plays the rest at the target", () => {
    const result = rampSpeed(doc(), "a", { atMs: 1000, rampMs: 500, toSpeed: 0.5 }, source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pieces = result.document.tracks[0].clips.filter((c) => c.assetId === "m-a");
    const speeds = pieces.map((c) => c.speed ?? 1);
    expect(speeds[0]).toBe(1);
    expect(speeds.at(-1)).toBe(0.5);
    expect(speeds.length).toBe(7);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeLessThanOrEqual(speeds[i - 1]);
    for (let i = 1; i < pieces.length; i++) expect(pieces[i].startMs).toBe(pieces[i - 1].startMs + pieces[i - 1].durationMs);
    for (let i = 1; i < pieces.length; i++) expect(pieces[i].trimInMs).toBe(pieces[i - 1].trimInMs + Math.round(pieces[i - 1].durationMs * (pieces[i - 1].speed ?? 1)));
    const audio = result.document.tracks[1].clips.filter((c) => c.assetId === "m-a2");
    expect(audio.map((c) => c.speed ?? 1)).toEqual(speeds);
    expect(documentIssue("video", result.document)).toBeNull();
  });

  it("uses fewer steps when the ramp is short and refuses a target out of range", () => {
    const short = rampSpeed(doc(), "a", { atMs: 1000, rampMs: 250, toSpeed: 2 }, source);
    expect(short.ok && short.document.tracks[0].clips.filter((c) => c.assetId === "m-a").map((c) => c.speed ?? 1)).toEqual([1, 1.5, 2]);
    expect(rampSpeed(doc(), "a", { atMs: 1000, rampMs: 500, toSpeed: 50 }, source)).toEqual({ ok: false, reason: "range" });
  });
});
