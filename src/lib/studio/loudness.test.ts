import { describe, expect, it } from "vitest";

import { gainToDb } from "./audio-gain";
import { integratedLoudness, kWeighted } from "./audio-meter";
import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "./document";
import { clipLoudness, LOUDNESS_TARGETS, loudnessAssetIds, loudnessProfile, normalizeClip, normalizeLoudness, normalizeTrack, trackLoudness, type LoudnessProfile } from "./loudness";

const RATE = 8000;

function sine(amplitude: number, seconds: number, hz = 1000): Float32Array {
  return Float32Array.from({ length: Math.round(seconds * RATE) }, (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / RATE));
}

function heard(channels: Float32Array[]): number {
  const stereo = channels.length === 1 ? [channels[0], channels[0]] : channels;
  return integratedLoudness(
    stereo.map((channel) => kWeighted(channel, RATE)),
    RATE,
  )!;
}

function song(): Float32Array {
  const out = new Float32Array(RATE * 6);
  out.set(sine(0.5, 3), 0);
  out.set(sine(0.1, 3, 440), RATE * 3);
  return out;
}

function audioDoc(clips: Partial<Clip>[]): VideoDocument {
  const doc = emptyVideoDocument("story");
  doc.durationMs = 10_000;
  doc.tracks[2].id = "music";
  doc.tracks[2].clips = clips.map((clip, i) => ({ ...newMediaClip("audio", `asset-${i}`, 0, 3000), id: `c${i}`, ...clip }) as Clip);
  return doc;
}

describe("loudness of what plays", () => {
  const profiles = new Map<string, LoudnessProfile>([
    ["asset-0", loudnessProfile([song()], RATE)],
    ["asset-1", loudnessProfile([sine(0.2, 6, 500), sine(0.2, 6, 700)], RATE)],
  ]);
  const source = (assetId: string) => profiles.get(assetId);

  it("measures a clip's played window as it sounds on two speakers", () => {
    const loud = song().subarray(0, RATE * 3);
    expect(clipLoudness(profiles.get("asset-0")!, newMediaClip("audio", "asset-0", 0, 3000))!).toBeCloseTo(heard([loud]), 1);
    const quiet = { ...newMediaClip("audio", "asset-0", 0, 3000), trimInMs: 3000 };
    expect(clipLoudness(profiles.get("asset-0")!, quiet)!).toBeCloseTo(heard([song().subarray(RATE * 3)]), 1);
    const stereo = [sine(0.2, 3, 500), sine(0.2, 3, 700)];
    expect(clipLoudness(profiles.get("asset-1")!, newMediaClip("audio", "asset-1", 0, 3000))!).toBeCloseTo(heard(stereo), 1);
  });

  it("follows speed, since a faster clip reads more source", () => {
    const fast = { ...newMediaClip("audio", "asset-0", 0, 3000), speed: 2 };
    expect(clipLoudness(profiles.get("asset-0")!, fast)!).toBeCloseTo(heard([song()]), 0);
  });

  it("sets the clip volume so the clip lands on the target, and says when it hits the ceiling", () => {
    const doc = audioDoc([{ assetId: "asset-0", volume: 0.3 }]);
    const result = normalizeClip(doc, "c0", LOUDNESS_TARGETS.social, source);
    if (!result.ok) throw new Error(result.reason);
    const clip = result.document.tracks[2].clips[0];
    expect(clipLoudness(profiles.get("asset-0")!, clip)! + gainToDb(clip.volume)).toBeCloseTo(-14, 1);
    expect(result.limited).toBe(false);
    const quiet = normalizeClip(audioDoc([{ assetId: "asset-0", trimInMs: 3000 }]), "c0", -5, source);
    expect(quiet.ok && quiet.limited).toBe(true);
    expect(quiet.ok && quiet.document.tracks[2].clips[0].volume).toBe(2);
  });

  it("refuses what it cannot measure or change", () => {
    expect(normalizeClip(audioDoc([{ assetId: "missing" }]), "c0", -14, source)).toEqual({ ok: false, reason: "unmeasured" });
    expect(normalizeClip(audioDoc([{ assetId: "asset-0" }]), "nope", -14, source)).toEqual({ ok: false, reason: "missing" });
    expect(normalizeClip(audioDoc([{ assetId: "asset-0" }]), "c0", 3, source)).toEqual({ ok: false, reason: "target" });
    const silent = new Map([["asset-0", loudnessProfile([new Float32Array(RATE * 3)], RATE)]]);
    expect(normalizeClip(audioDoc([{ assetId: "asset-0" }]), "c0", -14, (id) => silent.get(id))).toEqual({ ok: false, reason: "silent" });
    const locked = audioDoc([{ assetId: "asset-0" }]);
    locked.tracks[2].locked = true;
    expect(normalizeClip(locked, "c0", -14, source)).toEqual({ ok: false, reason: "locked" });
  });

  it("measures a track as heard without its own gain and writes the track gain", () => {
    const doc = audioDoc([{ assetId: "asset-0" }, { assetId: "asset-0", startMs: 3000, trimInMs: 3000, volume: 2 }]);
    doc.tracks[2].gainDb = -20;
    const measured = trackLoudness(doc, "music", source)!;
    const played = new Float32Array(RATE * 10);
    played.set(song().subarray(0, RATE * 3), 0);
    played.set(song().subarray(RATE * 3).map((v) => v * 2), RATE * 3);
    expect(measured).toBeCloseTo(heard([played]), 0);
    const result = normalizeTrack(doc, "music", -16, source);
    if (!result.ok) throw new Error(result.reason);
    expect(result.document.tracks[2].gainDb).toBeCloseTo(-16 - measured, 1);
    expect(trackLoudness(result.document, "music", source)).toBeCloseTo(measured, 6);
  });

  it("counts the track pan and refuses a ducked track without speech facts", () => {
    const doc = audioDoc([{ assetId: "asset-1" }]);
    const padded = (samples: Float32Array) => {
      const out = new Float32Array(RATE * 10);
      out.set(samples);
      return out;
    };
    expect(trackLoudness(doc, "music", source)!).toBeCloseTo(heard([padded(sine(0.2, 3, 500)), padded(sine(0.2, 3, 700))]), 1);
    doc.tracks[2].pan = -1;
    expect(trackLoudness(doc, "music", source)!).toBeCloseTo(heard([padded(sine(0.2, 3, 500)), new Float32Array(RATE * 10)]), 1);
    doc.tracks.push({ id: "voice", kind: "audio", clips: [{ ...newMediaClip("audio", "asset-0", 0, 3000), id: "v" }] });
    doc.tracks[2].ducking = { triggerTrackIds: ["voice"], reduceDb: 12, attackMs: 250, releaseMs: 500, holdMs: 300, sensitivity: 0.5 };
    expect(normalizeTrack(doc, "music", -14, source)).toEqual({ ok: false, reason: "unmeasured" });
  });

  it("normalizes several clips each to the target, or a whole track, and names the assets it must measure", () => {
    const doc = audioDoc([{ assetId: "asset-0" }, { assetId: "asset-1", startMs: 3000 }]);
    expect(loudnessAssetIds(doc, { clipIds: ["c1", "c0", "nope"] })).toEqual(["asset-1", "asset-0"]);
    expect(loudnessAssetIds(doc, { trackId: "music" })).toEqual(["asset-0", "asset-1"]);
    const both = normalizeLoudness(doc, { clipIds: ["c0", "c1"] }, -16, source);
    if (!both.ok) throw new Error(both.reason);
    expect(both.parts.map((part) => part.id)).toEqual(["c0", "c1"]);
    for (const [index, clip] of both.document.tracks[2].clips.entries()) expect(clipLoudness(profiles.get(`asset-${index}`)!, clip)! + gainToDb(clip.volume)).toBeCloseTo(-16, 1);
    const track = normalizeLoudness(doc, { trackId: "music" }, -23, source);
    if (!track.ok) throw new Error(track.reason);
    expect(track.parts).toEqual([{ id: "music", measured: trackLoudness(doc, "music", source), gainDb: track.document.tracks[2].gainDb, limited: false }]);
  });

  it("changes nothing when one of the clips cannot be normalized", () => {
    const doc = audioDoc([{ assetId: "asset-0" }, { assetId: "missing", startMs: 3000 }]);
    expect(normalizeLoudness(doc, { clipIds: ["c0", "c1"] }, -14, source)).toEqual({ ok: false, reason: "unmeasured", id: "c1" });
    expect(normalizeLoudness(doc, { clipIds: [] }, -14, source)).toEqual({ ok: false, reason: "missing" });
    expect(normalizeLoudness(doc, { trackId: "nope" }, -14, source)).toEqual({ ok: false, reason: "missing", id: "nope" });
  });
});
