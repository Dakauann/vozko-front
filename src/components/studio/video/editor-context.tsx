"use client";

import { createContext, useContext } from "react";
import { useStore } from "zustand";

import type { StudioProjectHandle } from "@/hooks/use-studio-project";
import type { VideoDocument } from "@/lib/studio/document";
import type { StudioEditorState, StudioEditorStore } from "@/lib/studio/store";

import type { AssetCatalog, AssetCatalogState } from "./asset-catalog";
import type { AudioEngine } from "./audio-engine";
import type { EditorCommands } from "./editor-commands";
import type { PanelClock } from "./panel-clock";
import type { FrameExtractor } from "./timeline/frame-extractor";
import type { PlaybackController } from "./playback-controller";
import type { VideoViewState, VideoViewStore } from "./view-store";

export interface VideoEditorContextValue {
  projectId: string;
  store: StudioEditorStore<VideoDocument>;
  view: VideoViewStore;
  clock: PanelClock;
  assets: AssetCatalog;
  audio: AudioEngine;
  playback: PlaybackController;
  studio: StudioProjectHandle<"video">;
  commands: EditorCommands;
  frames: FrameExtractor;
}

export const VideoEditorContext = createContext<VideoEditorContextValue | null>(null);

export function useVideoEditor(): VideoEditorContextValue {
  const value = useContext(VideoEditorContext);
  if (!value) throw new Error("useVideoEditor must be used inside the video editor");
  return value;
}

export function useEditorState<T>(selector: (state: StudioEditorState<VideoDocument>) => T): T {
  return useStore(useVideoEditor().store, selector);
}

export function useViewState<T>(selector: (state: VideoViewState) => T): T {
  return useStore(useVideoEditor().view, selector);
}

export function usePanelPlayhead(): number {
  return useStore(useVideoEditor().clock, (s) => s.playheadMs);
}

export function useAssetState<T>(selector: (state: AssetCatalogState) => T): T {
  return useStore(useVideoEditor().assets.store, selector);
}
