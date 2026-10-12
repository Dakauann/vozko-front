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
import { videoCanvasSize } from "@/lib/studio/document";
import { withMotionBlur } from "@/lib/studio/blurred-plan";
import { previewBlurScale, previewScale } from "@/lib/studio/preview-quality";
import type { FramePlacement } from "@/lib/studio/viewport";
import { focusedPlan, PREMOUNT_MS, visualPlan } from "@/lib/studio/playback";
import { frameCamera } from "@/lib/studio/render/renderer";
import { videoSources } from "@/lib/studio/scene/scene";
import { videoScene, withChromaView, withTransparencyGrid } from "@/lib/studio/scene/video-scene";

import { useVideoEditor, useViewState } from "../editor-context";
import { previewPlacement } from "./preview-placement";
import { withoutEditedText } from "./text-edit-overlay";
import { reactLevels } from "../react-levels";

export function GpuStage({ placement, onUnavailable }: { placement: FramePlacement; onUnavailable: () => void }) {
  const { store, view, assets, playback } = useVideoEditor();
  const canvas = useRef<HTMLCanvasElement>(null);
  const telemetry = useStudioTelemetry();
  const grid = useViewState((s) => s.transparencyGrid);
  const quality = useViewState((s) => previewScale(s.previewQuality, s.playing));

  const setup = useCallback(
    (schedule: () => void): GpuSession => {
      const feed = new VideoFeed(
        new DecodedVideos(openMediaWorker(), loadMediaFile, assets.previewOf, schedule, {
          undecodable: () => telemetry?.decodeFallback(),
          broken: () => telemetry?.workerFailed(),
        }),
        new VideoPool((assetId) => loadMediaFile(assets.previewOf(assetId)), () => window.document.createElement("video"), schedule),
      );
      const unsubscribe = [store.subscribe(schedule), view.subscribe(schedule), reactLevels.subscribe(schedule)];
      return {
        sources: studioRenderSources(feed),
        frame: (renderer) => {
          const doc = store.getState().document;
          const state = view.getState();
          const playheadMs = state.playing ? playback.position() : state.playheadMs;
          const size = videoCanvasSize(doc);
          const placed = previewPlacement(state, size);
          reactLevels.request(doc);
          const levels = reactLevels.current(doc);
          const plan = withoutEditedText(visualPlan(doc, playheadMs, PREMOUNT_MS, levels), state.editingTextClipId);
          const blurScale = placed ? previewBlurScale({ frameWidth: placed.frame.width, canvasWidth: size.width, resolution: deviceResolution() * previewScale(state.previewQuality, state.playing), scrubbing: state.scrubbing, blurWhileScrubbing: state.blurWhileScrubbing }) : null;
          const shown = blurScale === null ? plan : withMotionBlur(doc, plan, playheadMs, blurScale, levels);
          const scene = withTransparencyGrid(withChromaView(videoScene(doc, focusedPlan(shown, state.focus?.clipId ?? null, Boolean(state.focus?.solo))), state.chromaView), grid);
          feed.sync(videoSources(scene), { playing: state.playing, rate: state.rate });
          if (placed) renderer.render([scene], frameCamera(scene, placed));
          return state.playing;
        },
        dispose: () => {
          for (const stop of unsubscribe) stop();
          feed.dispose();
        },
      };
    },
    [store, view, assets, playback, telemetry, grid],
  );

  useGpuRenderer({
    canvas,
    viewport: { width: Math.max(1, placement.visible.width), height: Math.max(1, placement.visible.height), resolution: deviceResolution() * quality },
    transparent: grid,
    onUnavailable,
    setup,
    telemetry,
  });

  const { left, top, width, height } = placement.visible;
  return <canvas ref={canvas} aria-hidden data-preview-canvas className="pointer-events-none absolute block" style={{ zIndex: 1, left, top, width, height }} />;
}
