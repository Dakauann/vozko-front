import { describe, expect, it } from "vitest";

import { retimeChannels, stretchChannels } from "./audio-retime";

const RATE = 8000;

function tone(hz: number, seconds: number): Float32Array {
  return Float32Array.from({ length: Math.round(RATE * seconds) }, (_, i) => Math.sin((2 * Math.PI * hz * i) / RATE));
}

function crossings(samples: Float32Array, from: number, to: number): number {
  let count = 0;
  for (let i = from + 1; i < to; i++) if (samples[i - 1] < 0 && samples[i] >= 0) count += 1;
  return count;
}

describe("retimed sound", () => {
  it("cuts the source window and plays it faster when pitch may change", () => {
    const ramp = Float32Array.from({ length: RATE }, (_, i) => i);
    const result = retimeChannels([ramp], RATE, { trimInMs: 250, spanMs: 500, speed: 2, reverse: false, preservePitch: false });
    expect(result.rate).toBe(2);
    expect(result.channels[0].length).toBe(RATE / 2);
    expect(result.channels[0][0]).toBe(RATE / 4);
  });

  it("pads a window that runs past the source with silence so a reversed start keeps its timing", () => {
    const ramp = Float32Array.from({ length: RATE }, (_, i) => i + 1);
    const result = retimeChannels([ramp], RATE, { trimInMs: 500, spanMs: 1000, speed: 1, reverse: true, preservePitch: true });
    expect(result.channels[0].length).toBe(RATE);
    expect(result.channels[0][0]).toBe(0);
    expect(result.channels[0][RATE / 2 - 1]).toBe(0);
    expect(result.channels[0][RATE / 2]).toBe(RATE);
    expect(result.channels[0][RATE - 1]).toBe(RATE / 2 + 1);
  });

  it("reverses the window", () => {
    const ramp = Float32Array.from({ length: RATE }, (_, i) => i);
    const result = retimeChannels([ramp], RATE, { trimInMs: 0, spanMs: 1000, speed: 1, reverse: true, preservePitch: true });
    expect(result.rate).toBe(1);
    expect(result.channels[0][0]).toBe(RATE - 1);
    expect(result.channels[0][RATE - 1]).toBe(0);
  });

  it("keeps the pitch while stretching the time", () => {
    const source = tone(200, 2);
    for (const speed of [0.5, 2]) {
      const [out] = stretchChannels([source], speed, RATE);
      expect(out.length).toBe(Math.round(source.length / speed));
      const middle = Math.floor(out.length / 2);
      const second = crossings(out, middle - RATE / 4, middle + RATE / 4) * 2;
      expect(Math.abs(second - 200)).toBeLessThanOrEqual(4);
    }
  });

  it("keeps stereo channels aligned", () => {
    const left = tone(300, 1);
    const [a, b] = stretchChannels([left, left.slice()], 1.5, RATE);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
