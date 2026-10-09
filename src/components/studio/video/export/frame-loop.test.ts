import { describe, expect, it, vi } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import type { SceneVideo } from "@/lib/studio/scene/scene";

import { renderFrames, Wake, type FrameLoopDeps } from "./frame-loop";

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 100), id: "clip" }] }];
  d.durationMs = 100;
  return d;
}

function deps(overrides: Partial<FrameLoopDeps> = {}) {
  const wake = new Wake();
  const progress: [number, number][] = [];
  const base: FrameLoopDeps = {
    doc: film(),
    videos: { sync: vi.fn(() => []), ready: vi.fn(() => true) },
    renderer: { render: vi.fn(), busy: false },
    wake,
    emit: vi.fn(async () => undefined),
    onProgress: (done, total) => void progress.push([done, total]),
    stallMs: 50,
  };
  return { ...base, ...overrides, progress };
}

describe("export frame loop", () => {
  it("draws and hands over every frame once, in order, with progress", async () => {
    const d = deps();
    expect(await renderFrames(d)).toBe("complete");
    expect(vi.mocked(d.emit).mock.calls.map(([index]) => index)).toEqual([0, 1, 2]);
    expect(d.progress.at(-1)).toEqual([3, 3]);
  });

  it("waits until loading textures and exact video frames are there before handing a frame over", async () => {
    let renders = 0;
    const wake = new Wake();
    const renderer = {
      render: vi.fn(() => {
        renders += 1;
        queueMicrotask(() => wake.notify());
      }),
      get busy() {
        return renders < 2;
      },
    };
    let checks = 0;
    const videos = { sync: vi.fn(() => []), ready: vi.fn(() => ++checks > 3) };
    const d = deps({ wake, renderer, videos });
    expect(await renderFrames(d)).toBe("complete");
    expect(renderer.render.mock.calls.length).toBeGreaterThan(3);
    expect(d.emit).toHaveBeenCalledTimes(3);
  });

  it("gives up when a clip cannot be decoded or nothing arrives in time", async () => {
    const undecodable = deps({ videos: { sync: vi.fn((clips: readonly SceneVideo[]) => [...clips]), ready: vi.fn(() => true) } });
    expect(await renderFrames(undecodable)).toBe("undecodable");
    expect(undecodable.emit).not.toHaveBeenCalled();
    const stalled = deps({ videos: { sync: vi.fn(() => []), ready: vi.fn(() => false) } });
    expect(await renderFrames(stalled)).toBe("stalled");
    expect(stalled.emit).not.toHaveBeenCalled();
  });
});
