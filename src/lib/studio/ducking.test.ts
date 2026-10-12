import { describe, expect, it } from "vitest";

import { dbToGain, gainPoints, SILENCE_DB } from "./audio-gain";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "./document";
import { analyzeSpeech, bakeDucking, duckDb, duckingIssue, mergeRegions, speechRegions, timelineSpeech, triggerAssetIds, withDucking, type DuckingRule, type SpeechAnalysis } from "./ducking";
import { audioPlan, audioVoiceKeys } from "./playback";
import { recordMoment, toggleAnimation } from "./keyframe-edit";
import { documentIssue } from "./validate";

const RATE = 8000;

function gainAt(points: readonly { atMs: number; value: number }[], ms: number): number {
  const after = points.findIndex((p) => p.atMs >= ms);
  if (after <= 0) return points[Math.max(0, after)].value;
  const a = points[after - 1];
  const b = points[after];
  return a.value + ((b.value - a.value) * (ms - a.atMs)) / (b.atMs - a.atMs);
}

function speechLike(segments: readonly [number, number][], seconds: number): Float32Array {
  const samples = new Float32Array(Math.round(seconds * RATE));
  for (const [from, to] of segments) for (let i = Math.round(from * RATE); i < Math.round(to * RATE); i++) samples[i] = 0.5 * Math.sin((2 * Math.PI * 300 * i) / RATE);
  return samples;
}

describe("gain in decibels", () => {
  it("turns -60 dB into silence and interpolates the lane in dB", () => {
    expect(dbToGain(SILENCE_DB)).toBe(0);
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    const clip = { ...newMediaClip("audio", "a", 0, 1000), keyframes: { gainDb: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 1000, value: -20, easing: "linear" as const }] } };
    const points = gainPoints(clip, 0, { trackGainDb: 0, duckDb: () => 0 });
    const at = (ms: number) => points.find((p) => p.atMs === ms)!.value;
    expect(at(500)).toBeCloseTo(dbToGain(-10), 4);
  });

  it("keeps a plain clip to a handful of points and folds in track gain and ducking", () => {
    const plain = { ...newMediaClip("audio", "a", 0, 1000), fadeInMs: 100 };
    expect(gainPoints(plain, 0, { trackGainDb: 0 }).length).toBeLessThanOrEqual(4);
    const quiet = gainPoints(plain, 0, { trackGainDb: -6 });
    expect(quiet.at(-1)!.value).toBeCloseTo(dbToGain(-6), 4);
    const ducked = gainPoints(plain, 0, { trackGainDb: 0, duckDb: (ms) => (ms >= 500 ? 12 : 0) });
    expect(gainAt(ducked, 600)).toBeCloseTo(dbToGain(-12), 4);
    expect(ducked.length).toBeLessThan(20);
  });
});

describe("speech detection", () => {
  it("finds speech regions with hysteresis and merges short gaps", () => {
    const analysis = analyzeSpeech(speechLike([[0.5, 1.5], [1.7, 2.5], [3.5, 4]], 5), RATE);
    expect(analysis.windowMs).toBe(20);
    const regions = speechRegions(analysis, 0.5, 300);
    expect(regions).toHaveLength(2);
    expect(regions[0].fromMs).toBeGreaterThanOrEqual(460);
    expect(regions[0].fromMs).toBeLessThanOrEqual(540);
    expect(regions[0].toMs).toBeGreaterThanOrEqual(2460);
    expect(regions[1].fromMs).toBeGreaterThanOrEqual(3460);
  });
});

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "voice", kind: "audio", clips: [{ ...newMediaClip("audio", "talk", 1000, 3000), id: "v" }] },
    { id: "music", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 6000), id: "m" }] },
  ];
  d.durationMs = 6000;
  return d;
}

const rule: DuckingRule = { triggerTrackIds: ["voice"], reduceDb: 12, attackMs: 250, releaseMs: 500, holdMs: 300, sensitivity: 0.5 };

const talk: SpeechAnalysis = analyzeSpeech(speechLike([[0.5, 1.5]], 3), RATE);

describe("speech from several voices", () => {
  it("joins overlapping and close regions once, in time order", () => {
    const merged = mergeRegions([{ fromMs: 1000, toMs: 2000 }, { fromMs: 0, toMs: 500 }, { fromMs: 1500, toMs: 2500 }, { fromMs: 2700, toMs: 3000 }], 300);
    expect(merged).toEqual([{ fromMs: 0, toMs: 500 }, { fromMs: 1000, toMs: 3000 }]);
  });
});

describe("ducking", () => {
  it("places speech on the timeline and ducks around it with attack and release", () => {
    const regions = timelineSpeech(doc(), rule, (assetId) => (assetId === "talk" ? talk : undefined));
    expect(regions).toHaveLength(1);
    expect(regions[0].fromMs).toBeGreaterThanOrEqual(1460);
    expect(duckDb(regions, rule, regions[0].fromMs - 250)).toBeCloseTo(0, 6);
    expect(duckDb(regions, rule, regions[0].fromMs - 125)).toBeCloseTo(6, 1);
    expect(duckDb(regions, rule, regions[0].fromMs + 100)).toBe(12);
    expect(duckDb(regions, rule, regions[0].toMs + 250)).toBeCloseTo(6, 1);
    expect(duckDb(regions, rule, regions[0].toMs + 600)).toBe(0);
  });

  it("validates the rule on the document", () => {
    const d = doc();
    d.tracks[1].ducking = rule;
    expect(documentIssue("video", d)).toBeNull();
    expect(duckingIssue({ ...d.tracks[1], ducking: { ...rule, triggerTrackIds: ["music"] } }, d)).toBe("invalid");
    expect(duckingIssue({ ...d.tracks[1], ducking: { ...rule, triggerTrackIds: ["nope"] } }, d)).toBe("invalid");
    expect(duckingIssue({ ...d.tracks[1], ducking: { ...rule, reduceDb: 90 } }, d)).toBe("out_of_range");
    const cycle = doc();
    cycle.tracks[1].ducking = rule;
    cycle.tracks[0].ducking = { ...rule, triggerTrackIds: ["music"] };
    expect(documentIssue("video", cycle)).toEqual({ field: "document.tracks", code: "invalid" });
  });

  it("bakes the duck into gain keys on the ducked clips and removes the rule", () => {
    const d = doc();
    d.tracks[1].ducking = rule;
    const result = bakeDucking(d, "music", (assetId) => (assetId === "talk" ? talk : undefined));
    if (!result.ok) throw new Error(result.reason);
    const baked = result.document;
    expect(baked.tracks[1].ducking).toBeUndefined();
    const keys = baked.tracks[1].clips[0].keyframes?.gainDb ?? [];
    expect(keys.length).toBeGreaterThanOrEqual(4);
    expect(Math.min(...keys.map((k) => k.value))).toBe(-12);
    expect(documentIssue("video", baked)).toBeNull();
  });
});

describe("ducking in the audio plan", () => {
  it("dips the music under the voice once the voice has been analyzed, and restarts the voice when it is", () => {
    const d = doc();
    d.tracks[1].ducking = rule;
    d.tracks[1].gainDb = -3;
    const speech = (assetId: string) => (assetId === "talk" ? talk : undefined);
    const music = audioPlan(d, 0, { speech }).find((voice) => voice.clipId === "m")!;
    const regions = timelineSpeech(d, rule, speech);
    expect(gainAt(music.gain, regions[0].fromMs + 100)).toBeCloseTo(dbToGain(-15), 3);
    expect(gainAt(music.gain, 100)).toBeCloseTo(dbToGain(-3), 3);
    const before = audioVoiceKeys(d, { speech: () => undefined }).get("m");
    const after = audioVoiceKeys(d, { speech }).get("m");
    expect(before).not.toBe(after);
  });
});

describe("trigger assets", () => {
  it("lists the media whose speech the ducked tracks listen to", () => {
    const d = doc();
    expect(triggerAssetIds(d)).toEqual([]);
    d.tracks[1].ducking = rule;
    expect(triggerAssetIds(d)).toEqual(["talk"]);
  });
});

describe("editing a ducking rule", () => {
  it("fills defaults on the first change and keeps earlier settings on later ones", () => {
    const first = withDucking(undefined, { triggerTrackIds: ["voice"] });
    expect(first).toEqual({ triggerTrackIds: ["voice"], reduceDb: 12, attackMs: 250, releaseMs: 500, holdMs: 300, sensitivity: 0.5 });
    expect(withDucking({ ...first, reduceDb: 18 }, { releaseMs: 800, holdMs: undefined })).toMatchObject({ reduceDb: 18, releaseMs: 800, holdMs: 300 });
  });
});

describe("volume keys by hand", () => {
  it("records a moment on a song as a gain key and folds the lane into the volume when it stops", () => {
    const song = { ...newMediaClip("audio", "song", 0, 2000), volume: 1, keyframes: { gainDb: [{ atMs: 0, value: -6, easing: "linear" as const }] } };
    expect(recordMoment({ ...song, keyframes: undefined }, 500, 1)?.keyframes).toEqual({ gainDb: [{ atMs: 500, value: 0, easing: "linear" }] });
    const stopped = toggleAnimation(song, "gainDb", 0, 1);
    expect(stopped.keyframes).toBeUndefined();
    expect(stopped.volume).toBeCloseTo(dbToGain(-6), 6);
  });
});
