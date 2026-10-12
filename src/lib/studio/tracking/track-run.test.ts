import { describe, expect, it } from "vitest";

import { runTrack, type FeedFrame, type FrameFeed, type TrackJob } from "./track-run";
import { syntheticFrame, type DotPlacement, type SyntheticScene } from "./synthetic-frames";

const FPS = 30;
const SCENE: SyntheticScene = { width: 160, height: 90, seed: 5 };

function dotAt(seconds: number): DotPlacement {
  return { x: 30 + 50 * seconds, y: 45 + 12 * Math.sin(seconds * 3) };
}

interface FakeFeed extends FrameFeed {
  asked: [number, number][];
}

function feed(lengthSec: number, scene: SyntheticScene = SCENE, path: (seconds: number) => DotPlacement = dotAt, covered?: (seconds: number) => SyntheticScene["covered"]): FakeFeed {
  const asked: [number, number][] = [];
  const count = Math.round(lengthSec * FPS);
  return {
    width: scene.width,
    height: scene.height,
    asked,
    async *frames(fromSec: number, toSec: number): AsyncGenerator<FeedFrame> {
      asked.push([fromSec, toSec]);
      for (let n = 0; n < count; n++) {
        const timestamp = n / FPS;
        const duration = 1 / FPS;
        if (timestamp + duration <= fromSec + 1e-6) continue;
        if (timestamp > toSec + 1e-6) return;
        yield { timestamp, duration, luma: syntheticFrame({ ...scene, covered: covered?.(timestamp) ?? null }, path(timestamp)) };
      }
    },
  };
}

function job(overrides: Partial<TrackJob> = {}): TrackJob {
  const at = dotAt(1);
  return { point: { x: at.x / SCENE.width, y: at.y / SCENE.height }, size: 24 / SCENE.height, atMs: 1000, fromMs: 0, toMs: 1900, direction: "both", ...overrides };
}

function worstPixels(samples: readonly { atMs: number; x: number; y: number }[]): number {
  return Math.max(...samples.map((sample) => Math.hypot(sample.x * SCENE.width - dotAt(sample.atMs / 1000).x, sample.y * SCENE.height - dotAt(sample.atMs / 1000).y)));
}

describe("a track run", () => {
  it("tracks both ways from the picked frame and returns one sample per frame in time order", async () => {
    const run = await runTrack(feed(2), job(), {});
    if (run.kind !== "tracked") throw new Error(run.kind);
    expect(run.referenceMs).toBe(1000);
    expect(run.loss).toBeNull();
    expect(run.samples.map((sample) => sample.atMs)).toEqual(Array.from({ length: 58 }, (_, n) => Math.round((n * 1000) / FPS)));
    expect(run.samples.find((sample) => sample.atMs === 1000)?.confidence).toBe(1);
    expect(worstPixels(run.samples)).toBeLessThan(0.1);
  });

  it("goes back in chunks small enough for the memory budget", async () => {
    const source = feed(2);
    const run = await runTrack(source, job({ direction: "backward" }), { chunkBytes: SCENE.width * SCENE.height * 60 * 0.3 });
    if (run.kind !== "tracked") throw new Error(run.kind);
    expect(run.samples[0].atMs).toBe(0);
    expect(run.samples.at(-1)?.atMs).toBe(1000);
    expect(source.asked.length).toBeGreaterThan(3);
    expect(worstPixels(run.samples)).toBeLessThan(0.1);
  });

  it("only goes forward when asked, within the span", async () => {
    const run = await runTrack(feed(2), job({ direction: "forward", toMs: 1500 }), {});
    if (run.kind !== "tracked") throw new Error(run.kind);
    expect(run.samples[0].atMs).toBe(1000);
    expect(run.samples.at(-1)!.atMs).toBeLessThanOrEqual(1500);
    expect(run.samples.at(-1)!.atMs).toBeGreaterThan(1450);
  });

  it("stops where the point is lost and says when and how sure it was", async () => {
    const hidden = (seconds: number) => (seconds >= 1.5 ? { left: 0, top: 0, width: SCENE.width, height: SCENE.height } : null);
    const run = await runTrack(feed(2, SCENE, dotAt, hidden), job(), {});
    if (run.kind !== "tracked") throw new Error(run.kind);
    expect(run.loss?.direction).toBe("forward");
    expect(run.loss?.atMs).toBe(1500);
    expect(run.loss!.confidence).toBeLessThan(0.6);
    expect(run.samples.at(-1)!.atMs).toBeLessThan(1500);
    expect(run.samples[0].atMs).toBe(0);
  });

  it("reports progress that only grows and ends at one", async () => {
    const seen: number[] = [];
    await runTrack(feed(2), job(), { onProgress: (done) => seen.push(done) });
    expect(seen.length).toBeGreaterThan(10);
    expect(seen.every((value, i) => i === 0 || value >= seen[i - 1])).toBe(true);
    expect(seen.at(-1)).toBe(1);
  });

  it("stops when cancelled", async () => {
    const controller = new AbortController();
    let frames = 0;
    const run = await runTrack(feed(2), job(), {
      signal: controller.signal,
      onProgress: () => {
        frames += 1;
        if (frames === 5) controller.abort();
      },
    });
    expect(run.kind).toBe("cancelled");
    expect(frames).toBeLessThan(8);
  });

  it("refuses a point with no detail and a point outside the picture", async () => {
    expect((await runTrack(feed(1, { ...SCENE, flat: true }), job({ toMs: 900, atMs: 100 }), {})).kind).toBe("flat");
    expect((await runTrack(feed(1), job({ point: { x: 1.2, y: 0.5 }, atMs: 100, toMs: 900 }), {})).kind).toBe("outside");
  });

  it("finds nothing past the end of the video", async () => {
    expect((await runTrack(feed(1), job({ atMs: 5000, fromMs: 4000, toMs: 6000 }), {})).kind).toBe("empty");
  });
});
