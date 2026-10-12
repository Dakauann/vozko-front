import { describe, expect, it } from "vitest";

import { boxPointAt, framePointOf } from "./clip-placement";
import { fullFrame, newMediaClip, type Transform } from "./document";
import { newEffectClip, newVfx } from "./vfx";
import { placesPoint, pointPatch, vfxFrame, vfxPoints } from "./vfx-points";

const WIDE = 16 / 9;

describe("light sources on the preview", () => {
  it("places a point for effects that have one and reads it at the moment", () => {
    const flare = { ...newVfx("lensFlare", "f", 1), params: { x: 0.7, y: 0.3 } };
    const leak = { ...newVfx("lightLeak", "l", 2), keyframes: { x: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 1000, value: 1, easing: "linear" as const }] } };
    const grain = newVfx("grain", "g", 3);
    const hidden = { ...newVfx("lensFlare", "h", 4), hidden: true };
    expect(vfxPoints([flare, leak, grain, hidden], 500)).toEqual([
      { id: "f", kind: "lensFlare", x: 0.7, y: 0.3 },
      { id: "l", kind: "lightLeak", x: 0.5, y: 0.2 },
    ]);
    expect(placesPoint("lensFlare")).toBe(true);
    expect(placesPoint("vignette")).toBe(false);
  });

  it("measures points in the clip box, or the whole frame for an effect clip", () => {
    const placed: Transform = { x: 0.4, y: 0.6, w: 0.5, h: 0.5, rotation: 30, opacity: 1 };
    expect(vfxFrame(newMediaClip("video", "m", 0, 1000), placed)).toBe(placed);
    expect(vfxFrame(newEffectClip([], 0, 1000), placed)).toEqual(fullFrame());
  });

  it("turns a dragged frame point into box fractions and back, through the clip rotation", () => {
    const placed: Transform = { x: 0.4, y: 0.6, w: 0.5, h: 0.3, rotation: 30, opacity: 1 };
    const fraction = boxPointAt(placed, { x: 0.55, y: 0.5 }, WIDE);
    const back = framePointOf(placed, fraction, WIDE);
    expect(back.x).toBeCloseTo(0.55, 9);
    expect(back.y).toBeCloseTo(0.5, 9);
    expect(framePointOf(placed, { x: 0.5, y: 0.5 }, WIDE)).toEqual({ x: 0.4, y: 0.6 });
  });

  it("keeps a dragged point inside the ranges the effect accepts", () => {
    expect(pointPatch("lensFlare", { x: 0.31234567, y: 2.4 })).toEqual({ params: { x: 0.3123, y: 1.5 } });
    expect(pointPatch("lightLeak", { x: -3, y: 0.5 })).toEqual({ params: { x: -0.5, y: 0.5 } });
  });
});
