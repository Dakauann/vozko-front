import { describe, expect, it } from "vitest";

import { bucketFor, LruCache, planFilmstrip, tileWidth, waveformBars } from "./filmstrip";

describe("filmstrip planner", () => {
  it("sizes tiles from the clip height and aspect", () => {
    expect(tileWidth(45)).toBe(80);
    expect(tileWidth(45, 9 / 16)).toBe(25);
    expect(tileWidth(10, 0.1)).toBe(16);
  });

  it("buckets source times in powers of two so zooming reuses frames", () => {
    expect(bucketFor(50)).toBe(100);
    expect(bucketFor(150)).toBe(200);
    expect(bucketFor(1000)).toBe(1600);
    expect(bucketFor(1600) % bucketFor(150)).toBe(0);
  });

  it("plans only the visible tiles with bucketed source times after the trim", () => {
    const tiles = planFilmstrip({ clipWidthPx: 400, heightPx: 45, trimInMs: 1000, durationMs: 4000, visibleFromPx: 100, visibleToPx: 300 });
    expect(tiles.map((t) => t.index)).toEqual([1, 2, 3]);
    expect(tiles[0]).toEqual({ index: 1, leftPx: 80, widthPx: 80, sourceMs: 1600 });
    expect(tiles.every((t) => t.sourceMs % 800 === 0)).toBe(true);
  });

  it("cuts the last tile at the clip end and never asks past the source", () => {
    const tiles = planFilmstrip({ clipWidthPx: 200, heightPx: 45, trimInMs: 0, durationMs: 2000, visibleFromPx: 0, visibleToPx: 1000, sourceDurationMs: 1500 });
    expect(tiles.map((t) => t.widthPx)).toEqual([80, 80, 40]);
    expect(Math.max(...tiles.map((t) => t.sourceMs))).toBeLessThanOrEqual(1499);
  });

  it("returns nothing for empty clips", () => {
    expect(planFilmstrip({ clipWidthPx: 0, heightPx: 45, trimInMs: 0, durationMs: 1000, visibleFromPx: 0, visibleToPx: 100 })).toEqual([]);
  });
});

describe("frame cache and bars", () => {
  it("evicts the least recently used entry", () => {
    const cache = new LruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.size).toBe(2);
  });

  it("hands evicted values back so their owner can release them", () => {
    const evicted: number[] = [];
    const cache = new LruCache<string, number>(1, (value) => evicted.push(value));
    cache.set("a", 1);
    cache.set("a", 2);
    cache.set("b", 3);
    expect(evicted).toEqual([2]);
  });

  it("draws at most one bar per pixel", () => {
    expect(waveformBars(300, 2)).toBe(150);
    expect(waveformBars(300, 0)).toBe(300);
  });
});
