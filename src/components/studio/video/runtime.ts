"use client";

import { requestMediaGenerationAction } from "@/app/actions/media-generation";
import { loadMediaFile } from "@/components/studio/canvas/media-files";
import { DecodedStills } from "@/components/studio/media/decoded-stills";
import { openMediaWorker } from "@/components/studio/media/media-worker";
import { ElementStills } from "@/components/studio/media/stills";
import type { VideoDocument } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";
import { scopedStore } from "@/lib/studio/scoped-store";
import { validPath } from "@/lib/studio/group-scope";

import { createAssetCatalog } from "./asset-catalog";
import { AudioEngine } from "./audio-engine";
import { createEditorCommands } from "./editor-commands";
import { createPanelClock } from "./panel-clock";
import type { VideoEditorContextValue } from "./editor-context";
import { MeterHub } from "./meter-hub";
import { browserFrames, PlaybackController } from "./playback-controller";
import { FrameExtractor } from "./timeline/frame-extractor";
import { createVideoViewStore } from "./view-store";

export type VideoEditorRuntime = Omit<VideoEditorContextValue, "projectId" | "studio">;

export function createVideoEditorRuntime(document: VideoDocument): VideoEditorRuntime {
  const root = createStudioStore<VideoDocument>(document);
  const view = createVideoViewStore();
  const store = scopedStore(root, { path: () => view.getState().groupPath, subscribe: (listener) => view.subscribe((state, previous) => state.groupPath !== previous.groupPath && listener()) });
  root.subscribe((state, previous) => {
    if (state.document === previous.document) return;
    const { groupPath } = view.getState();
    const kept = validPath(state.document, groupPath);
    if (kept.length !== groupPath.length) view.setState({ groupPath: [...kept] });
  });
  const assets = createAssetCatalog();
  const audio = new AudioEngine(assets.previewOf);
  const playback = new PlaybackController(view, audio, () => store.getState().document);
  const commands = createEditorCommands({ store, root, view, assets, playback, audio, requestJob: requestMediaGenerationAction });
  const frames = new FrameExtractor(1, assets.previewOf, new DecodedStills(openMediaWorker, new ElementStills(), loadMediaFile));
  const meters = new MeterHub({ read: () => audio.meters(), playing: () => view.getState().playing, frames: browserFrames, now: () => performance.now() });
  view.subscribe((state, previous) => {
    if (!state.playing || previous.playing) return;
    meters.clearClips();
    meters.wake();
  });
  return { root, store, view, clock: createPanelClock(view), assets, audio, playback, commands, frames, meters };
}
