import { describe, expect, it } from "vitest";

import { newVfx, vfxLook, type Vfx, type VfxParam } from "./vfx";
import {
  barAt,
  barLayout,
  blurTaps,
  bulgeScale,
  cornerPinInverse,
  fractalValue,
  GLOW_WEIGHTS,
  gradientWeights,
  lookReach,
  MAX_BLUR_TAPS,
  mosaicCenter,
  pinnedSource,
  posterized,
  rampPosition,
  rippleFalloff,
  twirlTurn,
  wavePhase,
  waveShift,
  wrap,
  zoomTaps,
} from "./vfx-shapes";

const FRAME = { width: 400, height: 200 };

function lookOf(kind: Vfx["kind"], params: Partial<Record<VfxParam, number>> = {}, atMs = 0) {
  return vfxLook({ ...newVfx(kind, "fx", 9), params }, atMs);
}

describe("blur taps", () => {
  it("takes one tap every pixel and a half of the span, at least two and never past the cap", () => {
    expect(blurTaps(0)).toBe(2);
    expect(blurTaps(3)).toBe(3);
    expect(blurTaps(30)).toBe(21);
    expect(blurTaps(10_000)).toBe(MAX_BLUR_TAPS);
  });

  it("sizes the zoom blur by the farthest corner from its center", () => {
    expect(zoomTaps(lookOf("zoomBlur", { length: 0.1, x: 0, y: 0 }), FRAME)).toBe(blurTaps(0.1 * Math.hypot(400, 200)));
  });
});

describe("glow kernel", () => {
  it("is a symmetric gaussian that sums to one", () => {
    expect(GLOW_WEIGHTS.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
    expect(GLOW_WEIGHTS[0]).toBeCloseTo(GLOW_WEIGHTS.at(-1)!, 12);
    expect(Math.max(...GLOW_WEIGHTS)).toBe(GLOW_WEIGHTS[(GLOW_WEIGHTS.length - 1) / 2]);
  });
});

describe("stylize math", () => {
  it("posterizes a channel into even steps", () => {
    expect(posterized(0, 3)).toBe(0);
    expect(posterized(0.5, 3)).toBe(0.5);
    expect(posterized(1, 3)).toBe(1);
    expect(posterized(51 / 255, 5)).toBe(0.25);
  });

  it("samples the middle of each mosaic cell and stays inside the frame", () => {
    expect(mosaicCenter(5, 20, 400)).toBe(10);
    expect(mosaicCenter(25, 20, 400)).toBe(30);
    expect(mosaicCenter(399, 30, 400)).toBe(399.5);
  });

  it("wraps offsets around the frame", () => {
    expect(wrap(-0.25)).toBe(0.75);
    expect(wrap(1.5)).toBe(0.5);
  });
});

describe("distortion math", () => {
  it("moves the wave by the shift in whole cycles, so long films keep their precision", () => {
    const look = lookOf("waveWarp", { speed: 2, length: 100, phase: 90 }, 1250);
    expect(waveShift(look)).toBeCloseTo(0.5, 9);
    expect(Math.sin(wavePhase(look, 0))).toBeCloseTo(Math.sin(-Math.PI + Math.PI / 2), 9);
  });

  it("fades the ripple to nothing at its radius and keeps the center at full height", () => {
    expect(rippleFalloff(0, 100)).toBe(1);
    expect(rippleFalloff(100, 100)).toBe(0);
    expect(rippleFalloff(50, 0)).toBe(0);
  });

  it("twirls most at the center and not at all past the radius", () => {
    const look = lookOf("twirl", { angle: 180 });
    expect(twirlTurn(look, 0, 100)).toBeCloseTo(Math.PI, 12);
    expect(twirlTurn(look, 100, 100)).toBe(0);
  });

  it("magnifies the center of a bulge and pinches with a negative height", () => {
    expect(bulgeScale(lookOf("bulge", { height: 1 }), 0, 100)).toBe(0.25);
    expect(bulgeScale(lookOf("bulge", { height: -1 }), 0, 100)).toBe(1.75);
    expect(bulgeScale(lookOf("bulge", { height: 1 }), 120, 100)).toBe(1);
  });

  it("pins the corners exactly: the default square changes nothing and a moved corner lands where it was put", () => {
    const identity = cornerPinInverse(lookOf("cornerPin"))!;
    expect(pinnedSource(identity, 0.3, 0.6)).toEqual([expect.closeTo(0.3, 12), expect.closeTo(0.6, 12)]);
    const moved = cornerPinInverse(lookOf("cornerPin", { topLeftX: 0.2, topLeftY: 0.1, bottomRightX: 0.9, bottomRightY: 1.2 }))!;
    const corner = pinnedSource(moved, 0.2, 0.1)!;
    expect(corner[0]).toBeCloseTo(0, 9);
    expect(corner[1]).toBeCloseTo(0, 9);
    const far = pinnedSource(moved, 0.9, 1.2)!;
    expect(far[0]).toBeCloseTo(1, 9);
    expect(far[1]).toBeCloseTo(1, 9);
    expect(pinnedSource(moved, 0.05, 0.05)).toBeNull();
  });

  it("refuses to pin a collapsed quad", () => {
    expect(cornerPinInverse(lookOf("cornerPin", { topRightX: 0, topRightY: 0, bottomRightX: 0, bottomRightY: 0 }))).toBeNull();
  });
});

describe("generators", () => {
  it("makes the same noise for the same seed and moment, inside 0 to 1", () => {
    const look = lookOf("fractalNoise", { size: 40, complexity: 3.5 }, 800);
    const samples = [0, 17, 133, 391].map((x) => fractalValue(look, x, x * 0.7));
    expect(samples).toEqual([0, 17, 133, 391].map((x) => fractalValue(look, x, x * 0.7)));
    for (const value of samples) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(new Set(samples).size).toBeGreaterThan(1);
  });

  it("evolves the noise only when it has a speed", () => {
    const still = lookOf("fractalNoise", { speed: 0 }, 0);
    const later = lookOf("fractalNoise", { speed: 0 }, 5000);
    expect(fractalValue(still, 50, 50)).toBe(fractalValue(later, 50, 50));
    expect(fractalValue(lookOf("fractalNoise", { speed: 2 }, 5000), 50, 50)).not.toBe(fractalValue(still, 50, 50));
  });

  it("ramps from the start point to the end point, linear or round", () => {
    const linear = lookOf("gradientRamp", { x: 0, y: 0.5, toX: 1, toY: 0.5 });
    expect(rampPosition(linear, FRAME, 0, 100)).toBe(0);
    expect(rampPosition(linear, FRAME, 200, 0)).toBeCloseTo(0.5, 12);
    expect(rampPosition(linear, FRAME, 400, 100)).toBe(1);
    const round = lookOf("gradientRamp", { x: 0.5, y: 0.5, toX: 1, toY: 0.5, radial: 1 });
    expect(rampPosition(round, FRAME, 200, 0)).toBeCloseTo(0.5, 12);
  });

  it("weights the four colors by closeness, summing to one", () => {
    const look = lookOf("fourColorGradient");
    const weights = gradientWeights(look, FRAME, 0.15 * 400, 0.15 * 200);
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
    expect(weights[0]).toBeGreaterThan(0.99);
  });
});

describe("padding past the box", () => {
  it("reaches as far as each effect can move or spread pixels", () => {
    expect(lookReach(lookOf("glow", { size: 50 }), FRAME)).toBe(50);
    expect(lookReach(lookOf("directionalBlur", { length: 40 }), FRAME)).toBe(21);
    expect(lookReach(lookOf("waveWarp", { height: 30 }), FRAME)).toBe(31);
    expect(lookReach(lookOf("cornerPin", { topLeftX: -0.25 }), FRAME)).toBe(101);
    expect(lookReach(lookOf("posterize"), FRAME)).toBe(0);
    expect(lookReach(lookOf("fractalNoise"), FRAME)).toBe(0);
  });
});

describe("sound bars", () => {
  it("lays bars out across the width and draws them up from the baseline, or centered for a waveform", () => {
    const spectrum = lookOf("audioSpectrum", { x: 0.5, y: 0.5, width: 1, size: 0.5, gap: 0, roundness: 0 });
    const layout = barLayout(spectrum, FRAME, 4);
    expect(layout.slot).toBe(100);
    expect(barAt(layout, [1, 0, 0, 0], 50, 60).cover).toBe(1);
    expect(barAt(layout, [1, 0, 0, 0], 50, 140).cover).toBe(0);
    expect(barAt(layout, [0, 0, 0, 0], 150, 60).cover).toBe(0);
    const wave = barLayout(lookOf("audioWaveform", { x: 0.5, y: 0.5, width: 1, size: 0.5, gap: 0, roundness: 0 }), FRAME, 4);
    expect(barAt(wave, [1, 1, 1, 1], 50, 140).cover).toBe(1);
  });
});
