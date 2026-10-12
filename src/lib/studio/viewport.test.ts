import { describe, expect, it } from "vitest";

import { clampZoom, FIT_PADDING_PX, fitBounds, fitViewport, followViewport, frameRect, localViewport, MAX_ZOOM, MIN_ZOOM, placeFrame, ZOOM_MENU_PRESETS, rulerTicks, screenToWorld, stepZoom, viewArea, visibleFrame, visibleShare, wheelViewport, wheelZoom, worldToScreen, zoomAt, zoomAtCenter } from "./viewport";

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

describe("fit uses the room it has", () => {
  it("leaves only a small margin around the canvas, on the tighter side", () => {
    expect(FIT_PADDING_PX).toBeLessThanOrEqual(24);
    const v = fitViewport({ width: 1000, height: 600 }, { width: 1080, height: 1920 });
    expect(v.y).toBeCloseTo(FIT_PADDING_PX);
    expect(1920 * v.scale).toBeCloseTo(600 - FIT_PADDING_PX * 2);
  });
});

describe("wheel and frame geometry", () => {
  const v = { scale: 0.5, x: 100, y: 40 };
  const wheel = { deltaX: 0, deltaY: 0, ctrlKey: false, metaKey: false, shiftKey: false };

  it("zooms around the pointer with Ctrl, Cmd or a pinch and scrolls otherwise", () => {
    const anchor = { x: 300, y: 200 };
    const zoomed = wheelViewport(v, { ...wheel, deltaY: -100, ctrlKey: true }, anchor);
    expect(zoomed.scale).toBeGreaterThan(v.scale);
    expect(screenToWorld(zoomed, anchor).x).toBeCloseTo(screenToWorld(v, anchor).x);
    expect(wheelViewport(v, { ...wheel, deltaY: -100, metaKey: true }, anchor).scale).toBe(zoomed.scale);
    expect(wheelViewport(v, { ...wheel, deltaX: 10, deltaY: 30 }, anchor)).toEqual({ scale: 0.5, x: 90, y: 10 });
    expect(wheelViewport(v, { ...wheel, deltaY: 30, shiftKey: true }, anchor)).toEqual({ scale: 0.5, x: 70, y: 40 });
  });

  it("zooms around the middle of the container", () => {
    const next = zoomAtCenter(v, 1, { width: 800, height: 600 });
    expect(screenToWorld(next, { x: 400, y: 300 }).x).toBeCloseTo(screenToWorld(v, { x: 400, y: 300 }).x);
    expect(next.scale).toBe(1);
  });

  it("rounds the placed frame to whole pixels and clips it to the container", () => {
    expect(placeFrame({ scale: 0.41666, x: 24.4, y: 23.6 }, { width: 1920, height: 1080 }, { width: 848, height: 498 })).toEqual({
      frame: { left: 24, top: 24, width: 800, height: 450 },
      visible: { left: 0, top: 0, width: 800, height: 450 },
    });
  });

  it("offers fit plus the presets from half size up in the zoom menu", () => {
    expect(ZOOM_MENU_PRESETS).toEqual(expect.arrayContaining([0.5, 1, 2]));
    expect(Math.min(...ZOOM_MENU_PRESETS)).toBe(0.5);
  });

  it("places the canvas frame on screen and keeps only the part inside the container", () => {
    expect(frameRect(v, { width: 1080, height: 1920 })).toEqual({ left: 100, top: 40, width: 540, height: 960 });
    expect(visibleFrame({ left: -100, top: 40, width: 540, height: 960 }, { width: 400, height: 500 })).toEqual({ left: 100, top: 0, width: 400, height: 460 });
    expect(visibleFrame({ left: 500, top: 40, width: 540, height: 960 }, { width: 400, height: 500 })).toEqual({ left: 0, top: 0, width: 0, height: 0 });
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
  const canvas = { left: 0, top: 0, right: 1080, bottom: 1080 };
  const manual = { scale: 2, x: -40, y: 10 };

  it("refits whenever the area or the artboards change while in fit mode", () => {
    expect(followViewport(true, manual, { width: 800, height: 600 }, canvas)).toEqual(fitViewport({ width: 800, height: 600 }, { width: 1080, height: 1080 }));
    expect(followViewport(true, manual, { width: 800, height: 600 }, { left: 0, top: 0, right: 2260, bottom: 1920 })).toEqual(fitBounds({ width: 800, height: 600 }, { left: 0, top: 0, right: 2260, bottom: 1920 }));
  });

  it("keeps a manual zoom and waits for a measured area", () => {
    expect(followViewport(false, manual, { width: 800, height: 600 }, canvas)).toBe(manual);
    expect(followViewport(true, manual, null, canvas)).toBe(manual);
  });
});

describe("visibility", () => {
  it("measures how much of an area the person can see", () => {
    const view = viewArea({ scale: 0.5, x: 0, y: 0 }, { width: 500, height: 500 });
    expect(view).toEqual({ left: 0, top: 0, right: 1000, bottom: 1000 });
    expect(visibleShare({ left: 0, top: 0, right: 500, bottom: 500 }, view)).toBe(1);
    expect(visibleShare({ left: 750, top: 0, right: 1250, bottom: 500 }, view)).toBe(0.5);
    expect(visibleShare({ left: 2000, top: 0, right: 2500, bottom: 500 }, view)).toBe(0);
  });
});

describe("viewports across artboards", () => {
  it("fits any area of the board, wherever it starts", () => {
    const v = fitBounds({ width: 1000, height: 600 }, { left: 1000, top: -200, right: 3000, bottom: 800 }, 0);
    expect(v.scale).toBeCloseTo(0.5);
    expect(worldToScreen(v, { x: 1000, y: -200 })).toEqual({ x: 0, y: 50 });
    expect(worldToScreen(v, { x: 3000, y: 800 })).toEqual({ x: 1000, y: 550 });
  });

  it("gives an artboard its own viewport, so its contents map to the screen from its corner", () => {
    const v = { scale: 0.5, x: 10, y: 20 };
    const local = localViewport(v, { x: 200, y: 100 });
    expect(worldToScreen(local, { x: 0, y: 0 })).toEqual(worldToScreen(v, { x: 200, y: 100 }));
    expect(screenToWorld(local, worldToScreen(v, { x: 300, y: 150 }))).toEqual({ x: 100, y: 50 });
  });
});
