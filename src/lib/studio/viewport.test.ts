import { describe, expect, it } from "vitest";

import { clampZoom, fitViewport, followViewport, MAX_ZOOM, MIN_ZOOM, rulerTicks, screenToWorld, stepZoom, wheelZoom, zoomAt } from "./viewport";

describe("fitViewport", () => {
  it("scales the canvas into the container with padding and centers it", () => {
    const v = fitViewport({ width: 1000, height: 600 }, { width: 1080, height: 1080 }, 50);
    expect(v.scale).toBeCloseTo(500 / 1080);
    expect(v.x).toBeCloseTo((1000 - 1080 * v.scale) / 2);
    expect(v.y).toBeCloseTo(50);
  });

  it("never goes below the minimum zoom for tiny containers", () => {
    expect(fitViewport({ width: 10, height: 10 }, { width: 4000, height: 4000 }).scale).toBe(MIN_ZOOM);
  });
});

describe("zoomAt", () => {
  it("keeps the world point under the anchor fixed", () => {
    const v = { scale: 0.5, x: 100, y: 40 };
    const anchor = { x: 300, y: 200 };
    const before = screenToWorld(v, anchor);
    const next = zoomAt(v, 2, anchor);
    expect(next.scale).toBe(2);
    const after = screenToWorld(next, anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("clamps the scale", () => {
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 99, { x: 0, y: 0 }).scale).toBe(MAX_ZOOM);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
  });
});

describe("stepZoom and wheelZoom", () => {
  it("moves to the next preset in each direction", () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(0.8, 1)).toBe(1);
    expect(stepZoom(0.33, -1)).toBe(0.25);
    expect(stepZoom(4, 1)).toBe(4);
  });

  it("zooms in when scrolling up and out when scrolling down", () => {
    expect(wheelZoom(1, -100)).toBeGreaterThan(1);
    expect(wheelZoom(1, 100)).toBeLessThan(1);
  });
});

describe("rulerTicks", () => {
  it("picks a readable step and labels ticks in canvas pixels", () => {
    const ticks = rulerTicks(0.5, 20, 400);
    expect(ticks[0]).toEqual({ screen: 20, value: 0 });
    expect(ticks[1]).toEqual({ screen: 70, value: 100 });
    expect(ticks[ticks.length - 1].screen).toBeLessThanOrEqual(400);
  });

  it("starts at the first tick visible when the canvas is scrolled away", () => {
    const ticks = rulerTicks(1, -230, 300);
    expect(ticks[0].value).toBe(250);
    expect(ticks[0].screen).toBe(20);
  });
});

describe("followViewport", () => {
  const canvas = { width: 1080, height: 1080 };
  const manual = { scale: 2, x: -40, y: 10 };

  it("refits whenever the area or the canvas changes while in fit mode", () => {
    expect(followViewport(true, manual, { width: 800, height: 600 }, canvas)).toEqual(fitViewport({ width: 800, height: 600 }, canvas));
    expect(followViewport(true, manual, { width: 800, height: 600 }, { width: 1080, height: 1920 })).toEqual(fitViewport({ width: 800, height: 600 }, { width: 1080, height: 1920 }));
  });

  it("keeps a manual zoom and waits for a measured area", () => {
    expect(followViewport(false, manual, { width: 800, height: 600 }, canvas)).toBe(manual);
    expect(followViewport(true, manual, null, canvas)).toBe(manual);
  });
});
