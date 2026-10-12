import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";

import { BoardCache, type CachedBoard } from "./board-cache";

const camera = { scale: 0.5, x: 10, y: 20 };
const viewport = { width: 800, height: 600, resolution: 1 };

function board(count: number, origin = { x: 0, y: 0 }) {
  const root = new Container();
  const content = new Container();
  root.addChild(content);
  const layers = Array.from({ length: count }, (_, index) => {
    const object = new Container();
    content.addChild(object);
    return { object, index };
  });
  const state = { paint: true, halo: true };
  const view: CachedBoard = {
    root,
    content,
    layers,
    origin,
    size: { width: 400, height: 300 },
    paint: (shown) => void (state.paint = shown),
    halo: (shown) => void (state.halo = shown),
  };
  return { view, layers, state };
}

function recorder(target: ReturnType<typeof board>) {
  const frames: { drawn: number[]; paint: boolean; halo: boolean }[] = [];
  const gpu = { render: vi.fn(() => frames.push({ drawn: target.layers.filter((l) => l.object.renderable).map((l) => l.index), paint: target.state.paint, halo: target.state.halo })) };
  return { gpu, frames };
}

function live(target: ReturnType<typeof board>): number[] {
  return target.layers.filter((l) => l.object.renderable).map((l) => l.index);
}

describe("board cache", () => {
  it("draws what is under the moving layers once with the board paint, what is over them once without, and leaves only the moving layers live", () => {
    const target = board(5);
    const { gpu, frames } = recorder(target);
    const cache = new BoardCache(gpu as never, false);
    cache.apply(target.view, { below: 2, above: 3 }, 5, "k", camera, viewport);
    expect(frames).toEqual([
      { drawn: [0, 1], paint: true, halo: false },
      { drawn: [3, 4], paint: false, halo: false },
    ]);
    expect(live(target)).toEqual([2]);
    expect(target.state).toEqual({ paint: false, halo: true });
    expect(cache.active).toBe(true);
  });

  it("reuses the snapshots while the key and the split stay the same", () => {
    const target = board(5);
    const { gpu } = recorder(target);
    const cache = new BoardCache(gpu as never, false);
    cache.apply(target.view, { below: 2, above: 3 }, 5, "k", camera, viewport);
    cache.apply(target.view, { below: 2, above: 3 }, 5, "k", camera, viewport);
    expect(gpu.render).toHaveBeenCalledTimes(2);
    cache.apply(target.view, { below: 2, above: 3 }, 5, "moved camera", camera, viewport);
    expect(gpu.render).toHaveBeenCalledTimes(4);
    cache.apply(target.view, { below: 1, above: 3 }, 5, "moved camera", camera, viewport);
    expect(gpu.render).toHaveBeenCalledTimes(6);
  });

  it("caches a still board whole, under nothing live", () => {
    const target = board(3);
    const { gpu, frames } = recorder(target);
    new BoardCache(gpu as never, false).apply(target.view, { below: 3, above: 3 }, 3, "k", camera, viewport);
    expect(frames).toEqual([{ drawn: [0, 1, 2], paint: true, halo: false }]);
    expect(live(target)).toEqual([]);
  });

  it("gives every layer and the board paint back when the gesture ends", () => {
    const target = board(4);
    const { gpu } = recorder(target);
    const cache = new BoardCache(gpu as never, false);
    cache.apply(target.view, { below: 1, above: 2 }, 4, "k", camera, viewport);
    cache.apply(target.view, null, 4, "k", camera, viewport);
    expect(live(target)).toEqual([0, 1, 2, 3]);
    expect(target.state).toEqual({ paint: true, halo: true });
    expect(cache.active).toBe(false);
  });

  it("draws nothing for a board off the screen and redraws once it is back", () => {
    const target = board(3, { x: 5000, y: 0 });
    const { gpu } = recorder(target);
    const cache = new BoardCache(gpu as never, false);
    cache.apply(target.view, { below: 1, above: 2 }, 3, "k", camera, viewport);
    expect(gpu.render).not.toHaveBeenCalled();
    expect(live(target)).toEqual([1]);
    target.view.origin = { x: 0, y: 0 };
    cache.apply(target.view, { below: 1, above: 2 }, 3, "k", camera, viewport);
    expect(gpu.render).toHaveBeenCalledTimes(2);
  });
});
