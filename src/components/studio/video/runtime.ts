"use client";

import type { VideoDocument } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

import { createAssetCatalog } from "./asset-catalog";
import { AudioEngine } from "./audio-engine";
import { createEditorCommands } from "./editor-commands";
import type { VideoEditorContextValue } from "./editor-context";
import { PlaybackController } from "./playback-controller";
import { FrameExtractor } from "./timeline/frame-extractor";
import { createVideoViewStore } from "./view-store";

export type VideoEditorRuntime = Omit<VideoEditorContextValue, "projectId" | "studio">;

export function createVideoEditorRuntime(document: VideoDocument): VideoEditorRuntime {
  const store = createStudioStore<VideoDocument>(document);
  const view = createVideoViewStore();
  const assets = createAssetCatalog();
  const audio = new AudioEngine();
  const playback = new PlaybackController(view, audio, () => store.getState().document);
  const commands = createEditorCommands({ store, view, assets, playback });
  return { store, view, assets, audio, playback, commands, frames: new FrameExtractor(1) };
}
