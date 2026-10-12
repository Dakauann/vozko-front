import { describe, expect, it } from "vitest";

import { frameToUnit, maskBox, pathFrameOf, unitToFrame } from "./path-frame";

describe("path points on the frame", () => {
  const placed = { x: 0.4, y: 0.6, w: 0.5, h: 0.25, rotation: 30, opacity: 1 };
  const canvas = { width: 1080, height: 1920 };

  it("puts the corners of a full layer box on the corners of the clip", () => {
    const frame = pathFrameOf({ ...placed, rotation: 0 }, canvas, { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 });
    const corner = unitToFrame(frame, { x: 0, y: 0 });
    const far = unitToFrame(frame, { x: 1, y: 1 });
    expect([corner.x, corner.y, far.x, far.y].map((value) => Math.round(value * 1e9) / 1e9)).toEqual([0.15, 0.475, 0.65, 0.725]);
  });

  it("goes back to the same path point through a turned clip and a turned mask", () => {
    const frame = pathFrameOf(placed, canvas, maskBox({ x: 0.3, y: 0.7, w: 0.4, h: 0.6, rotation: -50 }));
    for (const unit of [{ x: 0, y: 0 }, { x: 0.25, y: 0.9 }, { x: 1, y: 0.5 }]) {
      const back = frameToUnit(frame, unitToFrame(frame, unit));
      expect(back.x).toBeCloseTo(unit.x, 9);
      expect(back.y).toBeCloseTo(unit.y, 9);
    }
  });
});
