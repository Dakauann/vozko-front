import type Konva from "konva";
import { describe, expect, it, vi } from "vitest";

import { lazyHitGraph, sceneless } from "./konva-layer-modes";

type OwnCanvas = NonNullable<Parameters<Konva.Layer["drawScene"]>[0]>;
type OwnHitCanvas = NonNullable<Parameters<Konva.Layer["drawHit"]>[0]>;

function fakeLayer(drawable = true) {
  const calls: string[] = [];
  const clear = vi.fn();
  const layer = {
    drawHit: vi.fn(function (this: unknown, can?: unknown) {
      calls.push(can ? "hit:own-canvas" : "hit");
      return this;
    }),
    drawScene: vi.fn(function (this: unknown, can?: unknown) {
      calls.push(can ? "scene:own-canvas" : "scene");
      return this;
    }),
    getIntersection: vi.fn(() => {
      calls.push("read");
      return null;
    }),
    shouldDrawHit: vi.fn(() => drawable),
    batchDraw: vi.fn(),
    getCanvas: () => ({ getContext: () => ({ clear }) }),
  };
  return { layer, calls, clear, konva: layer as unknown as Konva.Layer };
}

describe("lazy hit graph", () => {
  it("redraws the hit graph once, when a pointer reads it, however many frames were drawn before", () => {
    const { konva, calls } = fakeLayer();
    lazyHitGraph(konva);
    konva.drawHit();
    konva.drawHit();
    konva.drawHit();
    expect(calls).toEqual([]);
    konva.getIntersection({ x: 1, y: 1 });
    konva.getIntersection({ x: 2, y: 2 });
    expect(calls).toEqual(["hit", "read", "read"]);
  });

  it("is stale from the start, so the first read draws it", () => {
    const { konva, calls } = fakeLayer();
    lazyHitGraph(konva);
    konva.getIntersection({ x: 1, y: 1 });
    expect(calls).toEqual(["hit", "read"]);
  });

  it("passes drawing into another canvas straight through, as caching does", () => {
    const { konva, calls } = fakeLayer();
    lazyHitGraph(konva);
    konva.drawHit({} as OwnHitCanvas);
    expect(calls).toEqual(["hit:own-canvas"]);
  });

  it("stays stale while Konva would skip the hit graph, like during a drag, and draws it on the first read after", () => {
    const fake = fakeLayer(false);
    lazyHitGraph(fake.konva);
    fake.konva.drawHit();
    fake.konva.getIntersection({ x: 1, y: 1 });
    expect(fake.calls).toEqual(["read"]);
    fake.layer.shouldDrawHit.mockReturnValue(true);
    fake.konva.getIntersection({ x: 1, y: 1 });
    expect(fake.calls).toEqual(["read", "hit", "read"]);
  });

  it("restores the original methods when released", () => {
    const { konva, calls } = fakeLayer();
    const release = lazyHitGraph(konva);
    release();
    konva.drawHit();
    expect(calls).toEqual(["hit"]);
  });
});

describe("sceneless layer", () => {
  it("skips drawing its own scene and clears what was drawn before", () => {
    const { konva, calls, clear } = fakeLayer();
    sceneless(konva);
    konva.drawScene();
    expect(calls).toEqual([]);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("still draws into another canvas, so exports and caches keep working", () => {
    const { konva, calls } = fakeLayer();
    sceneless(konva);
    konva.drawScene({} as OwnCanvas);
    expect(calls).toEqual(["scene:own-canvas"]);
  });

  it("draws again once released", () => {
    const { konva, calls, layer } = fakeLayer();
    const release = sceneless(konva);
    release();
    konva.drawScene();
    expect(calls).toEqual(["scene"]);
    expect(layer.batchDraw).toHaveBeenCalled();
  });
});
