import { describe, expect, it } from "vitest";

import { SettledScale, ZOOM_SETTLE_MS } from "./settled-scale";

describe("settled raster scale", () => {
  it("adopts the first scale at once, so a still render is sharp on its first frame", () => {
    const settled = new SettledScale();
    expect(settled.at(0.5, 0)).toEqual({ scale: 0.5, wakeInMs: null });
  });

  it("keeps the last settled scale while the zoom is still moving, and says when to look again", () => {
    const settled = new SettledScale();
    settled.at(0.5, 0);
    expect(settled.at(0.6, 1000)).toEqual({ scale: 0.5, wakeInMs: ZOOM_SETTLE_MS });
    expect(settled.at(0.7, 1050)).toEqual({ scale: 0.5, wakeInMs: ZOOM_SETTLE_MS });
    expect(settled.at(0.7, 1100)).toEqual({ scale: 0.5, wakeInMs: ZOOM_SETTLE_MS - 50 });
  });

  it("moves to the new scale once the zoom has rested for the settle time", () => {
    const settled = new SettledScale();
    settled.at(0.5, 0);
    settled.at(0.7, 1000);
    expect(settled.at(0.7, 1000 + ZOOM_SETTLE_MS)).toEqual({ scale: 0.7, wakeInMs: null });
    expect(settled.at(0.7, 5000)).toEqual({ scale: 0.7, wakeInMs: null });
  });

  it("returning to the settled scale before the wait ends cancels the pending change", () => {
    const settled = new SettledScale();
    settled.at(0.5, 0);
    settled.at(0.8, 1000);
    expect(settled.at(0.5, 1020)).toEqual({ scale: 0.5, wakeInMs: null });
    expect(settled.at(0.5, 1000 + ZOOM_SETTLE_MS * 2)).toEqual({ scale: 0.5, wakeInMs: null });
  });

  it("panning never delays anything, because the scale does not change", () => {
    const settled = new SettledScale();
    settled.at(1, 0);
    for (let at = 10; at < 200; at += 10) expect(settled.at(1, at)).toEqual({ scale: 1, wakeInMs: null });
  });
});
