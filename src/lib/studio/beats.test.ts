import { describe, expect, it } from "vitest";

import { detectBeats } from "./beats";
import { LOUDNESS_STEP_MS, type LoudnessProfile } from "./loudness";

function clicks(periodMs: number, firstMs: number, durationMs: number, stereo = false): LoudnessProfile {
  const steps = Math.ceil(durationMs / LOUDNESS_STEP_MS);
  const energies = new Float32Array(steps).fill(1e-5);
  for (let at = firstMs; at < durationMs; at += periodMs) {
    const k = Math.floor(at / LOUDNESS_STEP_MS);
    for (let d = 0; d < 8 && k + d < steps; d++) energies[k + d] += Math.exp(-d / 2);
  }
  return { durationMs, channels: stereo ? [energies, energies.map((e) => e * 0.5)] : [energies] };
}

function nearest(beats: readonly number[], at: number): number {
  return Math.min(...beats.map((beat) => Math.abs(beat - at)));
}

describe("beat detection", () => {
  it("finds every click of a steady 120 BPM pulse", () => {
    const analysis = detectBeats(clicks(500, 230, 20_000));
    expect(analysis).not.toBeNull();
    expect(analysis!.bpm).toBeCloseTo(120, 0);
    const expected = Array.from({ length: 39 }, (_, i) => 230 + i * 500);
    for (const at of expected.slice(1, -1)) expect(nearest(analysis!.beatsMs, at)).toBeLessThanOrEqual(LOUDNESS_STEP_MS);
    expect(analysis!.beatsMs.length).toBeGreaterThanOrEqual(37);
    expect(analysis!.beatsMs.length).toBeLessThanOrEqual(40);
  });

  it("follows a tempo between grid steps", () => {
    const period = 60_000 / 128;
    const analysis = detectBeats(clicks(period, 0, 30_000, true))!;
    expect(analysis.bpm).toBeCloseTo(128, 0);
    for (let i = 2; i < 60; i++) expect(nearest(analysis.beatsMs, i * period)).toBeLessThanOrEqual(2 * LOUDNESS_STEP_MS);
  });

  it("gives the same answer every time", () => {
    const profile = clicks(430, 100, 15_000);
    expect(detectBeats(profile)).toEqual(detectBeats(profile));
  });

  it("finds nothing in silence or in a clip too short for a pulse", () => {
    expect(detectBeats({ durationMs: 10_000, channels: [new Float32Array(1000)] })).toBeNull();
    expect(detectBeats(clicks(500, 0, 900))).toBeNull();
  });
});
