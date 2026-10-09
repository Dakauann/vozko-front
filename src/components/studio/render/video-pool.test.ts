import { describe, expect, it, vi } from "vitest";

import type { VideoSource } from "@/lib/studio/scene/scene";

import { VideoPool } from "./video-pool";

function fakeVideo() {
  const video = document.createElement("video");
  Object.defineProperty(video, "readyState", { value: 4, configurable: true });
  let time = 0;
  Object.defineProperty(video, "currentTime", { get: () => time, set: (v: number) => (time = v), configurable: true });
  video.play = vi.fn(async () => undefined);
  video.pause = vi.fn();
  return video;
}

const source = (clipId: string, sourceMs: number): VideoSource => ({ kind: "video", clipId, assetId: `a-${clipId}`, sourceMs });

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("preview video pool", () => {
  it("keeps one element per clip on screen, seeks it to the scene time and drops clips that left", async () => {
    const made: HTMLVideoElement[] = [];
    const pool = new VideoPool(async (id) => ({ blob: new Blob(), contentType: "video/mp4", url: `blob:${id}` }), () => {
      const video = fakeVideo();
      made.push(video);
      return video;
    }, vi.fn());
    pool.sync([{ source: source("c1", 1500), visible: true }], { playing: false, rate: 1 });
    await settle();
    pool.sync([{ source: source("c1", 1500), visible: true }], { playing: false, rate: 1 });
    expect(made).toHaveLength(1);
    expect(made[0].src).toContain("blob:a-c1");
    expect(made[0].currentTime).toBeCloseTo(1.5, 3);
    expect(pool.element("c1")).toBe(made[0]);
    pool.sync([], { playing: false, rate: 1 });
    expect(pool.element("c1")).toBeNull();
  });

  it("plays only visible clips while the timeline plays", async () => {
    const made: HTMLVideoElement[] = [];
    const pool = new VideoPool(async (id) => ({ blob: new Blob(), contentType: "video/mp4", url: `blob:${id}` }), () => {
      const video = fakeVideo();
      made.push(video);
      return video;
    }, vi.fn());
    const scene = [{ source: source("on", 0), visible: true }, { source: source("next", 0), visible: false }];
    pool.sync(scene, { playing: true, rate: 1 });
    await settle();
    pool.sync(scene, { playing: true, rate: 1 });
    expect(made[0].play).toHaveBeenCalled();
    expect(made[1].play).not.toHaveBeenCalled();
  });

  it("never shows a clip whose file could not be loaded", async () => {
    const pool = new VideoPool(async () => null, fakeVideo, vi.fn());
    pool.sync([{ source: source("broken", 0), visible: true }], { playing: false, rate: 1 });
    await settle();
    expect(pool.element("broken")).toBeNull();
  });
});
