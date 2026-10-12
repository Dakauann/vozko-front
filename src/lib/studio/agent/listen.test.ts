import { describe, expect, it } from "vitest";

import { SILENCE_DB } from "../audio-gain";
import { SILENT_DB, type Levels } from "../audio-meter";
import { DUCKING_DEFAULTS } from "../ducking";
import { emptyVideoDocument, newMediaClip, STUDIO_LIMITS, type VideoDocument } from "../document";
import { audibleTrackIds, listenPlan, listenReport, listenRequestOf, MAX_LISTEN_WINDOWS, stemDocument, windowSpans } from "./listen";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "cam", 0, 6000), id: "cam" }] },
    { id: "voice", kind: "audio", name: "Locução", clips: [{ ...newMediaClip("audio", "vo", 0, 6000), id: "vo" }] },
    { id: "music", kind: "audio", name: "Trilha", ducking: { triggerTrackIds: ["voice"], ...DUCKING_DEFAULTS }, clips: [{ ...newMediaClip("audio", "song", 0, 6000), id: "song" }] },
    { id: "muted", kind: "audio", muted: true, clips: [{ ...newMediaClip("audio", "fx", 0, 6000), id: "fx" }] },
  ];
  d.durationMs = 6000;
  return d;
}

const level = (lufs: number, peakDb = lufs + 6): Levels => ({ lufs, peakDb, rmsDb: lufs - 1 });

describe("listenPlan", () => {
  it("listens to the whole video in one second windows by default, with ducking triggers as the voice", () => {
    expect(listenPlan(doc(), {})).toEqual({ ok: true, fromMs: 0, toMs: 6000, windowMs: 1000, voiceTrackIds: ["voice"] });
  });

  it("takes a range, a window and the voice tracks Elo names", () => {
    expect(listenPlan(doc(), { from_ms: 1000, to_ms: 3000, window_ms: 500, voice_track_ids: ["music"] })).toEqual({ ok: true, fromMs: 1000, toMs: 3000, windowMs: 500, voiceTrackIds: ["music"] });
  });

  it("widens the window so a long range stays a short table", () => {
    const long = { ...doc(), durationMs: STUDIO_LIMITS.maxVideoMs };
    const plan = listenPlan(long, { window_ms: 250 });
    expect(plan.ok && Math.ceil(STUDIO_LIMITS.maxVideoMs / plan.windowMs)).toBeLessThanOrEqual(MAX_LISTEN_WINDOWS);
  });

  it("refuses a voice track that is not an audible audio track and a video without sound", () => {
    expect(listenPlan(doc(), { voice_track_ids: ["v1"] }).ok).toBe(false);
    const silent = { ...doc(), tracks: doc().tracks.filter((t) => t.kind === "visual") };
    expect(listenPlan(silent, {}).ok).toBe(false);
    expect(listenPlan(doc(), { from_ms: 3000, to_ms: 3000 }).ok).toBe(false);
  });
});

describe("stems", () => {
  it("lists only tracks that are heard", () => {
    expect(audibleTrackIds(doc())).toEqual(["voice", "music"]);
  });

  it("keeps one track and silences the others without breaking the ducking it reacts to", () => {
    const stem = stemDocument(doc(), "music");
    expect(stem.tracks.find((t) => t.id === "voice")?.gainDb).toBe(SILENCE_DB);
    expect(stem.tracks.find((t) => t.id === "voice")?.muted).toBeFalsy();
    expect(stem.tracks.find((t) => t.id === "music")?.gainDb).toBeUndefined();
    expect(stem.tracks.find((t) => t.id === "music")?.ducking?.triggerTrackIds).toEqual(["voice"]);
  });
});

describe("windowSpans", () => {
  it("cuts the range into windows, the last one shorter", () => {
    expect(windowSpans({ fromMs: 0, toMs: 2500, windowMs: 1000 })).toEqual([
      { fromMs: 0, toMs: 1000 },
      { fromMs: 1000, toMs: 2000 },
      { fromMs: 2000, toMs: 2500 },
    ]);
  });
});

describe("listenReport", () => {
  const plan = { fromMs: 0, toMs: 4000, windowMs: 1000, voiceTrackIds: ["voice"] };

  it("flags where the music sits less than 10 dB under the voice while someone speaks", () => {
    const report = listenReport({
      plan,
      mix: { integrated: -14.2, windows: [level(-14), level(-13), level(-15), level(SILENT_DB, SILENT_DB)], limiterMs: [0, 12, 0, 0] },
      stems: [
        { trackId: "voice", name: "Locução", integrated: -16, windows: [level(-16), level(-16), level(-16), level(SILENT_DB, SILENT_DB)] },
        { trackId: "music", name: "Trilha", integrated: -20, windows: [level(-30), level(-20), level(-21), level(SILENT_DB, SILENT_DB)] },
      ],
      speech: [{ fromMs: 0, toMs: 3000 }],
    });
    expect(report.windows[0].voice_minus_music_db).toBe(14);
    expect(report.windows[1].voice_minus_music_db).toBe(4);
    expect(report.summary.music_close_to_voice).toEqual([{ from_ms: 1000, to_ms: 3000, min_db: 4 }]);
    expect(report.summary.silent).toEqual([{ from_ms: 3000, to_ms: 4000 }]);
    expect(report.summary.integrated_lufs).toBe(-14.2);
    expect(report.summary.limiter_ms).toBe(12);
    expect(report.summary.max_peak_db).toBe(-7);
    expect(report.windows[1].tracks).toEqual({ voice: -16, music: -20 });
    expect(report.tracks).toEqual([
      { track_id: "voice", name: "Locução", role: "voice", integrated_lufs: -16 },
      { track_id: "music", name: "Trilha", role: "other", integrated_lufs: -20 },
    ]);
  });

  it("tells which side each window leans to when the mix is panned", () => {
    const report = listenReport({
      plan: { ...plan, voiceTrackIds: [] },
      mix: { integrated: -14, windows: [{ ...level(-14), balanceDb: -6.04 }, { ...level(-14), balanceDb: 0.3 }, level(-14), { ...level(-14), balanceDb: 9 }], limiterMs: [0, 0, 0, 0] },
      stems: [{ trackId: "music", integrated: -14, windows: [{ ...level(-14), balanceDb: -6.04 }, level(-14), level(-14), level(-14)] }],
      speech: [],
    });
    expect(report.windows.map((w) => w.balance_db)).toEqual([-6, undefined, undefined, 9]);
    expect(report.windows[0].tracks).toEqual({ music: -14 });
  });

  it("compares nothing when no track is the voice", () => {
    const report = listenReport({
      plan: { ...plan, voiceTrackIds: [] },
      mix: { integrated: -14, windows: [level(-14), level(-14), level(-14), level(-14)], limiterMs: [0, 0, 0, 0] },
      stems: [{ trackId: "music", integrated: -14, windows: [level(-14), level(-14), level(-14), level(-14)] }],
      speech: [],
    });
    expect(report.windows.every((w) => w.voice_minus_music_db === undefined)).toBe(true);
    expect(report.summary.music_close_to_voice).toEqual([]);
  });
});

describe("listenRequestOf", () => {
  it("keeps only well formed fields", () => {
    expect(listenRequestOf({ from_ms: 1000, to_ms: "x", window_ms: 500, voice_track_ids: ["a", 3, ""] })).toEqual({ from_ms: 1000, window_ms: 500, voice_track_ids: ["a"] });
    expect(listenRequestOf(null)).toEqual({});
  });
});
