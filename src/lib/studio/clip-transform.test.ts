import { describe, expect, it } from "vitest";

import { clampClipTransform, moveBox, pointInBox, resizeBox, rotateBox, topmostAt } from "./clip-transform";

const box = { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 };

describe("clip transform", () => {
  it("keeps the center inside the canvas and the size in range", () => {
    expect(clampClipTransform({ x: -0.2, y: 1.4, w: 9, h: 0, rotation: 400, opacity: 2 })).toEqual({ x: 0, y: 1, w: 4, h: 0.001, rotation: 360, opacity: 1 });
    expect(moveBox(box, 0.1, -0.1)).toMatchObject({ x: 0.6, y: 0.4 });
  });

  it("resizes from an edge and moves the center by half", () => {
    const right = resizeBox(box, "e", 0.1, 0, { aspect: 1, keepRatio: false });
    expect(right.w).toBeCloseTo(0.5);
    expect(right.x).toBeCloseTo(0.55);
    expect(right.h).toBeCloseTo(0.2);
    const top = resizeBox(box, "n", 0, -0.1, { aspect: 1, keepRatio: false });
    expect(top.h).toBeCloseTo(0.3);
    expect(top.y).toBeCloseTo(0.45);
  });

  it("keeps the ratio from a corner when asked", () => {
    const corner = resizeBox(box, "se", 0.2, 0, { aspect: 1, keepRatio: true });
    expect(corner.w).toBeCloseTo(0.6);
    expect(corner.h).toBeCloseTo(0.3);
  });

  it("resizes in the rotated frame", () => {
    const turned = { ...box, rotation: 90 };
    const grown = resizeBox(turned, "e", 0, 0.1, { aspect: 1, keepRatio: false });
    expect(grown.w).toBeCloseTo(0.5);
    expect(grown.x).toBeCloseTo(0.5);
    expect(grown.y).toBeCloseTo(0.55);
  });

  it("accounts for a non square canvas", () => {
    const tall = resizeBox({ ...box, rotation: 90 }, "e", 0, 0.1, { aspect: 0.5, keepRatio: false });
    expect(tall.w).toBeCloseTo(0.6);
  });

  it("rotates toward the pointer with optional snapping", () => {
    expect(rotateBox(box, { x: 100, y: 100 }, { x: 200, y: 100 }).rotation).toBe(90);
    expect(rotateBox(box, { x: 100, y: 100 }, { x: 100, y: 0 }).rotation).toBe(0);
    expect(rotateBox(box, { x: 0, y: 0 }, { x: 100, y: -9 }, 15).rotation).toBe(90);
  });
});

describe("hit testing", () => {
  it("finds points inside a rotated box", () => {
    const thin = { x: 0.5, y: 0.5, w: 0.4, h: 0.1, rotation: 0, opacity: 1 };
    expect(pointInBox(thin, 0.65, 0.5, 1)).toBe(true);
    expect(pointInBox(thin, 0.5, 0.6, 1)).toBe(false);
    const turned = { ...thin, rotation: 90 };
    expect(pointInBox(turned, 0.65, 0.5, 1)).toBe(false);
    expect(pointInBox(turned, 0.5, 0.65, 1)).toBe(true);
  });

  it("picks the highest layer under the pointer", () => {
    const items = [
      { id: "bottom", zIndex: 1, transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } },
      { id: "top", zIndex: 3, transform: { x: 0.2, y: 0.2, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } },
    ];
    expect(topmostAt(items, 0.2, 0.2, 1)?.id).toBe("top");
    expect(topmostAt(items, 0.8, 0.8, 1)?.id).toBe("bottom");
    expect(topmostAt(items, 2, 2, 1)).toBeNull();
  });
});
