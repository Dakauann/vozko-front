import { describe, expect, it } from "vitest";

import { dbToGain, gainToDb } from "./audio-gain";
import { newMediaClip, type Clip } from "./document";
import { addGainKey, bandGain, bandKeyAt, bandY, dragGainKey, dragGainLine, nudgeGainKey, removeGainKey, segmentKeys } from "./gain-band";
import { keyframeFault } from "./keyframes";

const H = 40;
const W = 400;

function song(extra: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("audio", "a", 1000, 4000), id: "s", ...extra };
}

const keyed = (...keys: [number, number][]) => song({ keyframes: { gainDb: keys.map(([atMs, value]) => ({ atMs, value, easing: "linear" as const })) } });

describe("the volume line scale", () => {
  it("puts +6 dB at the top, silence at the bottom and spreads the decibels in between", () => {
    expect(bandY(dbToGain(6), H)).toBeCloseTo(0, 6);
    expect(bandY(0, H)).toBe(H);
    expect(bandY(1, H)).toBeLessThan(H * 0.2);
    expect(bandY(dbToGain(-20), H)).toBeLessThan(H * 0.6);
    for (const db of [-40, -20, -6, 0, 3]) expect(gainToDb(bandGain(bandY(dbToGain(db), H), H))).toBeCloseTo(db, 6);
    expect(bandGain(-10, H)).toBeCloseTo(dbToGain(6), 6);
    expect(bandGain(H + 10, H)).toBe(0);
  });
});

describe("rubber band keys", () => {
  it("adds a key on the line without changing what plays", () => {
    const plain = addGainKey(song(), 1500);
    expect(plain.keyframes?.gainDb).toEqual([{ atMs: 1500, value: 0, easing: "linear" }]);
    const ramp = keyed([0, 0], [2000, -20]);
    expect(addGainKey(ramp, 1000).keyframes?.gainDb?.[1]).toEqual({ atMs: 1000, value: -10, easing: "linear" });
  });

  it("drags a key in decibels and in time, kept between its neighbours and inside the range", () => {
    const clip = keyed([0, 0], [1000, -6], [3000, 0]);
    expect(dragGainKey(clip, 1000, 1500, -12)?.gainDb?.map((k) => [k.atMs, k.value])).toEqual([[0, 0], [1500, -12], [3000, 0]]);
    expect(dragGainKey(clip, 1000, 5000, 20)?.gainDb?.[1]).toEqual({ atMs: 2999, value: 6, easing: "linear" });
    expect(dragGainKey(clip, 1000, -50, -90)?.gainDb?.[1]).toMatchObject({ atMs: 1, value: -60 });
    expect(dragGainKey(clip, 0, -200, -3)?.gainDb?.[0]).toMatchObject({ atMs: 0, value: -3 });
    expect(keyframeFault(dragGainKey(clip, 1000, 1200, -3), clip.transform)).toBeNull();
  });

  it("moves the segment under the pointer, or the volume when there are no keys", () => {
    const clip = keyed([500, -6], [1500, -6], [3000, 0]);
    expect(segmentKeys(clip, 1000)).toEqual([500, 1500]);
    expect(segmentKeys(clip, 100)).toEqual([500]);
    expect(segmentKeys(clip, 3500)).toEqual([3000]);
    const moved = dragGainLine(clip, 1000, -3);
    expect(moved.keyframes?.gainDb?.map((k) => k.value)).toEqual([-9, -9, 0]);
    expect(dragGainLine(song({ volume: 1 }), 1000, -6)).toEqual({ volume: expect.closeTo(dbToGain(-6), 3) });
    expect(dragGainLine(song({ volume: 1.5 }), 1000, 12)).toEqual({ volume: 2 });
  });

  it("removes and nudges a key", () => {
    const clip = keyed([0, 0], [1000, -6]);
    expect(removeGainKey(clip, 1000).keyframes?.gainDb).toEqual([{ atMs: 0, value: 0, easing: "linear" }]);
    expect(removeGainKey(keyed([0, 0]), 0).keyframes).toBeUndefined();
    expect(nudgeGainKey(clip, 1000, 1).keyframes?.gainDb?.[1].value).toBe(-5);
    expect(nudgeGainKey(clip, 0, 10).keyframes?.gainDb?.[0].value).toBe(6);
  });

  it("finds the key under the pointer on the drawn line", () => {
    const clip = keyed([0, 0], [2000, -20]);
    const x = (2000 / 4000) * W;
    const y = bandY(dbToGain(-20), H);
    expect(bandKeyAt(clip, 0, x + 3, y - 2, W, H)).toBe(2000);
    expect(bandKeyAt(clip, 0, x + 30, y, W, H)).toBeNull();
    expect(bandKeyAt(clip, 0, x, y + 15, W, H)).toBeNull();
  });
});
