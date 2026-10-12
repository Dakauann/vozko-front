import { act, render } from "@testing-library/react";
import { useCallback, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Renderer, Viewport } from "@/lib/studio/render/renderer";

const created: { destroy: ReturnType<typeof vi.fn>; viewport: Viewport }[] = [];
const startup: { gate: Promise<void> } = { gate: Promise.resolve() };

vi.mock("./pixi-renderer", () => ({
  createPixiRenderer: vi.fn(async (_canvas: HTMLCanvasElement, viewport: Viewport) => {
    await startup.gate;
    const renderer = {
      backend: "webgl",
      busy: false,
      missingLuts: new Set<string>(),
      viewport,
      render: vi.fn(),
      resize: vi.fn((next: Viewport) => (renderer.viewport = next)),
      destroy: vi.fn(),
    };
    created.push(renderer);
    return renderer as unknown as Renderer;
  }),
}));

import { GPU_FAILURES_BEFORE_REBUILD, GPU_RESTORE_WAIT_MS, useGpuRenderer, type GpuSession } from "./use-gpu-renderer";

interface Harness {
  frame: () => boolean;
  onUnavailable: () => void;
  canvas: HTMLCanvasElement | null;
  schedule: () => void;
}

const VIEWPORT = { width: 100, height: 100, resolution: 1 };

function Stage({ frame, onUnavailable, onSchedule, viewport = VIEWPORT }: { frame: () => boolean; onUnavailable: () => void; onSchedule: (schedule: () => void) => void; viewport?: Viewport }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const setup = useCallback(
    (schedule: () => void): GpuSession => {
      onSchedule(schedule);
      return { sources: {} as GpuSession["sources"], frame: () => frame(), dispose: () => undefined };
    },
    [frame, onSchedule],
  );
  useGpuRenderer({ canvas, viewport, transparent: false, onUnavailable, setup });
  return <canvas ref={canvas} />;
}

function mount(harness: Harness) {
  const view = render(<Stage frame={harness.frame} onUnavailable={harness.onUnavailable} onSchedule={(schedule) => (harness.schedule = schedule)} />);
  harness.canvas = view.container.querySelector("canvas");
}

async function settle(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
}

describe("useGpuRenderer recovery", () => {
  beforeEach(() => {
    created.length = 0;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rebuilds the renderer when the browser gives the lost GPU context back", async () => {
    const harness: Harness = { frame: vi.fn(() => false), onUnavailable: vi.fn(), canvas: null, schedule: () => undefined };
    mount(harness);
    await settle();
    expect(created).toHaveLength(1);
    harness.canvas!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    harness.canvas!.dispatchEvent(new Event("webglcontextrestored"));
    await settle();
    expect(created).toHaveLength(2);
    expect(created[0].destroy).toHaveBeenCalled();
    expect(harness.onUnavailable).not.toHaveBeenCalled();
  });

  it("falls back to the simple preview when the context does not come back", async () => {
    const harness: Harness = { frame: vi.fn(() => false), onUnavailable: vi.fn(), canvas: null, schedule: () => undefined };
    mount(harness);
    await settle();
    const lost = new Event("webglcontextlost", { cancelable: true });
    harness.canvas!.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(GPU_RESTORE_WAIT_MS + 10);
    });
    expect(harness.onUnavailable).toHaveBeenCalledTimes(1);
  });

  it("rebuilds once when frames keep failing, then falls back instead of freezing", async () => {
    const harness: Harness = {
      frame: vi.fn(() => {
        throw new Error("boom");
      }),
      onUnavailable: vi.fn(),
      canvas: null,
      schedule: () => undefined,
    };
    mount(harness);
    await settle();
    await settle();
    expect(created).toHaveLength(2);
    expect(created[0].destroy).toHaveBeenCalled();
    expect(harness.onUnavailable).toHaveBeenCalledTimes(1);
    expect(harness.frame).toHaveBeenCalledTimes(GPU_FAILURES_BEFORE_REBUILD * 2);
  });

  it("keeps going after one failing frame", async () => {
    let fail = 1;
    const harness: Harness = {
      frame: vi.fn(() => {
        if (fail > 0) {
          fail -= 1;
          throw new Error("boom");
        }
        return false;
      }),
      onUnavailable: vi.fn(),
      canvas: null,
      schedule: () => undefined,
    };
    mount(harness);
    await settle();
    expect(harness.frame).toHaveBeenCalledTimes(2);
    expect(created).toHaveLength(1);
    expect(harness.onUnavailable).not.toHaveBeenCalled();
  });

  it("draws at the size the stage settled on while the GPU was still starting", async () => {
    let open: () => void = () => undefined;
    startup.gate = new Promise<void>((resolve) => (open = resolve));
    const props = { frame: vi.fn(() => false), onUnavailable: vi.fn(), onSchedule: () => undefined };
    const view = render(<Stage {...props} viewport={{ width: 220, height: 390, resolution: 1 }} />);
    await settle();
    view.rerender(<Stage {...props} viewport={{ width: 436, height: 775, resolution: 1 }} />);
    open();
    await settle();
    startup.gate = Promise.resolve();
    expect(created).toHaveLength(1);
    expect(created[0].viewport).toEqual({ width: 436, height: 775, resolution: 1 });
  });

  it("forgets earlier failures once a frame renders", async () => {
    let fail = 0;
    const harness: Harness = {
      frame: vi.fn(() => {
        if (fail > 0) {
          fail -= 1;
          throw new Error("boom");
        }
        return false;
      }),
      onUnavailable: vi.fn(),
      canvas: null,
      schedule: () => undefined,
    };
    mount(harness);
    await settle();
    for (let round = 0; round < 3; round++) {
      fail = GPU_FAILURES_BEFORE_REBUILD - 1;
      for (let i = 0; i < GPU_FAILURES_BEFORE_REBUILD; i++) {
        act(() => harness.schedule());
        await settle();
      }
    }
    expect(created).toHaveLength(1);
    expect(harness.onUnavailable).not.toHaveBeenCalled();
  });
});
