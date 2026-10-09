"use client";

import { useCallback, useRef } from "react";

import { loadMediaFile } from "@/components/studio/canvas/media-files";
import { DecodedVideos } from "@/components/studio/media/decoded-videos";
import { openMediaWorker } from "@/components/studio/media/media-worker";
import { studioRenderSources } from "@/components/studio/render/studio-sources";
import { deviceResolution, useGpuRenderer, type GpuSession } from "@/components/studio/render/use-gpu-renderer";
import { VideoFeed } from "@/components/studio/render/video-feed";
import { VideoPool } from "@/components/studio/render/video-pool";
import { useStudioTelemetry } from "@/components/studio/telemetry/studio-telemetry";
import type { CanvasSize } from "@/lib/studio/document";
import { focusedPlan, visualPlan } from "@/lib/studio/playback";
import { fitCamera } from "@/lib/studio/render/renderer";
import { videoSources } from "@/lib/studio/scene/scene";
import { videoScene } from "@/lib/studio/scene/video-scene";

import { useVideoEditor } from "../editor-context";

export function GpuStage({ frame, onUnavailable }: { frame: CanvasSize; onUnavailable: () => void }) {
  const { store, view, assets, playback } = useVideoEditor();
  const canvas = useRef<HTMLCanvasElement>(null);
  const telemetry = useStudioTelemetry();

  const setup = useCallback(
    (schedule: () => void): GpuSession => {
      const feed = new VideoFeed(
        new DecodedVideos(openMediaWorker(), loadMediaFile, assets.previewOf, schedule, {
          undecodable: () => telemetry?.decodeFallback(),
          broken: () => telemetry?.workerFailed(),
        }),
        new VideoPool((assetId) => loadMediaFile(assets.previewOf(assetId)), () => window.document.createElement("video"), schedule),
      );
      const unsubscribe = [store.subscribe(schedule), view.subscribe(schedule)];
      return {
        sources: studioRenderSources(feed),
        frame: (renderer, viewport) => {
          const doc = store.getState().document;
          const state = view.getState();
          const playheadMs = state.playing ? playback.position() : state.playheadMs;
          const scene = videoScene(doc, focusedPlan(visualPlan(doc, playheadMs), state.focus?.clipId ?? null, Boolean(state.focus?.solo)));
          feed.sync(videoSources(scene), { playing: state.playing, rate: state.rate });
          renderer.render([scene], fitCamera(scene, viewport));
          return state.playing;
        },
        dispose: () => {
          for (const stop of unsubscribe) stop();
          feed.dispose();
        },
      };
    },
    [store, view, assets, playback, telemetry],
  );

  useGpuRenderer({
    canvas,
    viewport: { width: Math.max(1, Math.round(frame.width)), height: Math.max(1, Math.round(frame.height)), resolution: deviceResolution() },
    transparent: false,
    onUnavailable,
    setup,
    telemetry,
  });

  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 block h-full w-full" style={{ zIndex: 1 }} />;
}
