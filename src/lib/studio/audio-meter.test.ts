import { describe, expect, it } from "vitest";

import { LIMIT_CEILING } from "./audio-limiter";
import { BALANCE_LIMIT_DB, ceilingHits, integratedLoudness, kWeighted, kWeightingStages, levelsBetween, SILENT_DB } from "./audio-meter";

const RATE = 48_000;

function sine(amplitude: number, seconds: number, hz = 1000, rate = RATE): Float32Array {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
}

function joined(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const fromDb = (db: number) => 10 ** (db / 20);

describe("kWeightingStages", () => {
  it("matches the published coefficients at 48 kHz", () => {
    const [shelf, highPass] = kWeightingStages(RATE);
    const expected = [
      { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] },
      { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] },
    ];
    [shelf, highPass].forEach((stage, i) => {
      stage.b.forEach((value, j) => expect(value).toBeCloseTo(expected[i].b[j], 6));
      stage.a.forEach((value, j) => expect(value).toBeCloseTo(expected[i].a[j], 6));
    });
  });
});

describe("integratedLoudness", () => {
  it("reads a stereo 1 kHz tone at -23 dBFS as -23 LUFS", () => {
    const tone = sine(fromDb(-23), 5);
    const weighted = [kWeighted(tone, RATE), kWeighted(tone, RATE)];
    expect(integratedLoudness(weighted, RATE)!).toBeCloseTo(-23, 1);
  });

  it("ignores silence below the absolute gate", () => {
    const tone = joined(sine(fromDb(-23), 5), new Float32Array(5 * RATE));
    const weighted = [kWeighted(tone, RATE), kWeighted(tone, RATE)];
    expect(Math.abs(integratedLoudness(weighted, RATE)! + 23)).toBeLessThan(0.25);
  });

  it("has no loudness for pure silence", () => {
    const quiet = new Float32Array(RATE);
    expect(integratedLoudness([quiet, quiet], RATE)).toBeNull();
  });
});

describe("levelsBetween", () => {
  it("measures peak, RMS and loudness of a window", () => {
    const tone = sine(0.5, 2);
    const levels = levelsBetween([tone, tone], [kWeighted(tone, RATE), kWeighted(tone, RATE)], RATE, 500, 1500);
    expect(levels.peakDb).toBeCloseTo(-6.02, 1);
    expect(levels.rmsDb).toBeCloseTo(-9.03, 1);
    expect(levels.lufs).toBeCloseTo(-6.02, 0);
  });

  it("reads which side a stereo window leans to, right minus left, and nothing for mono or centred sound", () => {
    const tone = sine(0.5, 1);
    const half = tone.map((v) => v / 2);
    const right = levelsBetween([half, tone], [kWeighted(half, RATE), kWeighted(tone, RATE)], RATE, 0, 1000);
    expect(right.balanceDb).toBeCloseTo(6.02, 1);
    const left = levelsBetween([tone, new Float32Array(RATE)], [kWeighted(tone, RATE), new Float32Array(RATE)], RATE, 0, 1000);
    expect(left.balanceDb).toBe(-BALANCE_LIMIT_DB);
    expect(levelsBetween([tone, tone], [tone, tone], RATE, 0, 1000).balanceDb).toBeCloseTo(0, 6);
    expect(levelsBetween([tone], [tone], RATE, 0, 1000).balanceDb).toBeUndefined();
    const quiet = new Float32Array(RATE);
    expect(levelsBetween([quiet, quiet], [quiet, quiet], RATE, 0, 1000).balanceDb).toBeUndefined();
  });

  it("floors silence instead of reporting minus infinity", () => {
    const quiet = new Float32Array(RATE);
    const levels = levelsBetween([quiet], [quiet], RATE, 0, 1000);
    expect([levels.peakDb, levels.rmsDb, levels.lufs]).toEqual([SILENT_DB, SILENT_DB, SILENT_DB]);
  });
});

describe("ceilingHits", () => {
  it("counts the moments any channel goes over the limiter ceiling", () => {
    const left = new Float32Array(100);
    const right = new Float32Array(100);
    left[10] = LIMIT_CEILING + 0.01;
    right[10] = 1;
    right[50] = -1;
    expect(ceilingHits([left, right], 0, 100)).toBe(2);
    expect(ceilingHits([left, right], 20, 100)).toBe(1);
  });
});
