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

export interface GpuRendererOptions {
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
    const schedule = () => {
      if (!disposed && request === 0) request = requestAnimationFrame(draw);
    };
    const session = setup(schedule);
    function draw() {
      request = 0;
      const renderer = rendererRef.current;
      if (!renderer) return;
      const started = performance.now();
      const more = session.frame(renderer, viewportRef.current);
      telemetryRef.current?.rendered(performance.now() - started, continuing);
      continuing = more;
      if (more) schedule();
    }
    const lost = () => telemetryRef.current?.contextLost();
    element.addEventListener("webglcontextlost", lost);
    scheduleRef.current = schedule;
    import("./pixi-renderer")
      .then(({ createPixiRenderer }) => createPixiRenderer(element, viewportRef.current, session.sources, schedule, { transparent }))
      .then(
        (renderer) => {
          if (disposed) {
            renderer.destroy();
            return;
          }
          rendererRef.current = renderer;
          telemetryRef.current?.backend(rendererBackend(renderer.backend));
          schedule();
        },
        () => {
          if (disposed) return;
          telemetryRef.current?.backend("unavailable");
          onUnavailable();
        },
      );
    return () => {
      disposed = true;
      element.removeEventListener("webglcontextlost", lost);
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
