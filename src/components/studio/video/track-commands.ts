import { planTrack } from "@/lib/studio/agent/track-ops";
import { newStudioId, type VideoDocument } from "@/lib/studio/document";
import { DEFAULT_TRACK_SIZE, trackerOf } from "@/lib/studio/point-track";
import type { PathPoint } from "@/lib/studio/position-path";
import type { StudioEditorStore } from "@/lib/studio/store";
import { findClip } from "@/lib/studio/timeline";
import { attachToTracker, putTracker, removeTracker, stabilizeClip, unstabilizeClip, type AttachMode, type StabilizeRequest, type TrackEdit } from "@/lib/studio/track-edit";
import { trackerFromOutcome, type TrackOutcome } from "@/lib/studio/tracking/track-outcome";
import type { TrackDirection } from "@/lib/studio/tracking/track-run";

import { trackAssetPoint, type TrackWatch } from "../media/point-tracker";
import type { NoticeTone, TrackTool, VideoViewStore } from "./view-store";

export interface TrackCommands {
  startTracking: (clipId: string, trackerId?: string) => void;
  aimTracking: (point: PathPoint, size: number) => void;
  setTrackDirection: (direction: TrackDirection) => void;
  runTracking: () => Promise<boolean>;
  cancelTracking: () => void;
  keepLostTrack: () => boolean;
  removeTracker: (clipId: string, trackerId: string) => boolean;
  attachToTracker: (clipIds: readonly string[], videoId: string, trackerId: string, mode: AttachMode, keepVisual: boolean) => boolean;
  stabilizeClip: (clipId: string, request: StabilizeRequest) => boolean;
  unstabilizeClip: (clipId: string) => boolean;
}

export type PointTrackRunner = (assetId: string, request: Parameters<typeof trackAssetPoint>[1], watch: TrackWatch) => Promise<TrackOutcome>;

interface TrackCommandDeps {
  store: StudioEditorStore<VideoDocument>;
  view: VideoViewStore;
  notify: (key: string, tone?: NoticeTone) => void;
  track?: PointTrackRunner;
}

export function createTrackCommands({ store, view, notify, track = trackAssetPoint }: TrackCommandDeps): TrackCommands {
  const state = () => store.getState();
  const tool = () => view.getState().trackTool;
  const patchTool = (patch: Partial<TrackTool>) => {
    const current = tool();
    if (current) view.setState({ trackTool: { ...current, ...patch } });
  };
  let running: AbortController | null = null;

  const edited = (edit: TrackEdit): boolean => {
    if (!edit.ok) {
      notify(`tracking.${edit.reason}`, "error");
      return false;
    }
    if (edit.document !== state().document) state().apply(() => edit.document);
    return true;
  };

  const keep = (outcome: TrackOutcome, keepPartial: boolean): boolean => {
    const current = tool();
    if (!current) return false;
    const clip = findClip(state().document, current.clipId)?.clip;
    const name = clip ? trackerOf(clip, current.trackerId)?.name : undefined;
    const result = trackerFromOutcome(outcome, { id: current.trackerId ?? newStudioId("pt"), name, keepPartial });
    if (!result.ok) {
      if (result.reason === "lost") {
        patchTool({ progress: null, pending: outcome });
        notify("tracking.lost", "error");
      } else {
        patchTool({ progress: null, pending: null });
        notify(`tracking.${result.reason}`, result.reason === "cancelled" ? "info" : "error");
      }
      return false;
    }
    const done = edited(putTracker(state().document, current.clipId, result.tracker));
    if (done) view.setState({ trackTool: null });
    else patchTool({ progress: null, pending: null });
    return done;
  };

  return {
    startTracking: (clipId, trackerId) => {
      running?.abort();
      view.setState({ trackTool: { clipId, trackerId, point: null, size: DEFAULT_TRACK_SIZE, direction: "both", progress: null, pending: null } });
    },
    aimTracking: (point, size) => {
      if (tool()?.progress === null) patchTool({ point, size, pending: null });
    },
    setTrackDirection: (direction) => patchTool({ direction }),
    runTracking: async () => {
      const current = tool();
      if (!current || current.progress !== null) return false;
      const plan = planTrack(state().document, { clipId: current.clipId, point: current.point ?? undefined, size: current.size, atMs: view.getState().playheadMs, direction: current.direction });
      if (typeof plan === "string") {
        notify(`tracking.${plan}`, "error");
        return false;
      }
      const controller = new AbortController();
      running = controller;
      patchTool({ progress: 0, pending: null });
      const outcome = await track(plan.assetId, plan.request, { signal: controller.signal, onProgress: (done) => patchTool({ progress: done }) });
      if (running === controller) running = null;
      if (tool()?.clipId !== current.clipId) return false;
      return keep(outcome, false);
    },
    cancelTracking: () => {
      if (running) {
        running.abort();
        running = null;
        return;
      }
      view.setState({ trackTool: null });
    },
    keepLostTrack: () => {
      const pending = tool()?.pending;
      return pending ? keep(pending, true) : false;
    },
    removeTracker: (clipId, trackerId) => edited(removeTracker(state().document, clipId, trackerId)),
    attachToTracker: (clipIds, videoId, trackerId, mode, keepVisual) => edited(attachToTracker(state().document, clipIds, videoId, trackerId, { mode, keepVisual, atMs: view.getState().playheadMs })),
    stabilizeClip: (clipId, request) => edited(stabilizeClip(state().document, clipId, request)),
    unstabilizeClip: (clipId) => edited(unstabilizeClip(state().document, clipId)),
  };
}
