import { describe, expect, it } from "vitest";

import { previewBlurScale, PREVIEW_QUALITIES, previewScale } from "./preview-quality";

describe("preview quality", () => {
  it("draws the preview at full, half or a quarter of its pixels", () => {
    expect(previewScale("full", true)).toBe(1);
    expect(previewScale("half", false)).toBe(0.5);
    expect(previewScale("quarter", true)).toBe(0.25);
  });

  it("drops to half only while playing when automatic", () => {
    expect(previewScale("auto", true)).toBe(0.5);
    expect(previewScale("auto", false)).toBe(1);
  });

  it("offers every choice once", () => {
    expect(new Set(PREVIEW_QUALITIES).size).toBe(PREVIEW_QUALITIES.length);
    expect(PREVIEW_QUALITIES).toEqual(["full", "half", "quarter", "auto"]);
  });

  it("samples motion blur by the drawn size of the frame and skips it while scrubbing unless asked", () => {
    const frame = { frameWidth: 960, canvasWidth: 1920, resolution: 1.5 };
    expect(previewBlurScale({ ...frame, scrubbing: false, blurWhileScrubbing: false })).toBe(0.75);
    expect(previewBlurScale({ ...frame, scrubbing: true, blurWhileScrubbing: false })).toBeNull();
    expect(previewBlurScale({ ...frame, scrubbing: true, blurWhileScrubbing: true })).toBe(0.75);
    expect(previewBlurScale({ ...frame, canvasWidth: 0, scrubbing: false, blurWhileScrubbing: false })).toBeNull();
  });
});
