import { describe, expect, it } from "vitest";

import { STUDIO_LIMITS } from "./document";
import { EXPORT_AUDIO_BITRATE, EXPORT_SIZE_MARGIN, EXPORT_VIDEO_BITRATE, exportFrameCount, exportFrameMs, exportFrameUs, exportSamples, MAX_BROWSER_EXPORT_BYTES } from "./export-encoding";

describe("export size", () => {
  it("holds the longest video at the export bitrates with a margin", () => {
    const worst = ((EXPORT_VIDEO_BITRATE + EXPORT_AUDIO_BITRATE) / 8) * (STUDIO_LIMITS.maxVideoMs / 1000) * EXPORT_SIZE_MARGIN;
    expect(MAX_BROWSER_EXPORT_BYTES).toBeGreaterThanOrEqual(worst);
    expect(MAX_BROWSER_EXPORT_BYTES).toBe(512 * 1024 * 1024);
  });
});

describe("export frame clock", () => {
  it("covers the whole timeline at 30 frames per second, like the server render", () => {
    expect(exportFrameCount(2000)).toBe(60);
    expect(exportFrameCount(2010)).toBe(61);
    expect(exportFrameCount(1)).toBe(1);
    expect(exportFrameCount(0)).toBe(0);
  });

  it("samples each frame at its exact time and stamps it in microseconds", () => {
    expect(exportFrameMs(1)).toBeCloseTo(33.3333, 3);
    expect(exportFrameMs(30)).toBe(1000);
    expect(exportFrameUs(1)).toBe(33_333);
    expect(exportFrameUs(2)).toBe(66_667);
  });

  it("sizes the sound to the timeline", () => {
    expect(exportSamples(2000)).toBe(96_000);
    expect(exportSamples(0)).toBe(1);
  });
});
