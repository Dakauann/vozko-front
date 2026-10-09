"use client";

import { requestMediaGenerationAction } from "@/app/actions/media-generation";
import { loadMediaFile } from "@/components/studio/canvas/media-files";
import { DecodedStills } from "@/components/studio/media/decoded-stills";
import { openMediaWorker } from "@/components/studio/media/media-worker";
import { ElementStills } from "@/components/studio/media/stills";
import type { VideoDocument } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

import { createAssetCatalog } from "./asset-catalog";
import { AudioEngine } from "./audio-engine";
import { createEditorCommands } from "./editor-commands";
import { createPanelClock } from "./panel-clock";
import type { VideoEditorContextValue } from "./editor-context";
import { PlaybackController } from "./playback-controller";
import { FrameExtractor } from "./timeline/frame-extractor";
import { createVideoViewStore } from "./view-store";

export type VideoEditorRuntime = Omit<VideoEditorContextValue, "projectId" | "studio">;

export function createVideoEditorRuntime(document: VideoDocument): VideoEditorRuntime {
  const store = createStudioStore<VideoDocument>(document);
  const view = createVideoViewStore();
  const assets = createAssetCatalog();
  const audio = new AudioEngine(assets.previewOf);
  const playback = new PlaybackController(view, audio, () => store.getState().document);
  const commands = createEditorCommands({ store, view, assets, playback, requestJob: requestMediaGenerationAction });
  const frames = new FrameExtractor(1, assets.previewOf, new DecodedStills(openMediaWorker, new ElementStills(), loadMediaFile));
  return { store, view, clock: createPanelClock(view), assets, audio, playback, commands, frames };
}
