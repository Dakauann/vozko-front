"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { getMediaGenerationAction, requestMediaGenerationAction } from "@/app/actions/media-generation";
import TourGuide from "@/components/TourGuide";
import { useScreenTurnEnd } from "@/components/ai-chat/screen-bridge";
import { useStudioAgent, useStudioAgentKit } from "@/components/studio/agent/use-studio-agent";
import { StoreGestures } from "@/components/studio/canvas/live-gesture";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { StudioEditorMountProps } from "@/components/studio/studio-editor-shell";
import { studioVideoTourPalette, studioVideoTourSeed, studioVideoTourSteps } from "@/data/tour-studio-video";
import { bindKeymap } from "@/lib/keyboard/stroke";
import { videoActionFor, type VideoAction } from "@/lib/studio/keymap";
import { videoAssetIds } from "@/lib/studio/media-clips";
import { previewZoomActionFor, videoExtraActionFor, type PreviewZoomAction, type VideoExtraAction } from "@/lib/studio/video-shortcuts";

import { AgentFollower } from "./agent-follow";
import type { EditorCommands } from "./editor-commands";
import { VideoEditorContext, type VideoEditorContextValue } from "./editor-context";
import { EditorToolbar } from "./editor-toolbar";
import { Inspector } from "./inspector/inspector";
import { VideoAgentCursor, VideoJobFollowers } from "./jobs";
import { EditorNotice } from "./editor-notice";
import { exportLocally } from "./export/browser-export";
import { lutReadable } from "../canvas/lut-files";
import { createExportState, createVideoExporter } from "./export/video-exporter";
import { VideoExportContext } from "./use-video-export";
import { useStudioTelemetry } from "../telemetry/studio-telemetry";
import { SidePanel } from "./panels/side-panel";
import { Preview } from "./preview/preview";
import { KeyframeDialogs } from "./timeline/keyframe-dialogs";
import { Timeline } from "./timeline/timeline";
import { bindPaste } from "./paste-handler";
import { browserFrames } from "./playback-controller";
import { ProxyQueue } from "./proxy-queue";
import { createVideoEditorRuntime } from "./runtime";
import { createVideoAgent, createVideoReveal } from "./video-agent";

type VideoEditorProps = StudioEditorMountProps<"video">;

function runExtraAction(action: VideoExtraAction, commands: EditorCommands) {
  switch (action.type) {
    case "addMarker":
      return commands.addMarker();
    case "addClipMarker":
      return commands.addClipMarker();
    case "nudgeKeysOrJumpMarker":
      return commands.nudgeKeysOrJumpMarker(action.direction, action.frames);
    case "easeSides":
      return commands.easeSides(action.sides);
    case "keyVelocity":
      return commands.openKeyDialog("velocity");
    case "jumpKey":
      return commands.jumpKey(action.direction);
    case "toggleKey":
      return commands.toggleKey();
    case "easeKeys":
      return commands.easeKeys(action.easing);
    case "tool":
      return commands.setTool(action.tool);
    case "cycleTrim":
      return commands.cycleTrimTool();
    case "rollToPlayhead":
      return commands.rollToPlayhead(action.edge);
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
    case "playRange":
      return commands.playRange();
    case "toggleLoop":
      return commands.toggleLoop();
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
    case "toggleGraph":
      return commands.toggleGraph();
    case "fitGraph":
      return commands.fitGraph(action.selection);
    case "group":
      return commands.groupSelection();
    case "ungroup":
      return commands.ungroupSelection();
    case "openGroup":
      return commands.openSelection();
    case "closeGroup":
      return commands.closeGroup();
    case "escape":
      return commands.escape();
    case "trimToPlayhead":
      return commands.trimToPlayhead(action.edge, action.ripple);
    case "moveToPlayhead":
      return commands.moveToPlayhead(action.edge);
    case "align":
      return commands.alignSelection(action.alignment);
    case "distribute":
      return commands.distributeSelection(action.axis);
  }
}

function runPreviewZoom(action: PreviewZoomAction, commands: EditorCommands) {
  if (action.type === "fit") return commands.fitPreview();
  if (action.type === "actualSize") return commands.zoomPreview(1);
  commands.stepPreviewZoom(action.direction);
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
  const { root, store, clock, playback, audio, assets, commands, studio, frames, meters } = value;
  const studioRef = useRef(studio);
  const valueRef = useRef(value);
  const kit = useStudioAgentKit();
  const captionTrackName = useTranslations("studio.video.captions")("trackName");
  const { view } = value;
  const [follower] = useState(() => new AgentFollower({ view, seek: (ms) => playback.seek(ms), frames: browserFrames, now: () => performance.now(), reduceMotion: kit.reduceMotion }));
  useEffect(() => follower.attach(), [follower]);
  useScreenTurnEnd(useCallback(() => follower.resume(), [follower]));
  const telemetry = useStudioTelemetry();
  const [exportState] = useState(createExportState);
  const { flush, committed } = studio;
  const projectId = props.project.id;
  const exporter = useMemo(
    () =>
      createVideoExporter(
        {
          document: () => root.getState().document,
          commit: () => root.getState().commitTransaction(),
          flush,
          committed,
          lutReadable,
          local: async (document, request, onPhase) => {
            const local = await exportLocally(projectId, document, request, onPhase);
            if (local.status === "done") telemetry?.exported();
            else telemetry?.exportFailed(local.reason);
            return local;
          },
          refreshLibrary: () => void assets.loadLibrary(),
        },
        exportState,
      ),
    [exportState, root, assets, flush, committed, telemetry, projectId],
  );
  const agent = useMemo(
    () => createVideoAgent({ editor: { root, store: root, view, clock, assets, audio, playback, commands, frames, meters }, exporter, presence: kit.presence, follower, captionTrackName, label: kit.label, reduceMotion: kit.reduceMotion, library: kit.library }),
    [root, view, clock, assets, audio, playback, commands, frames, meters, exporter, kit, follower, captionTrackName],
  );
  const reveal = useMemo(() => createVideoReveal({ view, commands, playback }), [view, commands, playback]);
  useStudioAgent(props.project.id, "video", studio.name ?? props.project.name, agent, reveal);
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
    const sync = () => proxies.want(videoAssetIds(root.getState().document));
    sync();
    const stop = root.subscribe(sync);
    return () => {
      stop();
      proxies.dispose();
    };
  }, [root, assets]);

  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.document !== previous.document) playback.documentChanged();
      }),
    [store, playback],
  );

  useEffect(() => {
    let saved = root.getState().document;
    return root.subscribe((state) => {
      if (state.inTransaction || state.document === saved) return;
      saved = state.document;
      studioRef.current.edit({ document: state.document });
    });
  }, [root]);

  useEffect(
    () =>
      bindKeymap(window, videoActionFor, (action) => runAction(action, valueRef.current, commands)),
    [commands],
  );

  useEffect(() => bindPaste(commands), [commands]);

  useEffect(() => bindKeymap(window, previewZoomActionFor, (action) => runPreviewZoom(action, commands)), [commands]);

  useEffect(
    () =>
      bindKeymap(window, videoExtraActionFor, (action) => runExtraAction(action, commands)),
    [commands],
  );

  useEffect(
    () => () => {
      playback.dispose();
      audio.dispose();
      frames.dispose();
      meters.dispose();
    },
    [playback, audio, frames, meters],
  );

  return (
    <VideoEditorContext.Provider value={value}>
      <VideoExportContext.Provider value={exporter}>
      <StoreGestures store={value.store}>
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
        <KeyframeDialogs />
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
      </StoreGestures>
      </VideoExportContext.Provider>
    </VideoEditorContext.Provider>
  );
}
