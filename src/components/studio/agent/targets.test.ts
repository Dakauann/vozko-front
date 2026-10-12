import { afterEach, describe, expect, it } from "vitest";

import type { ImageDocument } from "@/lib/studio/document";

import { imageRegionTarget, momentTicks } from "./targets";
import { placed } from "./test-placement";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("where a look shows on screen", () => {
  it("marks each sampled moment on the timeline lanes and skips moments scrolled out of view", () => {
    const timeline = placed("data-studio-timeline", { left: 0, top: 400, width: 600, height: 200 });
    placed("data-studio-lanes", { left: 100, top: 440, width: 2000, height: 160 }, timeline);
    const ticks = momentTicks([0, 2000, 9000], 100);
    expect(ticks).toHaveLength(2);
    expect(ticks[0]).toMatchObject({ top: 440, height: 160 });
    expect(ticks[0].left + ticks[0].width / 2).toBe(100);
    expect(ticks[1].left + ticks[1].width / 2).toBe(300);
  });

  it("has nothing to mark when the timeline is not on screen", () => {
    expect(momentTicks([1000], 100)).toEqual([]);
  });

  it("outlines the zoomed part of an artboard where it sits on the canvas", () => {
    placed("data-studio-canvas", { left: 50, top: 60, width: 800, height: 600 });
    const doc = { artboards: [{ id: "ab-1", x: 100, y: 0, canvas: { width: 1000, height: 500 }, layers: [] }] } as unknown as ImageDocument;
    const target = imageRegionTarget(doc, "ab-1", { left: 0.5, top: 0.2, width: 0.25, height: 0.5 }, { scale: 0.5, x: 10, y: 20 });
    expect(target?.outline).toEqual({ left: 50 + 10 + (100 + 500) * 0.5, top: 60 + 20 + 100 * 0.5, width: 125, height: 125 });
    expect(imageRegionTarget(doc, "missing", { left: 0, top: 0, width: 1, height: 1 }, { scale: 1, x: 0, y: 0 })).toBeNull();
  });
});
