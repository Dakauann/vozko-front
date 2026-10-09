import { describe, expect, it } from "vitest";

import { LIMIT_CEILING, limitPeaks } from "./audio-limiter";

const RATE = 48_000;

function tone(seconds: number, amplitude: number, hz = 440): Float32Array {
  const samples = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < samples.length; i++) samples[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / RATE);
  return samples;
}

function peak(samples: Float32Array, from = 0, to = samples.length): number {
  let max = 0;
  for (let i = from; i < to; i++) max = Math.max(max, Math.abs(samples[i]));
  return max;
}

describe("peak limiter", () => {
  it("leaves a mix under the ceiling untouched", () => {
    const left = tone(0.2, 0.5);
    const original = left.slice();
    limitPeaks([left], RATE);
    expect(left).toEqual(original);
  });

  it("keeps every channel under the ceiling with one shared gain", () => {
    const left = tone(0.5, 1.6);
    const right = tone(0.5, 0.4);
    limitPeaks([left, right], RATE);
    expect(peak(left)).toBeLessThanOrEqual(LIMIT_CEILING + 1e-6);
    expect(peak(right) / peak(left)).toBeCloseTo(0.25, 2);
  });

  it("recovers after a loud burst instead of staying quiet", () => {
    const loud = tone(0.1, 2);
    const quiet = tone(0.6, 0.5);
    const mix = new Float32Array(loud.length + quiet.length);
    mix.set(loud);
    mix.set(quiet, loud.length);
    limitPeaks([mix], RATE);
    expect(peak(mix, 0, loud.length)).toBeLessThanOrEqual(LIMIT_CEILING + 1e-6);
    expect(peak(mix, mix.length - RATE * 0.1)).toBeGreaterThan(0.49);
  });
});
