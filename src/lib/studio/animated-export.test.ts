import { describe, expect, it } from "vitest";

import {
  animationSize,
  createFrameHold,
  defaultVideoExport,
  exportAt,
  exportKind,
  gifDelaysCs,
  gifRepeat,
  isAnimation,
  isFrame,
  PaletteSample,
  paletteSampleTimes,
  requestSpan,
  samePixels,
  videoExportRequestOf,
  webpDelaysMs,
  withFormat,
  type GifExportRequest,
} from "./animated-export";
import { frameTimes } from "./export-encoding";

const story = { width: 1080, height: 1920 };
const landscape = { width: 1920, height: 1080 };
const FILM_MS = 10_000;

describe("video export requests", () => {
  it("starts each format from the defaults, never wider than the video", () => {
    expect(defaultVideoExport("mp4", story)).toEqual({ format: "mp4" });
    expect(defaultVideoExport("gif", story)).toEqual({ format: "gif", width: 480, fps: 15, loop: 0, colors: 256, dither: "diffusion" });
    expect(defaultVideoExport("webp", story)).toEqual({ format: "webp", width: 480, fps: 15, loop: 0, quality: 0.8 });
  });

  it("reads what Elo asked for and fills the rest with the defaults", () => {
    expect(videoExportRequestOf({}, story, FILM_MS)).toEqual({ format: "mp4" });
    expect(videoExportRequestOf({ format: "gif", width: 320, fps: 10, colors: 64, dither: "ordered", loop: 3 }, story, FILM_MS)).toEqual({ format: "gif", width: 320, fps: 10, loop: 3, colors: 64, dither: "ordered" });
    expect(videoExportRequestOf({ format: "webp", quality: 0.6, loop: 1 }, landscape, FILM_MS)).toEqual({ format: "webp", width: 480, fps: 15, loop: 1, quality: 0.6 });
    expect(videoExportRequestOf({ format: "gif", width: 1080 }, story, FILM_MS)).toMatchObject({ width: 1080 });
  });

  it("refuses values out of range, options of another format and widths past the video", () => {
    const refused: Record<string, unknown>[] = [
      { format: "png" },
      { format: "gif", width: 119 },
      { format: "gif", width: 1081 },
      { format: "gif", width: 480.5 },
      { format: "gif", fps: 4 },
      { format: "gif", fps: 31 },
      { format: "gif", colors: 1 },
      { format: "gif", colors: 257 },
      { format: "gif", dither: "noise" },
      { format: "gif", loop: -1 },
      { format: "webp", loop: 65536 },
      { format: "webp", quality: 0.4 },
      { format: "webp", colors: 64 },
      { format: "gif", quality: 0.8 },
      { format: "mp4", fps: 15 },
      { format: "gif", fps: "15" },
    ];
    for (const args of refused) expect(videoExportRequestOf(args, story, FILM_MS), JSON.stringify(args)).toBeNull();
  });

  it("keeps size, frame rate and repeats when switching between animation formats", () => {
    const gif = { ...(defaultVideoExport("gif", story) as GifExportRequest), width: 320, fps: 10, loop: 2, colors: 32 };
    expect(withFormat(gif, "webp", story)).toEqual({ format: "webp", width: 320, fps: 10, loop: 2, quality: 0.8 });
    expect(withFormat(gif, "mp4", story)).toEqual({ format: "mp4" });
    expect(withFormat({ format: "mp4" }, "gif", story)).toEqual(defaultVideoExport("gif", story));
  });

  it("keeps the video proportions at the chosen width", () => {
    expect(animationSize(story, 480)).toEqual({ width: 480, height: 853 });
    expect(animationSize(landscape, 480)).toEqual({ width: 480, height: 270 });
  });
});

describe("range and frame exports", () => {
  it("reads a range for the video and animation formats, filling the open side with the film edge", () => {
    expect(videoExportRequestOf({ from_ms: 2000, to_ms: 5000 }, story, FILM_MS)).toEqual({ format: "mp4", range: { startMs: 2000, endMs: 5000 } });
    expect(videoExportRequestOf({ format: "gif", from_ms: 8000 }, story, FILM_MS)).toMatchObject({ format: "gif", range: { startMs: 8000, endMs: FILM_MS } });
    expect(videoExportRequestOf({ format: "webp", to_ms: 1500 }, story, FILM_MS)).toMatchObject({ format: "webp", range: { startMs: 0, endMs: 1500 } });
  });

  it("reads a frame at a moment, with jpeg quality", () => {
    expect(videoExportRequestOf({ format: "png", at_ms: 1200 }, story, FILM_MS)).toEqual({ format: "png", atMs: 1200 });
    expect(videoExportRequestOf({ format: "jpeg", at_ms: 0 }, story, FILM_MS)).toEqual({ format: "jpeg", atMs: 0, quality: 0.9 });
    expect(videoExportRequestOf({ format: "jpeg", at_ms: 9999, quality: 0.6 }, story, FILM_MS)).toEqual({ format: "jpeg", atMs: 9999, quality: 0.6 });
  });

  it("refuses ranges outside the film, frames without a moment inside it and timing of the other kind", () => {
    const refused: Record<string, unknown>[] = [
      { from_ms: 5000, to_ms: 5000 },
      { from_ms: 6000, to_ms: 2000 },
      { from_ms: -1 },
      { to_ms: FILM_MS + 1 },
      { from_ms: 1.5 },
      { format: "gif", to_ms: "3000" },
      { format: "png" },
      { format: "png", at_ms: FILM_MS },
      { format: "png", at_ms: -10 },
      { format: "png", at_ms: 10.5 },
      { format: "png", at_ms: 100, quality: 0.8 },
      { format: "jpeg", at_ms: 100, quality: 0.3 },
      { format: "png", at_ms: 100, from_ms: 0 },
      { format: "mp4", at_ms: 100 },
      { format: "jpeg", at_ms: 100, width: 320 },
    ];
    for (const args of refused) expect(videoExportRequestOf(args, story, FILM_MS), JSON.stringify(args)).toBeNull();
  });

  it("exports the whole film unless a range is kept inside it", () => {
    expect(requestSpan({ format: "mp4" }, FILM_MS)).toEqual({ startMs: 0, endMs: FILM_MS });
    expect(requestSpan({ format: "mp4", range: { startMs: 2000, endMs: 4000 } }, FILM_MS)).toEqual({ startMs: 2000, endMs: 4000 });
    expect(requestSpan({ format: "mp4", range: { startMs: 2000, endMs: 14_000 } }, FILM_MS)).toEqual({ startMs: 2000, endMs: FILM_MS });
    expect(requestSpan({ format: "mp4", range: { startMs: 12_000, endMs: 14_000 } }, FILM_MS)).toBeNull();
    expect(requestSpan({ format: "mp4" }, 0)).toBeNull();
  });

  it("places a request at the playhead and on the chosen range when the export starts", () => {
    const area = { startMs: 1000, endMs: 3000 };
    const at = { playheadMs: 2500, durationMs: FILM_MS };
    expect(exportAt({ format: "png", atMs: 0 }, { ...at, range: area })).toEqual({ format: "png", atMs: 2500 });
    expect(exportAt({ format: "png", atMs: 0 }, { ...at, playheadMs: FILM_MS, range: null })).toEqual({ format: "png", atMs: FILM_MS - 1 });
    expect(exportAt({ format: "mp4" }, { ...at, range: area })).toEqual({ format: "mp4", range: area });
    expect(exportAt({ format: "mp4", range: area }, { ...at, range: null })).toEqual({ format: "mp4" });
  });

  it("keeps the range across video formats and the moment across frame formats", () => {
    const ranged = { format: "mp4" as const, range: { startMs: 1000, endMs: 3000 } };
    expect(withFormat(ranged, "gif", story)).toMatchObject({ format: "gif", range: ranged.range });
    expect(withFormat(ranged, "png", story)).toEqual({ format: "png", atMs: 0 });
    expect(withFormat({ format: "png", atMs: 700 }, "jpeg", story)).toEqual({ format: "jpeg", atMs: 700, quality: 0.9 });
    expect(withFormat({ format: "jpeg", atMs: 700, quality: 0.9 }, "webp", story)).toEqual(defaultVideoExport("webp", story));
  });

  it("names what each request makes", () => {
    expect(exportKind({ format: "mp4" })).toBe("video");
    expect(exportKind(defaultVideoExport("gif", story))).toBe("animation");
    expect(exportKind({ format: "jpeg", atMs: 0, quality: 0.9 })).toBe("frame");
    expect(isFrame({ format: "png", atMs: 0 })).toBe(true);
    expect(isAnimation({ format: "png", atMs: 0 })).toBe(false);
  });
});

describe("animation timing", () => {
  it("samples the timeline at the chosen frame rate", () => {
    expect(frameTimes(1000, 4)).toEqual([0, 250, 500, 750]);
    expect(frameTimes(1001, 4)).toHaveLength(5);
    expect(frameTimes(0, 15)).toEqual([]);
  });

  it("spreads gif delays over centiseconds so the total keeps the video length", () => {
    const times = frameTimes(1000, 15);
    const delays = gifDelaysCs(times, 1000);
    expect(delays.slice(0, 3)).toEqual([7, 6, 7]);
    expect(delays.reduce((sum, d) => sum + d, 0)).toBe(100);
    expect(Math.min(...gifDelaysCs(frameTimes(3000, 30), 3000))).toBeGreaterThanOrEqual(3);
  });

  it("never writes a delay browsers would slow down", () => {
    expect(gifDelaysCs([0, 100], 101)).toEqual([10, 2]);
    expect(webpDelaysMs([0, 100], 101)).toEqual([100, 20]);
  });

  it("keeps webp delays in milliseconds that add up to the video length", () => {
    const delays = webpDelaysMs(frameTimes(1000, 15), 1000);
    expect(delays.slice(0, 3)).toEqual([67, 66, 67]);
    expect(delays.reduce((sum, d) => sum + d, 0)).toBe(1000);
  });

  it("maps plays to the gif repeat field", () => {
    expect(gifRepeat(0)).toBe(0);
    expect(gifRepeat(1)).toBe(-1);
    expect(gifRepeat(3)).toBe(2);
  });
});

describe("frames that repeat", () => {
  it("merges a frame that did not change into the one before it, up to the longest delay the format holds", () => {
    const written: [string, number][] = [];
    const hold = createFrameHold<string>((frame, delay) => written.push([frame, delay]), 10);
    hold.add("a", 3);
    hold.extend(3);
    hold.add("b", 3);
    hold.extend(4);
    hold.extend(4);
    hold.flush();
    expect(written).toEqual([
      ["a", 6],
      ["b", 7],
      ["b", 4],
    ]);
  });

  it("compares frames pixel by pixel", () => {
    const a = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]);
    expect(samePixels(a, new Uint8ClampedArray(a))).toBe(true);
    expect(samePixels(a, new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 7, 255]))).toBe(false);
    expect(samePixels(a, null)).toBe(false);
  });
});

describe("palette sampling", () => {
  it("picks evenly spaced frames across the whole video", () => {
    const times = frameTimes(10_000, 10);
    const picked = paletteSampleTimes(times, 4);
    expect(picked).toEqual([0, 3300, 6600, 9900]);
    expect(paletteSampleTimes([0, 100], 4)).toEqual([0, 100]);
  });

  it("keeps a bounded share of pixels from every sampled frame", () => {
    const sample = new PaletteSample(2, 4, 4);
    sample.add(new Uint8ClampedArray([10, 0, 0, 255, 11, 0, 0, 255, 12, 0, 0, 255, 13, 0, 0, 255]));
    sample.add(new Uint8ClampedArray([20, 0, 0, 255, 21, 0, 0, 255, 22, 0, 0, 255, 23, 0, 0, 255]));
    const pixels = sample.pixels();
    expect(Array.from(pixels.filter((_, i) => i % 4 === 0))).toEqual([10, 12, 20, 22]);
    expect(pixels.buffer.byteLength).toBe(pixels.length);
  });
});
