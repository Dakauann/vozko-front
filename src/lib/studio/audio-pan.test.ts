import { describe, expect, it } from "vitest";

import { clipPanAt, isCentered, PAN_RANGE, panGains, panPoints, trackPanIssue, clipPanIssue } from "./audio-pan";
import { emptyVideoDocument, newMediaClip, type Track } from "./document";
import { KEYFRAME_RANGES } from "./keyframes";

const power = ({ left, right }: { left: number; right: number }) => left * left + right * right;

describe("pan law", () => {
  it("keeps a centered mono clip at the level it plays today and holds its power while panning", () => {
    expect(panGains(0, 0, 1).left).toBeCloseTo(1, 9);
    expect(panGains(0, 0, 1).right).toBeCloseTo(1, 9);
    for (const pan of [-1, -0.6, -0.25, 0.3, 0.8, 1]) expect(power(panGains(pan, 0, 1))).toBeCloseTo(2, 9);
    expect(panGains(-1, 0, 1)).toEqual({ left: Math.SQRT2, right: expect.closeTo(0, 9) });
    expect(panGains(1, 0, 1).left).toBeCloseTo(0, 9);
  });

  it("balances a stereo clip by lowering the far side and never touching the near one", () => {
    expect(panGains(0, 0, 2)).toEqual({ left: 1, right: 1 });
    expect(panGains(-0.5, 0, 2)).toEqual({ left: 1, right: expect.closeTo(Math.SQRT1_2, 9) });
    expect(panGains(1, 0, 2)).toEqual({ left: expect.closeTo(0, 9), right: 1 });
  });

  it("applies the track pan as a balance after the clip pan", () => {
    const both = panGains(-1, 1, 1);
    expect(both.left).toBeCloseTo(0, 9);
    expect(both.right).toBeCloseTo(0, 9);
    const track = panGains(0, -0.5, 1);
    expect(track.left).toBeCloseTo(1, 9);
    expect(track.right).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it("clamps values outside the range", () => {
    expect(panGains(-3, 0, 1)).toEqual(panGains(-1, 0, 1));
    expect(PAN_RANGE).toEqual([-1, 1]);
  });
});

describe("pan on clips and tracks", () => {
  const clip = (extra: object = {}) => ({ ...newMediaClip("audio", "a", 1000, 2000), ...extra });

  it("reads the static pan or the keyed lane in clip time", () => {
    expect(clipPanAt(clip(), 500)).toBe(0);
    expect(clipPanAt(clip({ pan: -0.4 }), 500)).toBe(-0.4);
    const keyed = clip({ pan: 0.9, keyframes: { pan: [{ atMs: 0, value: -1, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }] } });
    expect(clipPanAt(keyed, 500)).toBeCloseTo(0, 9);
    const overshoot = clip({ keyframes: { pan: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1, easing: "elastic" }] } });
    for (let ms = 0; ms <= 1000; ms += 25) expect(Math.abs(clipPanAt(overshoot, ms))).toBeLessThanOrEqual(1);
  });

  it("samples pan points only when the lane moves", () => {
    expect(panPoints(clip({ pan: 0.5 }), 0, 2000)).toEqual([{ atMs: 0, value: 0.5 }]);
    const keyed = clip({ keyframes: { pan: [{ atMs: 0, value: -1, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }] } });
    const points = panPoints(keyed, 500, 2000);
    expect(points[0]).toEqual({ atMs: 0, value: expect.closeTo(0, 9) });
    expect(points.at(-1)!.value).toBe(1);
    expect(points.length).toBeLessThan(60);
  });

  it("knows when a voice needs no panning at all", () => {
    const track: Track = { id: "t", kind: "audio", clips: [] };
    expect(isCentered(clip(), track)).toBe(true);
    expect(isCentered(clip({ pan: 0.2 }), track)).toBe(false);
    expect(isCentered(clip(), { ...track, pan: -0.3 })).toBe(false);
    expect(isCentered(clip({ keyframes: { pan: [{ atMs: 0, value: 0, easing: "linear" }] } }), track)).toBe(false);
  });

  it("validates pan only on audio, inside the range", () => {
    const doc = emptyVideoDocument("story");
    const audio = doc.tracks[2];
    expect(trackPanIssue({ ...audio, pan: 0.5 })).toBeNull();
    expect(trackPanIssue({ ...audio, pan: 1.5 })).toBe("out_of_range");
    expect(trackPanIssue({ ...doc.tracks[0], pan: 0.5 })).toBe("invalid");
    expect(clipPanIssue(clip({ pan: -1 }))).toBeNull();
    expect(clipPanIssue(clip({ pan: -1.01 }))).toBe("out_of_range");
    expect(clipPanIssue({ ...newMediaClip("video", "v", 0, 1000), pan: 0.2 })).toBe("invalid");
  });

  it("is an audio keyframe property from left to right", () => {
    expect(KEYFRAME_RANGES.pan).toEqual([-1, 1]);
  });
});
