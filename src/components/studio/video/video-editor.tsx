"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { getMediaGenerationAction, requestMediaGenerationAction } from "@/app/actions/media-generation";
import TourGuide from "@/components/TourGuide";
import { useScreenTurnEnd } from "@/components/ai-chat/screen-bridge";
import { useStudioAgent, useStudioAgentKit } from "@/components/studio/agent/use-studio-agent";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { StudioEditorMountProps } from "@/components/studio/studio-editor-shell";
import { studioVideoTourPalette, studioVideoTourSeed, studioVideoTourSteps } from "@/data/tour-studio-video";
import { bindKeymap, videoActionFor, type VideoAction } from "@/lib/studio/keymap";
import { videoAssetIds } from "@/lib/studio/media-clips";
import { videoExtraActionFor, type VideoExtraAction } from "@/lib/studio/video-shortcuts";

import { AgentFollower } from "./agent-follow";
import type { EditorCommands } from "./editor-commands";
import { VideoEditorContext, type VideoEditorContextValue } from "./editor-context";
import { EditorToolbar } from "./editor-toolbar";
import { Inspector } from "./inspector/inspector";
import { VideoAgentCursor, VideoJobFollowers } from "./jobs";
import { EditorNotice } from "./editor-notice";
import { SidePanel } from "./panels/side-panel";
import { Preview } from "./preview/preview";
import { Timeline } from "./timeline/timeline";
import { bindPaste } from "./paste-handler";
import { browserFrames } from "./playback-controller";
import { ProxyQueue } from "./proxy-queue";
import { createVideoEditorRuntime } from "./runtime";
import { createVideoAgent } from "./video-agent";

export type VideoEditorProps = StudioEditorMountProps<"video">;

function runExtraAction(action: VideoExtraAction, commands: EditorCommands) {
  switch (action.type) {
    case "addMarker":
      return commands.addMarker();
    case "jumpMarker":
      return commands.jumpMarker(action.direction);
    case "jumpKey":
      return commands.jumpKey(action.direction);
    case "toggleKey":
      return commands.toggleKey();
    case "tool":
      return commands.setTool(action.tool);
    case "cycleTrim":
      return commands.cycleTrimTool();
    case "selectForward":
      return commands.selectForward(null, action.allTracks);
    case "selectFromPlayhead":
      return commands.selectFromPlayhead(action.direction);
    case "markIn":
      return commands.markIn();
    case "markOut":
      return commands.markOut();
    case "clearRange":
      return commands.clearRange();
    case "lift":
      return commands.lift();
    case "extract":
      return commands.extract();
    case "copy":
      return commands.copy();
    case "cut":
      return commands.cut();
    case "nudge":
      return commands.nudge(action.frames);
    case "toggleDisabled":
      return commands.toggleDisabled();
    case "cutAll":
      return commands.cutAllAtPlayhead();
    case "zoomToFit":
      return commands.zoomToFit();
    case "focus":
      return commands.enterFocus();
    case "escape":
      return commands.escape();
  }
}

function runAction(action: VideoAction, value: VideoEditorContextValue, commands: EditorCommands) {
  const { playback } = value;
  switch (action.type) {
    case "undo":
      return commands.undo();
    case "redo":
      return commands.redo();
    case "togglePlay":
      return playback.toggle();
    case "shuttle":
      return playback.shuttle(action.direction);
    case "stepFrames":
      playback.pause();
      return playback.stepFrames(action.frames);
    case "stepMs":
      playback.pause();
      return playback.seek(value.view.getState().playheadMs + action.ms);
    case "seekStart":
      return playback.seek(0);
    case "seekEnd":
      return playback.seek(value.store.getState().document.durationMs);
    case "split":
      return commands.split();
    case "delete":
      return commands.remove(false);
    case "rippleDelete":
      return commands.remove(true);
    case "duplicate":
      return commands.duplicate();
    case "zoom":
      return commands.zoom(action.direction);
    case "toggleSnapping":
      return commands.toggleSnapping();
  }
}

function useEditorRuntime({ project, studio }: VideoEditorProps): VideoEditorContextValue {
  const [runtime] = useState(() => createVideoEditorRuntime(project.document));
  return useMemo(() => ({ ...runtime, projectId: project.id, studio }), [runtime, project.id, studio]);
}

export function VideoEditor(props: VideoEditorProps) {
  const value = useEditorRuntime(props);
  const { store, clock, playback, audio, assets, commands, studio, frames } = value;
  const studioRef = useRef(studio);
  const valueRef = useRef(value);
  const kit = useStudioAgentKit();
  const captionTrackName = useTranslations("studio.video.captions")("trackName");
  const { view } = value;
  const [follower] = useState(() => new AgentFollower({ view, seek: (ms) => playback.seek(ms), frames: browserFrames, now: () => performance.now(), reduceMotion: kit.reduceMotion }));
  useEffect(() => follower.attach(), [follower]);
  useScreenTurnEnd(useCallback(() => follower.resume(), [follower]));
  const agent = useMemo(
    () => createVideoAgent({ editor: { store, view, clock, assets, audio, playback, commands, frames }, presence: kit.presence, follower, captionTrackName, label: kit.label, reduceMotion: kit.reduceMotion }),
    [store, view, clock, assets, audio, playback, commands, frames, kit, follower, captionTrackName],
  );
  useStudioAgent(props.project.id, "video", studio.name ?? props.project.name, agent);
  const { presence } = kit;

  useEffect(() => {
    studioRef.current = studio;
    valueRef.current = value;
  }, [studio, value]);

  useEffect(() => {
    void assets.loadLibrary();
  }, [assets]);

  useEffect(() => {
    const proxies = new ProxyQueue({ request: requestMediaGenerationAction, get: getMediaGenerationAction, wait: (ms) => new Promise((done) => setTimeout(done, ms)), onReady: assets.rememberProxy });
    const sync = () => proxies.want(videoAssetIds(store.getState().document));
    sync();
    const stop = store.subscribe(sync);
    return () => {
      stop();
      proxies.dispose();
    };
  }, [store, assets]);

  useEffect(() => {
    let saved = store.getState().document;
    return store.subscribe((state, previous) => {
      if (state.document !== previous.document) playback.documentChanged();
      if (state.inTransaction || state.document === saved) return;
      saved = state.document;
      studioRef.current.edit({ document: state.document });
    });
  }, [store, playback]);

  useEffect(
    () =>
      bindKeymap(window, videoActionFor, (action) => {
        if (!presence.isBusy()) runAction(action, valueRef.current, commands);
      }),
    [commands, presence],
  );

  useEffect(() => bindPaste(commands), [commands]);

  useEffect(
    () =>
      bindKeymap(window, videoExtraActionFor, (action) => {
        if (!presence.isBusy()) runExtraAction(action, commands);
      }),
    [commands, presence],
  );

  useEffect(
    () => () => {
      playback.dispose();
      audio.dispose();
      frames.dispose();
    },
    [playback, audio, frames],
  );

  return (
    <VideoEditorContext.Provider value={value}>
      <div className="flex h-full min-h-0 flex-col bg-background">
        <EditorToolbar />
        <ResizablePanelGroup direction="vertical" autoSaveId="studio-video-rows" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={62} minSize={30} className="min-h-0">
            <ResizablePanelGroup direction="horizontal" autoSaveId="studio-video-columns">
              <ResizablePanel defaultSize={22} minSize={16} maxSize={36} className="min-w-0">
                <SidePanel />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={56} minSize={30} className="min-w-0">
                <Preview />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={22} minSize={15} maxSize={34} className="min-w-0">
                <Inspector />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={38} minSize={18} maxSize={70} className="min-h-0">
            <Timeline />
          </ResizablePanel>
        </ResizablePanelGroup>
        <EditorNotice />
      </div>
      <VideoJobFollowers />
      <VideoAgentCursor presence={presence} />
      <TourGuide
        steps={studioVideoTourSteps}
        storageKey="tour_dismissed_studio_video"
        i18nNamespace="tourStudioVideo"
        introPalette={studioVideoTourPalette}
        introSeed={studioVideoTourSeed}
      />
    </VideoEditorContext.Provider>
  );
}
