"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { Renderer, RenderSources, Viewport } from "@/lib/studio/render/renderer";
import { rendererBackend } from "@/lib/studio/telemetry";

import type { StudioTelemetry } from "../telemetry/telemetry-session";

export interface GpuSession {
  sources: RenderSources;
  frame: (renderer: Renderer, viewport: Viewport) => boolean;
  dispose: () => void;
}

interface GpuRendererOptions {
  canvas: RefObject<HTMLCanvasElement | null>;
  viewport: Viewport;
  transparent: boolean;
  onUnavailable: () => void;
  setup: (schedule: () => void) => GpuSession;
  telemetry?: StudioTelemetry | null;
}

export function deviceResolution(): number {
  return typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
}

export const GPU_RESTORE_WAIT_MS = 3000;
export const GPU_FAILURES_BEFORE_REBUILD = 3;

export function useGpuRenderer({ canvas, viewport, transparent, onUnavailable, setup, telemetry = null }: GpuRendererOptions): void {
  const rendererRef = useRef<Renderer | null>(null);
  const scheduleRef = useRef<() => void>(() => undefined);
  const viewportRef = useRef(viewport);
  const telemetryRef = useRef(telemetry);

  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let request = 0;
    let disposed = false;
    let continuing = false;
    let failures = 0;
    let rebuilt = false;
    let restoreTimer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (!disposed && request === 0) request = requestAnimationFrame(draw);
    };
    const session = setup(schedule);
    const giveUp = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(request);
      rendererRef.current?.destroy();
      rendererRef.current = null;
      telemetryRef.current?.backend("unavailable");
      onUnavailable();
    };
    const build = () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
      let started = viewportRef.current;
      import("./pixi-renderer")
        .then(({ createPixiRenderer }) => {
          started = viewportRef.current;
          return createPixiRenderer(element, started, session.sources, schedule, { transparent });
        })
        .then(
          (renderer) => {
            if (disposed) {
              renderer.destroy();
              return;
            }
            if (viewportRef.current !== started) renderer.resize(viewportRef.current);
            rendererRef.current = renderer;
            telemetryRef.current?.backend(rendererBackend(renderer.backend));
            schedule();
          },
          giveUp,
        );
    };
    const failed = () => {
      failures += 1;
      if (failures < GPU_FAILURES_BEFORE_REBUILD) {
        schedule();
        return;
      }
      failures = 0;
      if (rebuilt) {
        giveUp();
        return;
      }
      rebuilt = true;
      build();
    };
    function draw() {
      request = 0;
      const renderer = rendererRef.current;
      if (!renderer) return;
      const started = performance.now();
      let more: boolean;
      try {
        more = session.frame(renderer, viewportRef.current);
      } catch {
        failed();
        return;
      }
      failures = 0;
      telemetryRef.current?.rendered(performance.now() - started, continuing);
      continuing = more;
      if (more) schedule();
    }
    const lost = (event: Event) => {
      event.preventDefault();
      telemetryRef.current?.contextLost();
      cancelAnimationFrame(request);
      request = 0;
      if (restoreTimer === null) restoreTimer = setTimeout(giveUp, GPU_RESTORE_WAIT_MS);
    };
    const restored = () => {
      if (restoreTimer !== null) clearTimeout(restoreTimer);
      restoreTimer = null;
      if (!disposed) build();
    };
    element.addEventListener("webglcontextlost", lost);
    element.addEventListener("webglcontextrestored", restored);
    scheduleRef.current = schedule;
    build();
    return () => {
      disposed = true;
      if (restoreTimer !== null) clearTimeout(restoreTimer);
      element.removeEventListener("webglcontextlost", lost);
      element.removeEventListener("webglcontextrestored", restored);
      cancelAnimationFrame(request);
      session.dispose();
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [canvas, transparent, onUnavailable, setup]);

  const { width, height, resolution } = viewport;
  useEffect(() => {
    viewportRef.current = { width, height, resolution };
    rendererRef.current?.resize(viewportRef.current);
    scheduleRef.current();
  }, [width, height, resolution]);
}
