import { describe, expect, it } from "vitest";

import { exportFrameCount, exportFrameMs, exportFrameUs, exportSamples } from "./export-encoding";

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
