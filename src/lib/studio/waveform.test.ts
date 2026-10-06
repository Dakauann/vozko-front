import { describe, expect, it } from "vitest";

import { computePeaks, peakGain, slicePeaks } from "./waveform";

function rounded(values: number[]): number[] {
  return values.map((value) => Math.round(value * 100) / 100);
}

describe("waveform peaks", () => {
  it("keeps the loudest absolute sample per bucket across channels", () => {
    const left = new Float32Array([0.1, -0.5, 0.2, 0.0, 0.3, -0.1, 0.9, 0.2]);
    const right = new Float32Array([0.6, 0.1, 0.0, 0.0, 0.0, -0.7, 0.0, 0.0]);
    const peaks = computePeaks([left, right], 8, 4);
    expect(peaks.perSecond).toBe(4);
    expect(rounded(Array.from(peaks.values))).toEqual([0.6, 0.2, 0.7, 0.9]);
  });

  it("returns nothing for silence without samples", () => {
    expect(computePeaks([], 44100).values.length).toBe(0);
  });

  it("slices by trim and duration into bars", () => {
    const peaks = { perSecond: 10, values: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) };
    expect(rounded(slicePeaks(peaks, 200, 400, 2))).toEqual([0.4, 0.6]);
    expect(rounded(slicePeaks(peaks, 0, 1000, 5))).toEqual([0.2, 0.4, 0.6, 0.8, 1]);
  });

  it("pads past the end of the source with silence", () => {
    const peaks = { perSecond: 10, values: new Float32Array([0.5, 0.5]) };
    expect(slicePeaks(peaks, 0, 400, 4)).toEqual([0.5, 0.5, 0, 0]);
    expect(slicePeaks(peaks, 0, 400, 0)).toEqual([]);
  });
});

describe("peak gain", () => {
  it("normalizes quiet sources and ignores silence", () => {
    expect(peakGain({ perSecond: 10, values: new Float32Array([0.1, 0.25]) })).toBe(4);
    expect(peakGain({ perSecond: 10, values: new Float32Array([0, 0]) })).toBe(20);
  });
});
