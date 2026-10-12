import { describe, expect, it } from "vitest";

import { outsideView, VIEW_MARGIN_PX } from "./visibility";

const view = { width: 1000, height: 800 };
const camera = { scale: 0.5, x: 100, y: 50 };
const box = (x: number, y: number, width = 100, height = 100, rotation = 0) => ({ x, y, width, height, rotation });

describe("outside the view", () => {
  it("keeps a layer whose box shows on screen", () => {
    expect(outsideView(box(500, 500), { x: 0, y: 0 }, camera, view)).toBe(false);
  });

  it("finds a layer far to the right or below the screen", () => {
    expect(outsideView(box(5000, 500), { x: 0, y: 0 }, camera, view)).toBe(true);
    expect(outsideView(box(500, 5000), { x: 0, y: 0 }, camera, view)).toBe(true);
  });

  it("counts the artboard origin, so a layer on a board off to the side is outside", () => {
    expect(outsideView(box(500, 500), { x: 4000, y: 0 }, camera, view)).toBe(true);
  });

  it("keeps a layer just past the edge inside the margin, so it is sharp before it scrolls in", () => {
    const right = (view.width + VIEW_MARGIN_PX / 2 - camera.x) / camera.scale + 50;
    expect(outsideView(box(right, 500), { x: 0, y: 0 }, camera, view)).toBe(false);
  });

  it("measures a layer by the reach of its farthest corner, so any turn of it is covered", () => {
    const left = (-camera.x - VIEW_MARGIN_PX) / camera.scale - 60;
    expect(outsideView(box(left, 500, 100, 10, 0), { x: 0, y: 0 }, camera, view)).toBe(true);
    expect(outsideView(box(left, 500, 300, 10, 45), { x: 0, y: 0 }, camera, view)).toBe(false);
  });
});
