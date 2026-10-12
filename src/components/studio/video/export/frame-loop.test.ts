import { describe, expect, it, vi } from "vitest";

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { frameTimes } from "@/lib/studio/export-encoding";
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
    times: frameTimes(100),
    videos: { sync: vi.fn(() => []), ready: vi.fn(() => true) },
    renderer: { render: vi.fn(), busy: false, missingLuts: new Set() },
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

  it("renders only the asked times, scaled to the output width", async () => {
    const renderer = { render: vi.fn(), busy: false, missingLuts: new Set<string>() };
    const d = deps({ times: [0, 66], viewWidth: 540, renderer });
    expect(await renderFrames(d)).toBe("complete");
    expect(d.emit).toHaveBeenCalledTimes(2);
    expect(renderer.render.mock.calls[0][1]).toMatchObject({ scale: 0.5 });
    expect(d.progress.at(-1)).toEqual([2, 2]);
  });

  it("renders the asked times from the start of an exported range", async () => {
    const doc = film();
    doc.tracks[0].clips[0] = { ...doc.tracks[0].clips[0], startMs: 0, durationMs: 3000 };
    doc.durationMs = 3000;
    const shown: number[] = [];
    const sync = (clips: readonly SceneVideo[]): SceneVideo[] => {
      shown.push(...clips.map((clip) => clip.source.sourceMs));
      return [];
    };
    const videos = { sync: vi.fn(sync), ready: vi.fn(() => true) };
    const d = deps({ doc, times: [0, 500], originMs: 2000, videos });
    expect(await renderFrames(d)).toBe("complete");
    expect(shown).toEqual([2000, 2500]);
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
      missingLuts: new Set<string>(),
    };
    let checks = 0;
    const videos = { sync: vi.fn(() => []), ready: vi.fn(() => ++checks > 3) };
    const d = deps({ wake, renderer, videos });
    expect(await renderFrames(d)).toBe("complete");
    expect(renderer.render.mock.calls.length).toBeGreaterThan(3);
    expect(d.emit).toHaveBeenCalledTimes(3);
  });

  it("draws motion blur with the samples of the shared placement, fewer when the output is smaller", async () => {
    const doc = film();
    doc.durationMs = 1000;
    doc.tracks[0].clips[0] = { ...doc.tracks[0].clips[0], durationMs: 1000, transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }, motionBlur: true, keyframes: { x: [{ atMs: 0, value: 0.1, easing: "linear" }, { atMs: 1000, value: 0.9, easing: "linear" }] } };
    const samplesAt = async (viewWidth?: number) => {
      const renderer = { render: vi.fn(), busy: false, missingLuts: new Set<string>() };
      expect(await renderFrames(deps({ doc, times: [500], renderer, ...(viewWidth ? { viewWidth } : {}) }))).toBe("complete");
      const scene = renderer.render.mock.calls[0][0][0] as { nodes: { trail?: { maps: readonly number[] } }[] };
      return (scene.nodes[0].trail?.maps.length ?? 0) / 6;
    };
    const full = await samplesAt();
    expect(full).toBe(Math.ceil((0.8 * 1080 * (1000 / 30 / 2)) / 1000));
    expect(await samplesAt(540)).toBe(Math.ceil(full / 2));
  });

  it("gives up when a clip cannot be decoded or nothing arrives in time", async () => {
    const undecodable = deps({ videos: { sync: vi.fn((clips: readonly SceneVideo[]) => [...clips]), ready: vi.fn(() => true) } });
    expect(await renderFrames(undecodable)).toBe("undecodable");
    expect(undecodable.emit).not.toHaveBeenCalled();
    const stalled = deps({ videos: { sync: vi.fn(() => []), ready: vi.fn(() => false) } });
    expect(await renderFrames(stalled)).toBe("stalled");
    expect(stalled.emit).not.toHaveBeenCalled();
  });

  it("refuses a frame whose LUT could not be read instead of drawing it without the LUT", async () => {
    const missing = deps({ renderer: { render: vi.fn(), busy: false, missingLuts: new Set(["look"]) } });
    expect(await renderFrames(missing)).toBe("lut_unavailable");
    expect(missing.emit).not.toHaveBeenCalled();
  });
});
