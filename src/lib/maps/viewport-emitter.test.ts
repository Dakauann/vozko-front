import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createViewportEmitter, VIEWPORT_DEBOUNCE_MS } from "./viewport-emitter";

const saoPaulo = { south: -23.7, west: -46.8, north: -23.4, east: -46.4 };
const rio = { south: -23.1, west: -43.8, north: -22.8, east: -43.1 };

describe("createViewportEmitter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits the tile-snapped viewport once the map settles", () => {
    const emit = vi.fn();
    const emitter = createViewportEmitter(emit);
    emitter.push({ bbox: saoPaulo, zoom: 10.3 });
    expect(emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toMatchObject({ zoom: 10, key: "10/378:380/580:581" });
  });

  it("emits only the last of a burst of moves", () => {
    const emit = vi.fn();
    const emitter = createViewportEmitter(emit);
    emitter.push({ bbox: saoPaulo, zoom: 10 });
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS - 1);
    emitter.push({ bbox: rio, zoom: 10 });
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0].bbox.west).toBeLessThan(rio.west);
    expect(emit.mock.calls[0][0].bbox.east).toBeGreaterThan(rio.east);
  });

  it("skips a move that lands on the same tiles", () => {
    const emit = vi.fn();
    const emitter = createViewportEmitter(emit);
    emitter.push({ bbox: saoPaulo, zoom: 10 });
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS);
    emitter.push({ bbox: { south: -23.8, west: -47.0, north: -23.3, east: -46.1 }, zoom: 10.6 });
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("never emits an invalid viewport", () => {
    const emit = vi.fn();
    const emitter = createViewportEmitter(emit);
    emitter.push({ bbox: { ...saoPaulo, north: Number.NaN }, zoom: 10 });
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS);
    expect(emit).not.toHaveBeenCalled();
  });

  it("emits nothing after it is cancelled", () => {
    const emit = vi.fn();
    const emitter = createViewportEmitter(emit);
    emitter.push({ bbox: saoPaulo, zoom: 10 });
    emitter.cancel();
    vi.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS);
    expect(emit).not.toHaveBeenCalled();
  });

  it("honours a custom delay", () => {
    const emit = vi.fn();
    const emitter = createViewportEmitter(emit, 50);
    emitter.push({ bbox: saoPaulo, zoom: 10 });
    vi.advanceTimersByTime(50);
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
