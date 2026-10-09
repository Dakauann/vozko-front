import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "./document";
import {
  audioPlanChange,
  audioVoiceKeys,
  audioPlan,
  boxStyle,
  clockPosition,
  clockReachedEdge,
  fadeLevel,
  fitFrame,
  focusedPlan,
  zoomAround,
  gainEnvelope,
  idleClock,
  MAX_OUTPUT_LATENCY_SEC,
  outputLatencySec,
  shuttleRate,
  startClock,
  stopClock,
  syncVideo,
  visualPlan,
} from "./playback";

function media(id: string, type: "video" | "image" | "audio", startMs: number, durationMs: number, extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip(type, `asset-${id}`, startMs, durationMs), id, ...extra };
}

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  const overlay = { ...newOverlayClip(newTextLayer("Oi"), 1000, 2000), id: "o", fadeInMs: 500 };
  d.tracks = [
    { id: "v1", kind: "visual", clips: [media("a", "video", 0, 2000, { trimInMs: 500 }), media("b", "image", 3000, 2000)] },
    { id: "v2", kind: "visual", clips: [overlay] },
    { id: "au", kind: "audio", clips: [media("m", "audio", 0, 5000, { trimInMs: 1000, volume: 0.5, fadeInMs: 1000, fadeOutMs: 1000 })] },
  ];
  d.durationMs = 5000;
  return d;
}

describe("playback clock", () => {
  it("advances from the origin at the rate and clamps to the timeline", () => {
    const clock = startClock(1000, 10);
    expect(clockPosition(clock, 10.5, 5000)).toBe(1500);
    expect(clockPosition(clock, 20, 5000)).toBe(5000);
    expect(clockPosition(startClock(1000, 10, -2), 10.25, 5000)).toBe(500);
    expect(clockPosition(idleClock(800), 99, 5000)).toBe(800);
  });

  it("holds at the origin until a clock that starts later begins", () => {
    const clock = startClock(1000, 10.05);
    expect(clockPosition(clock, 9.9, 5000)).toBe(1000);
    expect(clockPosition(clock, 10.55, 5000)).toBe(1500);
  });

  it("measures how late the speakers are from what the context reports", () => {
    expect(outputLatencySec({ outputLatency: 0.04, baseLatency: 0.01 })).toBeCloseTo(0.05);
    expect(outputLatencySec({ baseLatency: 0.01 })).toBeCloseTo(0.01);
    expect(outputLatencySec({})).toBe(0);
    expect(outputLatencySec({ outputLatency: Number.NaN, baseLatency: -1 })).toBe(0);
    expect(outputLatencySec({ outputLatency: 3 })).toBe(MAX_OUTPUT_LATENCY_SEC);
  });

  it("stops where it was and reports the edges", () => {
    const clock = startClock(1000, 10);
    expect(stopClock(clock, 11, 5000)).toEqual(idleClock(2000));
    expect(clockReachedEdge(clock, 14.1, 5000)).toBe(true);
    expect(clockReachedEdge(clock, 13, 5000)).toBe(false);
    expect(clockReachedEdge(startClock(500, 0, -1), 0.6, 5000)).toBe(true);
  });

  it("follows J K L shuttle rules", () => {
    expect(shuttleRate(0, false, 1)).toBe(1);
    expect(shuttleRate(1, true, 1)).toBe(2);
    expect(shuttleRate(8, true, 1)).toBe(8);
    expect(shuttleRate(2, true, -1)).toBe(-1);
    expect(shuttleRate(-1, true, -1)).toBe(-2);
    expect(shuttleRate(4, true, 0)).toBe(0);
  });
});

describe("visual plan", () => {
  it("lists active clips bottom first with source time and fades", () => {
    const plan = visualPlan(doc(), 1250);
    expect(plan.map((p) => [p.clipId, p.active, p.trackIndex])).toEqual([
      ["a", true, 0],
      ["o", true, 1],
    ]);
    expect(plan[0].sourceMs).toBe(1750);
    expect(plan[1].opacity).toBeCloseTo(0.5);
    expect(plan[1].fit).toBe("contain");
  });

  it("premounts clips starting soon, paused at their first frame", () => {
    const plan = visualPlan(doc(), 2000);
    const upcoming = plan.find((p) => p.clipId === "b");
    expect(upcoming).toMatchObject({ active: false, opacity: 0, sourceMs: 0 });
    expect(visualPlan(doc(), 1000).some((p) => p.clipId === "b")).toBe(false);
  });

  it("skips hidden tracks", () => {
    const d = doc();
    d.tracks[1].hidden = true;
    expect(visualPlan(d, 1200).map((p) => p.clipId)).toEqual(["a"]);
  });

  it("turns a box into CSS percentages", () => {
    expect(boxStyle({ transform: { x: 0.5, y: 0.25, w: 0.5, h: 0.5, rotation: 15, opacity: 1 }, opacity: 0.4, trackIndex: 2 })).toEqual({
      left: "25%",
      top: "0%",
      width: "50%",
      height: "50%",
      transform: "rotate(15deg)",
      opacity: 0.4,
      zIndex: 3,
    });
  });
});

describe("video sync", () => {
  it("hard seeks only past the drift tolerance while playing", () => {
    expect(syncVideo(1000, 1050, { playing: true, rate: 1, active: true })).toEqual({ seekToMs: null, play: true, playbackRate: 1 });
    expect(syncVideo(1000, 1100, { playing: true, rate: 1, active: true }).seekToMs).toBe(1100);
  });

  it("parks inactive or paused videos on the exact frame", () => {
    expect(syncVideo(0, 500, { playing: true, rate: 1, active: false })).toEqual({ seekToMs: 500, play: false, playbackRate: 1 });
    expect(syncVideo(1000, 1020, { playing: false, rate: 0, active: true }).seekToMs).toBe(1020);
    expect(syncVideo(1000, 1010, { playing: false, rate: 0, active: true }).seekToMs).toBeNull();
  });

  it("scrubs in reverse instead of playing", () => {
    expect(syncVideo(1000, 900, { playing: true, rate: -1, active: true })).toEqual({ seekToMs: 900, play: false, playbackRate: 1 });
    expect(syncVideo(1000, 1000, { playing: true, rate: 2, active: true })).toEqual({ seekToMs: null, play: true, playbackRate: 2 });
  });
});

describe("audio plan", () => {
  it("computes fade levels", () => {
    const clip = { durationMs: 4000, fadeInMs: 1000, fadeOutMs: 2000 };
    expect(fadeLevel(clip, 0)).toBe(0);
    expect(fadeLevel(clip, 500)).toBe(0.5);
    expect(fadeLevel(clip, 1500)).toBe(1);
    expect(fadeLevel(clip, 3000)).toBe(0.5);
    expect(fadeLevel(clip, 4000)).toBe(0);
    expect(fadeLevel(clip, 5000)).toBe(0);
  });

  it("builds the gain envelope from the play point", () => {
    const clip = { durationMs: 5000, fadeInMs: 1000, fadeOutMs: 1000, volume: 0.5 };
    expect(gainEnvelope(clip, 0)).toEqual([
      { atMs: 0, value: 0 },
      { atMs: 1000, value: 0.5 },
      { atMs: 4000, value: 0.5 },
      { atMs: 5000, value: 0 },
    ]);
    expect(gainEnvelope(clip, 500)).toEqual([
      { atMs: 0, value: 0.25 },
      { atMs: 500, value: 0.5 },
      { atMs: 3500, value: 0.5 },
      { atMs: 4500, value: 0 },
    ]);
    expect(gainEnvelope({ durationMs: 2000, fadeInMs: 0, fadeOutMs: 0, volume: 1 }, 0)).toEqual([
      { atMs: 0, value: 1 },
      { atMs: 2000, value: 1 },
    ]);
  });

  it("schedules audio clips from the playhead with trim offset", () => {
    expect(audioPlan(doc(), 2000)).toEqual([
      {
        clipId: "m",
        assetId: "asset-m",
        delayMs: 0,
        offsetMs: 3000,
        durationMs: 3000,
        gain: [
          { atMs: 0, value: 0.5 },
          { atMs: 2000, value: 0.5 },
          { atMs: 3000, value: 0 },
        ],
      },
    ]);
  });

  it("delays clips that start later and skips muted or hidden audio tracks", () => {
    const d = doc();
    d.tracks[2].clips[0] = media("m", "audio", 1500, 1000);
    expect(audioPlan(d, 500)[0]).toMatchObject({ delayMs: 1000, offsetMs: 0, durationMs: 1000 });
    d.tracks[2].muted = true;
    expect(audioPlan(d, 0)).toEqual([]);
    d.tracks[2].muted = false;
    d.tracks[2].hidden = true;
    expect(audioPlan(d, 0)).toEqual([]);
  });
});

describe("fitFrame", () => {
  it("fits the canvas inside the container with a margin", () => {
    expect(fitFrame({ width: 498, height: 848 }, { width: 1080, height: 1920 })).toEqual({ width: 450, height: 800 });
    expect(fitFrame({ width: 1048, height: 448 }, { width: 1080, height: 1080 })).toEqual({ width: 400, height: 400 });
    expect(fitFrame({ width: 10, height: 10 }, { width: 1080, height: 1080 })).toEqual({ width: 0, height: 0 });
  });
});

describe("motion and solo in playback", () => {
  it("moves an entering clip in the preview like the renderer", () => {
    const d = doc();
    d.tracks[1].clips[0] = { ...d.tracks[1].clips[0], motionIn: { edge: "bottom", durationMs: 1000 } };
    const entering = visualPlan(d, 1000).find((p) => p.clipId === "o")!;
    expect(entering.transform.y).toBeCloseTo(d.tracks[1].clips[0].transform.y + 0.2);
    const resting = visualPlan(d, 2500).find((p) => p.clipId === "o")!;
    expect(resting.transform).toEqual(d.tracks[1].clips[0].transform);
  });

  it("plays only soloed audio tracks while any is soloed", () => {
    const d = doc();
    d.tracks.push({ id: "voice", kind: "audio", clips: [media("v", "audio", 0, 1000)] });
    expect(audioPlan(d, 0).map((v) => v.clipId)).toEqual(["m", "v"]);
    expect(audioPlan(d, 0, { soloTrackIds: ["voice"] }).map((v) => v.clipId)).toEqual(["v"]);
  });
});

describe("keyframes in playback", () => {
  it("evaluates the animated transform and opacity at the clip local time", () => {
    const d = doc();
    d.tracks[0].clips[1] = {
      ...d.tracks[0].clips[1],
      keyframes: {
        x: [
          { atMs: 0, value: 0.2, easing: "linear" },
          { atMs: 1000, value: 0.6, easing: "linear" },
        ],
        opacity: [{ atMs: 0, value: 0.5, easing: "linear" }],
        scale: [{ atMs: 0, value: 0.5, easing: "linear" }],
      },
    };
    const item = visualPlan(d, 3500).find((p) => p.clipId === "b")!;
    expect(item.transform.x).toBeCloseTo(0.4);
    expect(item.transform.w).toBeCloseTo(0.5);
    expect(item.opacity).toBeCloseTo(0.5);
  });
});

describe("disabled clips", () => {
  it("are skipped in the preview and the mix", () => {
    const d = doc();
    d.tracks[0].clips[0] = { ...d.tracks[0].clips[0], disabled: true };
    d.tracks[2].clips[0] = { ...d.tracks[2].clips[0], disabled: true };
    expect(visualPlan(d, 500).map((p) => p.clipId)).not.toContain("a");
    expect(audioPlan(d, 0)).toEqual([]);
  });
});

describe("focus in the preview", () => {
  it("dims or hides the other clips", () => {
    const items = visualPlan(doc(), 1500);
    const dimmed = focusedPlan(items, "o", false);
    expect(dimmed.find((i) => i.clipId === "a")?.opacity).toBeCloseTo(0.3);
    expect(dimmed.find((i) => i.clipId === "o")?.opacity).toBe(items.find((i) => i.clipId === "o")?.opacity);
    expect(focusedPlan(items, "o", true).map((i) => i.clipId)).toEqual(["o"]);
    expect(focusedPlan(items, null, true)).toEqual(items);
  });

  it("zooms around the focused box", () => {
    const zoom = zoomAround({ x: 0.5, y: 0.8, w: 0.2, h: 0.1 });
    expect(zoom.scale).toBeCloseTo(3);
    expect([zoom.originX, zoom.originY]).toEqual([0.5, 0.8]);
    expect(zoomAround({ x: 0.5, y: 0.5, w: 1, h: 1 }).scale).toBe(1);
  });
});

describe("audio plan changes", () => {
  it("leaves the sound alone when an edit does not touch it", () => {
    const before = doc();
    const after = doc();
    after.tracks[1].clips[0] = { ...after.tracks[1].clips[0], transform: { ...after.tracks[1].clips[0].transform, x: 0.2 } };
    expect(audioPlanChange(audioVoiceKeys(before), audioVoiceKeys(after))).toEqual({ stop: [], start: [] });
  });

  it("restarts only the clip whose sound changed", () => {
    const before = doc();
    before.tracks[2].clips.push(media("n", "audio", 0, 3000));
    for (const change of [{ startMs: 100 }, { trimInMs: 1200 }, { volume: 0.9 }, { fadeOutMs: 0 }, { durationMs: 4000 }]) {
      const after = structuredClone(before);
      after.tracks[2].clips[0] = { ...after.tracks[2].clips[0], ...change };
      expect(audioPlanChange(audioVoiceKeys(before), audioVoiceKeys(after)), JSON.stringify(change)).toEqual({ stop: ["m"], start: ["m"] });
    }
  });

  it("stops what went silent and starts what is new", () => {
    const before = doc();
    const muted = structuredClone(before);
    muted.tracks[2].muted = true;
    expect(audioPlanChange(audioVoiceKeys(before), audioVoiceKeys(muted))).toEqual({ stop: ["m"], start: [] });
    const added = structuredClone(before);
    added.tracks[2].clips.push(media("n", "audio", 0, 3000));
    expect(audioPlanChange(audioVoiceKeys(before), audioVoiceKeys(added))).toEqual({ stop: [], start: ["n"] });
    expect(audioPlanChange(audioVoiceKeys(before), audioVoiceKeys(before, { soloTrackIds: ["none"] }))).toEqual({ stop: ["m"], start: [] });
  });
});
