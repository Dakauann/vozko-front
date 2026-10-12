import { describe, expect, it } from "vitest";

import {
  addCurvePoint,
  applyCurvesPixels,
  curveAt,
  curvePointsIssue,
  curvePresetPoints,
  curvesIssue,
  curvesLut,
  curvesPixel,
  curveTable,
  IDENTITY_CURVE,
  isNeutralCurves,
  moveCurvePoint,
  removeCurvePoint,
  storedCurves,
  withCurve,
  type ColorCurves,
} from "./color-curves";

describe("color curves", () => {
  it("passes every tone through the identity curve and treats diagonal points as neutral", () => {
    const table = curveTable(IDENTITY_CURVE);
    expect(table[0]).toBe(0);
    expect(table[128]).toBeCloseTo(128 / 255, 12);
    expect(isNeutralCurves({ master: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }] })).toBe(true);
    expect(storedCurves({ master: [...IDENTITY_CURVE], red: [{ x: 0, y: 0.1 }, { x: 1, y: 1 }] })).toEqual({ red: [{ x: 0, y: 0.1 }, { x: 1, y: 1 }] });
    expect(storedCurves({ green: [...IDENTITY_CURVE] })).toBeUndefined();
  });

  it("goes through every point without overshooting between them", () => {
    const points = curvePresetPoints("contrast");
    for (const point of points) expect(curveAt(points, point.x)).toBeCloseTo(point.y, 12);
    const samples = Array.from({ length: 101 }, (_, i) => curveAt(points, i / 100));
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] - 1e-12);
    const plateau = [{ x: 0, y: 0 }, { x: 0.4, y: 0.6 }, { x: 0.6, y: 0.6 }, { x: 1, y: 1 }];
    expect(Math.max(...Array.from({ length: 21 }, (_, i) => curveAt(plateau, 0.4 + i * 0.01)))).toBeLessThanOrEqual(0.6 + 1e-12);
  });

  it("holds the end values outside the first and last point", () => {
    const lifted = [{ x: 0.2, y: 0.3 }, { x: 0.8, y: 0.7 }];
    expect(curveAt(lifted, 0)).toBe(0.3);
    expect(curveAt(lifted, 1)).toBe(0.7);
  });

  it("runs the master curve first and the channel curve on its result, in one shared table", () => {
    const curves: ColorCurves = { master: curvePresetPoints("brighten"), blue: [{ x: 0, y: 0 }, { x: 1, y: 0.5 }] };
    const lut = curvesLut(curves);
    const master = curveTable(curves.master!);
    expect(lut[100 * 4]).toBe(Math.round(master[100] * 255));
    expect(lut[100 * 4 + 2]).toBe(Math.round(master[100] * 0.5 * 255));
    const data = new Uint8ClampedArray([100, 100, 100, 255, 7, 8, 9, 0]);
    applyCurvesPixels(data, lut);
    expect(Array.from(data.slice(0, 3))).toEqual([lut[400], lut[401], lut[402]]);
    expect(Array.from(data.slice(4))).toEqual([7, 8, 9, 0]);
    expect(curvesPixel([100 / 255, 100 / 255, 100 / 255], lut).map((v) => Math.round(v * 255))).toEqual([lut[400], lut[401], lut[402]]);
  });

  it("refuses curves that are not a function of the input", () => {
    expect(curvePointsIssue([{ x: 0.5, y: 0.5 }])).toBe("invalid");
    expect(curvePointsIssue([{ x: 0, y: 0 }, { x: 0, y: 1 }])).toBe("invalid");
    expect(curvePointsIssue([{ x: 0, y: 0 }, { x: 1, y: 1.1 }])).toBe("out_of_range");
    expect(curvesIssue({ alpha: [] } as unknown as ColorCurves)).toBe("unknown");
    expect(curvesIssue({ red: curvePresetPoints("fade") })).toBeNull();
  });

  it("adds, moves and removes points while keeping them ordered and apart", () => {
    const added = addCurvePoint(IDENTITY_CURVE, 0.5, 0.7);
    expect(added).toEqual({ ok: true, points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.7 }, { x: 1, y: 1 }], index: 1 });
    expect(addCurvePoint(IDENTITY_CURVE, 0.001, 0.2)).toEqual({ ok: false, reason: "crowded" });
    if (!added.ok) return;
    const moved = moveCurvePoint(added.points, 1, 1.5, -1);
    expect(moved.ok && moved.points[1].x).toBeCloseTo(1 - 1 / 255, 12);
    expect(moved.ok && moved.points[1].y).toBe(0);
    expect(removeCurvePoint(added.points, 1)).toEqual({ ok: true, points: [...IDENTITY_CURVE], index: 0 });
    expect(removeCurvePoint(IDENTITY_CURVE, 0)).toEqual({ ok: false, reason: "lastPoints" });
    expect(withCurve(undefined, "red", added.points)).toEqual({ red: added.points });
    expect(withCurve({ red: added.points }, "red", IDENTITY_CURVE)).toBeUndefined();
  });
});
