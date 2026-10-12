import { describe, expect, it } from "vitest";

import { applyLayerEffects, distanceToSeeds, gaussianBlur, shiftedMatte, spreadMatte } from "./effect-pixels";
import { newEffect, type Effect, type EffectPlan, type StrokePaint } from "./layer-paint";

const SIDE = 24;

function square(color: [number, number, number] = [255, 255, 255], from = 9, to = 15): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SIDE * SIDE * 4);
  for (let y = from; y < to; y++) {
    for (let x = from; x < to; x++) data.set([...color, 255], (y * SIDE + x) * 4);
  }
  return data;
}

function at(data: Uint8ClampedArray, x: number, y: number): number[] {
  return Array.from(data.slice((y * SIDE + x) * 4, (y * SIDE + x) * 4 + 4));
}

function run(data: Uint8ClampedArray, plan: Partial<EffectPlan>, scale = 1): Uint8ClampedArray {
  applyLayerEffects(data, SIDE, SIDE, { effects: [], outlines: [], ...plan }, scale);
  return data;
}

const fx = (type: Effect["type"], patch: Partial<Effect> = {}): Effect => ({ ...newEffect(type, "fx"), opacity: 1, blur: 0, x: 0, y: 0, color: "#000000", ...patch });

describe("matte operations", () => {
  it("measures the euclidean distance to the nearest seed", () => {
    const seeds = new Float32Array(25);
    seeds[12] = 1;
    const distance = distanceToSeeds(seeds, 5, 5, true);
    expect(distance[12]).toBe(0);
    expect(distance[13]).toBe(1);
    expect(distance[18]).toBeCloseTo(Math.SQRT2, 6);
    expect(distance[0]).toBeCloseTo(Math.sqrt(8), 6);
  });

  it("grows and shrinks a matte by a radius", () => {
    const matte = new Float32Array(SIDE * SIDE);
    for (let i = 10; i < 14; i++) for (let j = 10; j < 14; j++) matte[i * SIDE + j] = 1;
    const grown = spreadMatte(matte, SIDE, SIDE, 2);
    expect(grown[12 * SIDE + 15]).toBe(1);
    expect(grown[12 * SIDE + 17]).toBe(0);
    const shrunk = spreadMatte(matte, SIDE, SIDE, -1);
    expect(shrunk[12 * SIDE + 10]).toBeLessThan(1);
    expect(shrunk[12 * SIDE + 12]).toBe(1);
    expect(spreadMatte(matte, SIDE, SIDE, 0)).toBe(matte);
  });

  it("blurs with a gaussian that keeps the total and leaves sharp mattes alone at zero", () => {
    const point = new Float32Array(SIDE * SIDE);
    point[12 * SIDE + 12] = 1;
    const soft = gaussianBlur(point, SIDE, SIDE, 2, 0);
    expect(soft.reduce((sum, v) => sum + v, 0)).toBeCloseTo(1, 3);
    expect(soft[12 * SIDE + 12]).toBeLessThan(0.2);
    expect(soft[12 * SIDE + 13]).toBeGreaterThan(soft[12 * SIDE + 16]);
    expect(gaussianBlur(point, SIDE, SIDE, 0, 0)).toBe(point);
  });

  it("moves a matte by whole pixels and fills what comes in", () => {
    const matte = new Float32Array(9);
    matte[4] = 1;
    expect(Array.from(shiftedMatte(matte, 3, 3, 1, 0, 0))).toEqual([0, 0, 0, 0, 0, 1, 0, 0, 0]);
    expect(Array.from(shiftedMatte(matte, 3, 3, -1, -1, 1))).toEqual([1, 0, 1, 0, 0, 1, 1, 1, 1]);
  });
});

describe("layer effects on pixels", () => {
  it("does nothing without effects or outlines", () => {
    const data = square();
    const before = Array.from(data);
    expect(Array.from(run(data, {}))).toEqual(before);
  });

  it("casts a hard drop shadow beside the layer and keeps the layer on top", () => {
    const data = run(square(), { effects: [fx("drop-shadow", { x: 3 })] });
    expect(at(data, 16, 12)).toEqual([0, 0, 0, 255]);
    expect(at(data, 12, 12)).toEqual([255, 255, 255, 255]);
    expect(at(data, 20, 12)[3]).toBe(0);
  });

  it("scales offsets and spread from artboard pixels to raster pixels", () => {
    const data = run(square(), { effects: [fx("drop-shadow", { spread: 1 })] }, 2);
    expect(at(data, 16, 12)[3]).toBe(255);
    expect(at(data, 18, 12)[3]).toBe(0);
  });

  it("hides a shadow behind see-through content unless it shows behind", () => {
    const glass = () => {
      const data = square();
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) data[i] = 128;
      return data;
    };
    const hidden = run(glass(), { effects: [fx("drop-shadow", { spread: 2 })] });
    const behind = run(glass(), { effects: [fx("drop-shadow", { spread: 2, showBehind: true })] });
    expect(at(hidden, 12, 12)).toEqual([255, 255, 255, 128]);
    expect(at(behind, 12, 12)[3]).toBeGreaterThan(128);
    expect(at(behind, 12, 12)[0]).toBeLessThan(255);
  });

  it("glows softly around the layer in the glow color", () => {
    const data = run(square([0, 0, 0]), { effects: [fx("outer-glow", { color: "#ff0000", blur: 6 })] });
    const near = at(data, 15, 12);
    const far = at(data, 21, 12);
    expect(near[0]).toBe(255);
    expect(near[3]).toBeGreaterThan(far[3]);
    expect(far[3]).toBeGreaterThan(0);
    expect(at(data, 1, 1)[3]).toBeLessThan(near[3]);
  });

  it("darkens the inner edge facing the light with an inner shadow and keeps the outline", () => {
    const data = run(square(), { effects: [fx("inner-shadow", { x: 2, y: 2 })] });
    expect(at(data, 9, 12)).toEqual([0, 0, 0, 255]);
    expect(at(data, 14, 14)).toEqual([255, 255, 255, 255]);
    expect(at(data, 7, 12)[3]).toBe(0);
  });

  it("lights an inner glow from the edges or from the center", () => {
    const edge = run(square([0, 0, 0], 4, 20), { effects: [fx("inner-glow", { color: "#ffffff", blur: 8, blendMode: "screen", source: "edge" })] });
    expect(at(edge, 4, 12)[0]).toBeGreaterThan(at(edge, 12, 12)[0]);
    const center = run(square([0, 0, 0], 4, 20), { effects: [fx("inner-glow", { color: "#ffffff", blur: 8, blendMode: "screen", source: "center" })] });
    expect(at(center, 12, 12)[0]).toBeGreaterThan(at(center, 4, 12)[0]);
  });

  it("blends an inner effect with the content under it", () => {
    const data = run(square(), { effects: [fx("inner-glow", { color: "#ff0000", blur: 0, spread: 100, blendMode: "multiply", source: "center" })] });
    expect(at(data, 12, 12)).toEqual([255, 0, 0, 255]);
  });

  it("puts the first effect of a kind in front of the next", () => {
    const data = run(square(), { effects: [fx("drop-shadow", { x: 3, color: "#ff0000" }), fx("drop-shadow", { x: 3, color: "#0000ff" })] });
    expect(at(data, 16, 12)).toEqual([255, 0, 0, 255]);
  });

  it("traces an outline of a given width around the painted pixels", () => {
    const outline: StrokePaint = { type: "solid", color: "#00ff00", opacity: 1, width: 2, align: "outside" };
    const data = run(square(), { outlines: [outline] });
    expect(at(data, 16, 12)).toEqual([0, 255, 0, 255]);
    expect(at(data, 18, 12)[3]).toBe(0);
    expect(at(data, 12, 12)).toEqual([255, 255, 255, 255]);
    const wider = run(square(), { outlines: [outline] }, 2);
    expect(at(wider, 18, 12)).toEqual([0, 255, 0, 255]);
  });

  it("casts shadows from the outline too, since effects see the whole painted layer", () => {
    const outline: StrokePaint = { type: "solid", color: "#00ff00", opacity: 1, width: 2, align: "outside" };
    const data = run(square(), { outlines: [outline], effects: [fx("drop-shadow", { x: 4 })] });
    expect(at(data, 19, 12)).toEqual([0, 0, 0, 255]);
  });
});
