"use client";

import { useCallback, useRef } from "react";

import { studioRenderSources } from "@/components/studio/render/studio-sources";
import { deviceResolution, useGpuRenderer, type GpuSession } from "@/components/studio/render/use-gpu-renderer";
import { useStudioTelemetry } from "@/components/studio/telemetry/studio-telemetry";
import type { CanvasSize } from "@/lib/studio/document";
import { artboardScenes } from "@/lib/studio/scene/image-scene";

import { useImageEditor } from "../editor-state";

export function GpuArtboard({ size, onUnavailable }: { size: CanvasSize; onUnavailable: () => void }) {
  const { store, ui } = useImageEditor();
  const canvas = useRef<HTMLCanvasElement>(null);

  const setup = useCallback(
    (schedule: () => void): GpuSession => {
      const unsubscribe = [store.subscribe(schedule), ui.subscribe(schedule)];
      return {
        sources: studioRenderSources(null),
        frame: (renderer) => {
          const state = ui.getState();
          const hidden = new Set([state.editingTextId, state.crop?.layerId].filter((id): id is string => Boolean(id)));
          const overrides = new Map(Object.entries(state.live ?? {}));
          const origins = state.liveOrigins;
          const scenes = artboardScenes(store.getState().document, { hidden, overrides });
          renderer.render(origins ? scenes.map((scene) => (scene.key && origins[scene.key] ? { ...scene, origin: origins[scene.key] } : scene)) : scenes, state.viewport);
          return false;
        },
        dispose: () => {
          for (const stop of unsubscribe) stop();
        },
      };
    },
    [store, ui],
  );

  const telemetry = useStudioTelemetry();
  useGpuRenderer({ canvas, viewport: { width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)), resolution: deviceResolution() }, transparent: true, onUnavailable, setup, telemetry });

  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 block h-full w-full" />;
}
