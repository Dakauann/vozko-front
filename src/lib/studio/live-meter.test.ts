import { describe, expect, it } from "vitest";

import { formatLevel, heldPeak, IDLE_METER, meterFill, meterIdle, METER_FLOOR_DB, peakOf, ShortTermLoudness, stepMeter, tailPower, IDLE_PEAK, clearClip } from "./live-meter";

describe("live meter math", () => {
  it("reads the sample peak and the power of the newest samples", () => {
    expect(peakOf(Float32Array.from([0.1, -0.8, 0.3]))).toBeCloseTo(0.8, 6);
    expect(tailPower(Float32Array.from([1, 1, 0.5, 0.5]), 2)).toBeCloseTo(0.25, 9);
    expect(tailPower(Float32Array.from([1, 1]), 10)).toBeCloseTo(1, 9);
  });

  it("holds a peak, then lets it fall at a steady rate", () => {
    const first = heldPeak(IDLE_PEAK, -6, 0);
    expect(first).toEqual({ db: -6, holdUntilMs: 1000, atMs: 0 });
    expect(heldPeak(first, -30, 500).db).toBe(-6);
    const falling = heldPeak(first, -30, 1500);
    expect(falling.db).toBeCloseTo(-16, 6);
    expect(heldPeak(falling, -3, 1600)).toEqual({ db: -3, holdUntilMs: 2600, atMs: 1600 });
    expect(heldPeak(falling, -90, 10_000).db).toBe(METER_FLOOR_DB);
  });

  it("averages power over the last three seconds for short term loudness", () => {
    const meter = new ShortTermLoudness();
    expect(meter.lufs()).toBeNull();
    meter.push(1, 0);
    meter.push(1, 1000);
    expect(meter.lufs()).toBeCloseTo(-0.691, 3);
    meter.push(0.1, 4500);
    expect(meter.lufs()).toBeCloseTo(-10.691, 3);
    meter.reset();
    expect(meter.lufs()).toBeNull();
  });

  it("maps decibels onto the meter scale", () => {
    expect(meterFill(0)).toBe(1);
    expect(meterFill(METER_FLOOR_DB)).toBe(0);
    expect(meterFill(-200)).toBe(0);
    expect(meterFill(-30)).toBeCloseTo(0.5, 9);
  });
});

describe("a stereo meter over frames", () => {
  it("shows each side's peak with its hold, latches a clip and settles back to idle", () => {
    expect(meterIdle(IDLE_METER)).toBe(true);
    const loud = stepMeter(IDLE_METER, { left: 0.5, right: 1 }, 0);
    expect(loud.left.db).toBeCloseTo(-6.02, 2);
    expect(loud.leftDb).toBeCloseTo(-6.02, 2);
    expect(loud.right.db).toBe(0);
    expect(loud.clipped).toBe(true);
    expect(meterIdle(loud)).toBe(false);
    const quiet = stepMeter(loud, { left: 0, right: 0 }, 500);
    expect(quiet.leftDb).toBe(METER_FLOOR_DB);
    expect(quiet.left.db).toBeCloseTo(-6.02, 2);
    expect(quiet.clipped).toBe(true);
    expect(clearClip(quiet).clipped).toBe(false);
    const settled = stepMeter(quiet, { left: 0, right: 0 }, 10_000);
    expect(meterIdle(settled)).toBe(true);
    expect(settled.clipped).toBe(true);
  });

  it("writes levels in decibels with silence as minus infinity", () => {
    expect(formatLevel(-6.04)).toBe("-6.0");
    expect(formatLevel(2)).toBe("+2.0");
    expect(formatLevel(0)).toBe("0.0");
    expect(formatLevel(METER_FLOOR_DB)).toBe("-∞");
    expect(formatLevel(null)).toBe("-∞");
    expect(formatLevel(-Infinity)).toBe("-∞");
  });
});
