import { describe, expect, it } from "vitest";

import type { Layer } from "../document";
import type { Effect } from "../layer-paint";
import { lightOutliers, shadowCasts, shadowShows } from "./shadow-light";

const canvas = { width: 1000, height: 1000 };

function card(id: string, rotation: number, extra: Partial<Layer>): Layer {
  return { id, type: "shape", shape: "rect", fill: "#ffffff", transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation, opacity: 1 }, ...extra };
}

const drop = (x: number, y: number, opacity = 0.3, color = "#000000", blur = 20): Effect => ({ id: "d", type: "drop-shadow", color, opacity, x, y, blur, spread: 0 });

describe("shadow casts", () => {
  it("turns a layer style shadow with the layer, as the renderer draws it", () => {
    const [cast] = shadowCasts(card("c", 90, { effects: [drop(0, 10)] }), canvas);
    expect(cast.dx).toBeCloseTo(-10, 6);
    expect(cast.dy).toBeCloseTo(0, 6);
    expect(cast.angle).toBeCloseTo(180, 6);
  });

  it("keeps the simple shadow in screen space, whatever the rotation", () => {
    const [cast] = shadowCasts(card("c", 90, { shadow: { color: "#00000066", blur: 12, x: 0, y: 10 } }), canvas);
    expect(cast.dx).toBeCloseTo(0, 6);
    expect(cast.dy).toBeCloseTo(10, 6);
    expect(cast.alpha).toBeCloseTo(0.4, 2);
  });

  it("mirrors the offset of a flipped shape before turning it", () => {
    const [cast] = shadowCasts(card("c", 0, { flipX: true, effects: [drop(8, 6)] }), canvas);
    expect(cast.dx).toBeCloseTo(-8, 6);
    expect(cast.dy).toBeCloseTo(6, 6);
  });

  it("multiplies the color alpha, the effect opacity and the layer opacity", () => {
    const [cast] = shadowCasts(card("c", 0, { transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 0.5 }, effects: [drop(0, 10, 0.5, "#00000080")] }), canvas);
    expect(cast.alpha).toBeCloseTo(0.125, 2);
  });

  it("ignores hidden, inner and glow effects for the light", () => {
    const glow: Effect = { id: "g", type: "outer-glow", color: "#ffffff", opacity: 1, x: 0, y: 0, blur: 30, spread: 0 };
    const inner: Effect = { id: "i", type: "inner-shadow", color: "#000000", opacity: 1, x: 0, y: 4, blur: 4, spread: 0 };
    const casts = shadowCasts(card("c", 0, { effects: [glow, inner, { ...drop(0, 10), hidden: true }] }), canvas);
    expect(casts.map((cast) => cast.kind)).toEqual(["glow"]);
  });
});

describe("light direction", () => {
  it("finds the shadow that falls against the light of the others", () => {
    const casts = [
      ...shadowCasts(card("a", 0, { effects: [drop(0, 12)] }), canvas),
      ...shadowCasts(card("b", 0, { effects: [drop(2, 14)] }), canvas),
      ...shadowCasts(card("c", 0, { effects: [drop(0, -12)] }), canvas),
    ];
    const outliers = lightOutliers(casts);
    expect(outliers.map((o) => o.cast.layerId)).toEqual(["c"]);
    expect(outliers[0].apart).toBeGreaterThan(150);
  });

  it("finds a shadow that turned with its tilted layer", () => {
    const casts = [card("a", 0, { effects: [drop(0, 12)] }), card("b", 0, { effects: [drop(0, 12)] }), card("c", 60, { effects: [drop(0, 12)] })].flatMap((layer) => shadowCasts(layer, canvas));
    expect(lightOutliers(casts).map((o) => o.cast.layerId)).toEqual(["c"]);
  });

  it("accepts small differences and needs more than two shadows to blame one", () => {
    const tilted = [card("a", -8, { effects: [drop(10, 16)] }), card("b", 12, { effects: [drop(10, 16)] }), card("c", 0, { effects: [drop(10, 16)] })].flatMap((layer) => shadowCasts(layer, canvas));
    expect(lightOutliers(tilted)).toEqual([]);
    const pair = [card("a", 0, { effects: [drop(0, 12)] }), card("b", 0, { effects: [drop(0, -12)] })].flatMap((layer) => shadowCasts(layer, canvas));
    expect(lightOutliers(pair)).toEqual([]);
  });
});

describe("shadow visibility", () => {
  it("says a dark shadow on a dark ground does not show and a soft one on a light ground does", () => {
    expect(shadowShows({ r: 0, g: 0, b: 0, a: 1 }, 0.5, { r: 11, g: 16, b: 38, a: 1 })).toBe(false);
    expect(shadowShows({ r: 90, g: 58, b: 26, a: 1 }, 0.22, { r: 244, g: 239, b: 230, a: 1 })).toBe(true);
  });
});
