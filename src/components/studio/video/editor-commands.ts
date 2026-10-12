"use client";

import { isActionError, type ActionResult } from "@/app/actions/action-result";
import { uploadMediaAction } from "@/app/actions/medias";
import type { MediaGenerationError } from "@/hooks/use-media-generation";
import { canStart, KEPT_FINISHED_JOBS } from "@/lib/media-generation/limits";
import type { MediaGenerationInput, MediaGenerationJob } from "@/lib/media-generation/types";
import { jobStartAsset } from "@/lib/studio/job-landing";
import { asUploadableImage } from "@/components/studio/canvas/uploadable-image";
import type { Media } from "@/lib/medias/types";
import { encodeClipboard } from "@/lib/studio/clip-clipboard";
import { canvasAspect, msOfFrame, newStudioId, videoCanvasSize, type Clip, type Track, type Transform, type VideoAspect, type VideoDocument } from "@/lib/studio/document";
import { clipUnder, nearestEdge, rollCut, slideClip, type TrimEdge, type TrimEdit } from "@/lib/studio/trim-edits";
import { adjacentKey, keyTimes, localTime, setMomentEasing } from "@/lib/studio/keyframe-edit";
import type { AnimatedProperty, Easing } from "@/lib/studio/keyframes";
import { placedPatch, toggleSelectionMoment } from "@/lib/studio/selection-edit";
import { childIds, clipLookup } from "@/lib/studio/parenting";
import { setParents } from "@/lib/studio/parent-edit";
import { insertVideoClips } from "@/lib/studio/library/instantiate";
import { addBehavior, bakeBehavior, defaultReactTrack, draftBehavior, randomBehaviorSeed, removeBehavior, updateBehavior, type BehaviorSettings } from "@/lib/studio/behavior-edit";
import { NO_LEVELS, type BehaviorKind, type BehaviorProperty } from "@/lib/studio/behaviors";
import { hasSourceTime } from "@/lib/studio/clip-time";
import { closeGaps, duplicateGroup, linkClips, linkGroup, magnetize, splitAt, unlinkClips, withLinked } from "@/lib/studio/edits";
import { freezeFrame, rampSpeed, retimeClip, type RampRequest, type RetimeRequest, type RetimeResult } from "@/lib/studio/retime";
import { clearSpeedCurve, setSpeedCurve, smoothRamp, type SpeedCurveRequest } from "@/lib/studio/speed-curve";
import { bakeDucking, duckingIssue, trackGainIssue, withDucking, type DuckingRule } from "@/lib/studio/ducking";
import { easeKeys, propertyKeys, removeKeys } from "@/lib/studio/focus-lanes";
import { addMarker, adjacentMarker, removeMarker } from "@/lib/studio/markers";
import { addClipMarker } from "@/lib/studio/clip-marker-edits";
import { clipTypeForMedia, mediaClips, sizedMediaClips } from "@/lib/studio/media-clips";
import type { StudioEditorStore } from "@/lib/studio/store";
import { clipEnd, clipsAt, contentDuration, deleteClips, findClip, isClipPickable, placeClips, rippleDeleteClips, updateClip, updateTrack, type ClipPatch, type TrackPatch } from "@/lib/studio/timeline";
import { findTransition, removeTransition, type TransitionEdit } from "@/lib/studio/transitions";
import { freshVfx, type VfxKind } from "@/lib/studio/vfx";
import { loudnessAssetIds, normalizeLoudness, type NormalizeOutcome, type NormalizeTarget } from "@/lib/studio/loudness";
import { trackPanIssue } from "@/lib/studio/audio-pan";
import { addEffectClip } from "@/lib/studio/vfx-edit";
import { shutterIssue, type ShutterChange } from "@/lib/studio/motion-blur";
import { perspectiveChange } from "@/lib/studio/clip-tilt";

import { fitZoom, focusView, toggledSelection, zoomBy } from "@/lib/studio/timeline-view";
import {
  blade,
  closeGap,
  copyClips,
  extractRange,
  liftRange,
  nudgeClips,
  pasteClips,
  relinkClips,
  selectForward,
  selectFromPlayhead,
  toggleDisabled,
  type ClipboardPayload,
  type Gap,
} from "@/lib/studio/tools";

import type { AssetCatalog } from "./asset-catalog";
import type { AudioEngine } from "./audio-engine";
import { speechOfTriggers } from "./speech-analysis";
import { reactLevels } from "./react-levels";
import { createGraphCommands, type GraphCommands } from "./graph-commands";
import { createKeyCommands, type KeyCommands } from "./key-commands";
import { createLayoutCommands, type LayoutCommands } from "./layout-commands";
import { createTrackCommands, type TrackCommands } from "./track-commands";
import { createGroupCommands, type GroupCommands } from "./group-commands";
import { createTextEditCommands, type TextEditCommands } from "./text-edit-commands";
import { sourceLengthOf } from "@/lib/studio/group-scope";
import type { PlaybackController } from "./playback-controller";
import type { PreviewQuality } from "@/lib/studio/preview-quality";
import { workArea } from "@/lib/studio/work-area";
import { fitViewport, stepZoom, zoomAtCenter } from "@/lib/studio/viewport";
import { TRIM_TOOLS, type NoticeTone, type TimelineTool, type TrackHeight, type VideoJob, type VideoJobPurpose, type VideoJobTarget, type VideoViewStore } from "./view-store";

export interface EditorCommands extends KeyCommands, LayoutCommands, GraphCommands, GroupCommands, TrackCommands, TextEditCommands {
  undo: () => void;
  redo: () => void;
  apply: (operation: (doc: VideoDocument) => VideoDocument, nextSelection?: string[]) => void;
  selectClip: (clipId: string, additive: boolean) => void;
  selectClips: (ids: string[]) => void;
  selectTransition: (transitionId: string | null) => void;
  editTransition: (edit: (doc: VideoDocument) => TransitionEdit) => boolean;
  retime: (request: RetimeRequest) => boolean;
  freezeFrame: (durationMs?: number) => boolean;
  setTrackGain: (trackId: string, gainDb: number) => boolean;
  setTrackPan: (trackId: string, pan: number) => boolean;
  setTrackMuted: (trackId: string, muted: boolean) => boolean;
  normalize: (target: NormalizeTarget, targetLufs: number) => Promise<NormalizeOutcome>;
  setDucking: (trackId: string, change: Partial<DuckingRule> | null) => boolean;
  bakeDucking: (trackId: string) => Promise<boolean>;
  rampSpeed: (ramp: Omit<RampRequest, "atMs">, smooth: boolean) => boolean;
  setSpeedCurve: (clipId: string, request: SpeedCurveRequest) => boolean;
  clearSpeedCurve: (clipId: string) => boolean;
  setFrameMix: (on: boolean) => boolean;
  split: () => void;
  remove: (ripple: boolean) => void;
  duplicate: () => void;
  link: () => void;
  unlink: () => void;
  insertMedia: (media: Pick<Media, "id" | "type">, atMs?: number, preferTrackId?: string, durationMs?: number) => Promise<boolean>;
  startJob: (purpose: VideoJobPurpose, input: MediaGenerationInput, target: VideoJobTarget) => Promise<void>;
  followJob: (purpose: VideoJobPurpose, job: MediaGenerationJob, target: VideoJobTarget) => string;
  jobProgress: (id: string, settling: boolean) => void;
  jobFailed: (id: string, error: MediaGenerationError) => void;
  jobFinished: (id: string) => void;
  dismissJob: (id: string) => void;
  insertClips: (clips: Clip[], preferTrackId?: string) => boolean;
  insertLibrary: (clips: Clip[], trackId?: string) => boolean;
  insertEffect: (kind: VfxKind | null) => boolean;
  setParent: (clipIds: readonly string[], parentId: string | null, keepVisual: boolean) => boolean;
  addBehavior: (clipId: string, kind: BehaviorKind, property: BehaviorProperty) => string | null;
  updateBehavior: (clipId: string, behaviorId: string, settings: BehaviorSettings) => boolean;
  removeBehavior: (clipId: string, behaviorId: string) => boolean;
  bakeBehavior: (clipId: string, behaviorId: string) => Promise<boolean>;
  selectChildren: (clipId: string) => void;
  addMarker: () => void;
  addClipMarker: () => void;
  toggleGuide: () => void;
  removeMarker: (markerId: string) => void;
  jumpMarker: (direction: 1 | -1) => void;
  setAspect: (aspect: VideoAspect) => void;
  setBackground: (color: string) => void;
  setShutter: (change: ShutterChange) => void;
  setPerspective: (perspective: number) => void;
  setScrubbing: (scrubbing: boolean) => void;
  toggleBlurWhileScrubbing: () => void;
  zoom: (direction: 1 | -1) => void;
  toggleSnapping: () => void;
  toggleSafeArea: () => void;
  togglePerception: (overlay: "depthOverlay" | "layoutOverlay") => void;
  toggleTransparencyGrid: () => void;
  setPreviewQuality: (quality: PreviewQuality) => void;
  toggleLoop: () => void;
  playRange: () => void;
  fitPreview: () => void;
  zoomPreview: (scale: number) => void;
  stepPreviewZoom: (direction: 1 | -1) => void;
  toggleMagnetic: () => void;
  toggleLinkedSelection: () => void;
  toggleSolo: (trackId: string) => void;
  toggleMixer: () => void;
  setTrackHeight: (height: TrackHeight) => void;
  notify: (key: string, tone?: NoticeTone) => void;
  editTransform: (clipId: string, next: Transform) => void;
  jumpKey: (direction: 1 | -1) => void;
  toggleKey: () => void;
  easeKeys: (easing: Easing) => void;
  selectPropertyKeys: (clipId: string, property: AnimatedProperty) => void;
  patchKeyframes: (clipId: string, build: (clip: Clip, localMs: number, aspect: number) => ClipPatch | null, anywhere?: boolean) => void;
  setTool: (tool: TimelineTool) => void;
  cycleTrimTool: () => void;
  blade: (trackId: string | null, atMs: number, allTracks: boolean) => void;
  cutAllAtPlayhead: () => void;
  selectForward: (clipId: string | null, allTracks: boolean) => void;
  selectFromPlayhead: (direction: "after" | "before") => void;
  selectGap: (gap: Gap | null) => void;
  closeAllGaps: (trackId: string) => void;
  markIn: () => void;
  markOut: () => void;
  clearRange: () => void;
  lift: () => void;
  extract: () => void;
  copy: () => void;
  cut: () => void;
  paste: (mode: "overwrite" | "insert", payload?: ClipboardPayload) => void;
  pasteImages: (files: File[]) => Promise<void>;
  clipboardPayload: () => ClipboardPayload | null;
  nudge: (frames: number) => void;
  roll: (clipId: string, edge: TrimEdge, atMs: number, linked: boolean) => TrimEdit;
  slide: (clipId: string, startMs: number, linked: boolean) => TrimEdit;
  rollToPlayhead: (edge: TrimEdge) => void;
  toggleDisabled: () => void;
  relink: () => void;
  zoomToFit: () => void;
  enterFocus: (clipId?: string) => void;
  leaveFocus: () => void;
  toggleFocusOption: (option: "solo" | "zoom") => void;
  escape: () => void;
}

interface CommandDeps {
  store: StudioEditorStore<VideoDocument>;
  root: StudioEditorStore<VideoDocument>;
  view: VideoViewStore;
  assets: AssetCatalog;
  playback: PlaybackController;
  audio: Pick<AudioEngine, "analysis" | "speechOf" | "loudness" | "loudnessOf">;
  requestJob: (input: MediaGenerationInput) => Promise<ActionResult<MediaGenerationJob>>;
}

export function keepRecentJobs(jobs: readonly VideoJob[]): VideoJob[] {
  const finished = new Map<VideoJobPurpose, number>();
  const kept: VideoJob[] = [];
  for (const job of [...jobs].reverse()) {
    if (job.state !== "running") {
      const seen = finished.get(job.purpose) ?? 0;
      if (seen >= KEPT_FINISHED_JOBS) continue;
      finished.set(job.purpose, seen + 1);
    }
    kept.push(job);
  }
  return kept.reverse();
}

export function createEditorCommands({ store, root, view, assets, playback, audio, requestJob }: CommandDeps): EditorCommands {
  const state = () => store.getState();
  let clipboard: ClipboardPayload | null = null;
  const selectedTrackIds = () => {
    const doc = state().document;
    const ids = new Set(state().selection.map((id) => findClip(doc, id)?.track.id).filter((id): id is string => Boolean(id)));
    return ids.size > 0 ? [...ids] : undefined;
  };
  const markedRange = () => {
    const area = workArea(view.getState().range, state().document.durationMs);
    return area ? { inMs: area.startMs, outMs: area.endMs } : null;
  };
  const playhead = () => view.getState().playheadMs;
  const linkedSelection = () => view.getState().linkedSelection;
  const expanded = (ids: readonly string[]) => {
    const { document } = state();
    return (linkedSelection() ? withLinked(document, ids) : [...ids]).filter((id) => isClipPickable(document, id));
  };

  const notify = (key: string, tone: NoticeTone = "info") => view.setState({ notice: { key, tone } });

  const trimNotice = (result: TrimEdit) => {
    if (!result.ok) notify(`trim.${result.reason === "blocked" ? result.block.limit : result.reason}`, result.reason === "unchanged" ? "info" : "error");
  };

  const sourceOfClip = (doc: VideoDocument) => (clipId: string) => {
    const clip = findClip(doc, clipId)?.clip;
    return clip ? sourceLengthOf(clip, (assetId) => assets.store.getState().assets[assetId]?.durationMs) : undefined;
  };

  const apply = (operation: (doc: VideoDocument) => VideoDocument, nextSelection?: string[]) =>
    state().apply((doc) => magnetize(operation(doc), view.getState().magnetic), nextSelection);

  const retimed = (result: RetimeResult): boolean => {
    if (!result.ok) {
      notify(`speed.${result.reason}`, "error");
      return false;
    }
    apply(() => result.document);
    return true;
  };

  const editTrack = (trackId: string, patch: TrackPatch, issueOf: (track: Track) => string | null) => {
    const next = updateTrack(state().document, trackId, patch);
    const track = next.tracks.find((t) => t.id === trackId);
    const issue = track ? issueOf(track) : "clipGone";
    if (issue) {
      notify(issue, "error");
      return false;
    }
    apply(() => next);
    return true;
  };

  const settle = (placed: { document: VideoDocument; ids: string[] } | null): boolean => {
    if (!placed) {
      notify("noRoom", "error");
      return false;
    }
    apply(() => placed.document, placed.ids.slice(0, 1));
    return true;
  };

  const insertClips = (clips: Clip[], preferTrackId?: string): boolean => settle(placeClips(state().document, clips, preferTrackId));

  const patchJob = (id: string, patch: Partial<VideoJob>) =>
    view.setState((current) => ({ jobs: current.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)) }));

  const addJob = (purpose: VideoJobPurpose, target: VideoJobTarget, start: MediaGenerationInput | MediaGenerationJob, created: MediaGenerationJob | null, byAgent: boolean): string => {
    const id = newStudioId("job");
    const startedFrom = jobStartAsset(start);
    const job: VideoJob = { id, purpose, target, ...(startedFrom ? { startedFrom } : {}), created, state: "running", settling: false, error: null, byAgent };
    view.setState((current) => ({ jobs: keepRecentJobs([...current.jobs, job]) }));
    return id;
  };

  const runningKinds = () => view.getState().jobs.filter((job) => job.state === "running").map((job) => job.purpose);

  const commands: EditorCommands = {
    ...createKeyCommands({ store, view, notify, jumpMarker: (direction) => commands.jumpMarker(direction) }),
    ...createLayoutCommands({ store, view, notify, apply, source: sourceOfClip }),
    ...createTrackCommands({ store, view, notify }),
    ...createGraphCommands({ store, view, notify, enterFocus: () => commands.enterFocus() }),
    ...createGroupCommands({ store, root, view, notify, seek: (ms) => playback.seek(ms), pause: () => playback.pause() }),
    ...createTextEditCommands({ store, view, playback, apply }),
    undo: () => state().undo(),
    redo: () => state().redo(),
    apply,
    selectClip: (clipId, additive) => {
      view.setState({ selectedTransitionId: null });
      const group = expanded([clipId]);
      const current = state().selection;
      if (!additive) {
        state().select(group);
        return;
      }
      const toggled = toggledSelection(current, clipId, true);
      const adding = toggled.includes(clipId);
      state().select(adding ? [...new Set([...current, ...group])] : current.filter((id) => !group.includes(id)));
    },
    selectClips: (ids) => {
      view.setState({ selectedTransitionId: null });
      state().select(expanded(ids));
    },
    selectTransition: (transitionId) => {
      view.setState({ selectedTransitionId: transitionId, selectedGap: null });
      if (transitionId) state().select([]);
    },
    editTransition: (edit) => {
      const result = edit(state().document);
      if (!result.ok) {
        notify(`transitions.${result.reason}`, "error");
        return false;
      }
      state().apply(() => result.document, []);
      view.setState({ selectedTransitionId: findTransition(result.document, result.transitionId) ? result.transitionId : null, selectedGap: null });
      return true;
    },
    retime: (request) => {
      const { document, selection } = state();
      const targets = selection.filter((id) => {
        const clip = findClip(document, id)?.clip;
        return clip !== undefined && hasSourceTime(clip.type);
      });
      if (targets.length === 0) {
        notify("speed.notSourced", "error");
        return false;
      }
      let next = document;
      const handled = new Set<string>();
      for (const id of targets) {
        if (handled.has(id)) continue;
        const result = retimeClip(next, id, request, sourceOfClip(next));
        if (!result.ok) {
          notify(`speed.${result.reason}`, "error");
          return false;
        }
        next = result.document;
        for (const linked of linkGroup(next, id)) handled.add(linked);
      }
      apply(() => next);
      return true;
    },
    setTrackGain: (trackId, gainDb) => editTrack(trackId, { gainDb: gainDb === 0 ? undefined : gainDb }, (track) => (trackGainIssue(track) ? "ducking.range" : null)),
    setTrackMuted: (trackId, muted) => editTrack(trackId, { muted }, () => null),
    setTrackPan: (trackId, pan) => editTrack(trackId, { pan: pan === 0 ? undefined : pan }, (track) => (trackPanIssue(track) ? "outOfRange" : null)),
    normalize: async (target, targetLufs) => {
      const doc = state().document;
      const speech = "trackId" in target ? await speechOfTriggers(doc, (assetId) => audio.analysis(assetId)) : null;
      await Promise.all(loudnessAssetIds(doc, target).map((assetId) => audio.loudness(assetId)));
      const result = normalizeLoudness(state().document, target, targetLufs, (assetId) => audio.loudnessOf(assetId), speech ? (assetId) => speech.get(assetId) : undefined);
      if (!result.ok) notify(`normalize.${result.reason}`, "error");
      else apply(() => result.document);
      return result;
    },
    setDucking: (trackId, change) => {
      const current = state().document.tracks.find((t) => t.id === trackId);
      if (!current) return false;
      const next = updateTrack(state().document, trackId, { ducking: change === null ? undefined : withDucking(current.ducking, change) });
      const code = duckingIssue(next.tracks.find((t) => t.id === trackId)!, next);
      if (code) {
        notify(code === "out_of_range" ? "ducking.range" : "ducking.invalid", "error");
        return false;
      }
      apply(() => next);
      return true;
    },
    bakeDucking: async (trackId) => {
      const speech = await speechOfTriggers(state().document, (assetId) => audio.analysis(assetId));
      const result = bakeDucking(state().document, trackId, (assetId) => speech.get(assetId));
      if (!result.ok) {
        notify(`ducking.${result.reason}`, "error");
        return false;
      }
      apply(() => result.document);
      return true;
    },
    freezeFrame: (durationMs) => {
      const { document, selection } = state();
      const at = playhead();
      const covers = (clip: Clip | undefined) => clip !== undefined && clip.type === "video" && clip.startMs <= at && at < clip.startMs + clip.durationMs;
      const target = selection.find((id) => covers(findClip(document, id)?.clip)) ?? [...clipsAt(document, at)].reverse().find((active) => covers(active.clip))?.clip.id;
      if (!target) {
        notify("speed.notVideo");
        return false;
      }
      const result = freezeFrame(document, target, at, durationMs);
      if (!result.ok) {
        notify(`speed.${result.reason}`, "error");
        return false;
      }
      apply(() => result.document, [result.clipId]);
      return true;
    },
    setSpeedCurve: (clipId, request) => retimed(setSpeedCurve(state().document, clipId, request, sourceOfClip(state().document))),
    clearSpeedCurve: (clipId) => retimed(clearSpeedCurve(state().document, clipId)),
    setFrameMix: (on) => {
      const { document, selection } = state();
      const videos = selection.filter((id) => {
        const clip = findClip(document, id)?.clip;
        return clip?.type === "video" && !clip.freeze;
      });
      if (videos.length === 0) {
        notify("speed.notVideo");
        return false;
      }
      apply(() => videos.reduce((doc, id) => updateClip(doc, id, { frameMix: on ? true : undefined }), document));
      return true;
    },
    rampSpeed: (ramp, smooth) => {
      const { document, selection } = state();
      const at = playhead();
      const target = selection.find((id) => {
        const clip = findClip(document, id)?.clip;
        return clip !== undefined && hasSourceTime(clip.type) && clip.startMs <= at && at < clip.startMs + clip.durationMs;
      });
      if (!target) {
        notify("speed.rampOutside");
        return false;
      }
      const result = smooth ? smoothRamp(document, target, { atMs: at, rampMs: ramp.rampMs, toSpeed: ramp.toSpeed, easing: ramp.easing }) : rampSpeed(document, target, { ...ramp, atMs: at }, sourceOfClip(document));
      if (!result.ok) {
        notify(`speed.${result.reason}`, "error");
        return false;
      }
      apply(() => result.document);
      return true;
    },
    split: () => {
      const { selection, document } = state();
      const selected = selection.filter((id) => findClip(document, id));
      const next = splitAt(document, playhead(), selected.length > 0 ? expanded(selected) : undefined);
      if (next === document) notify("nothingToSplit");
      else apply(() => next);
    },
    remove: (ripple) => {
      const { selection } = state();
      const { focus, selectedKeys } = view.getState();
      if (focus && selectedKeys.length > 0) {
        const found = findClip(state().document, focus.clipId);
        if (found) state().apply((doc) => updateClip(doc, focus.clipId, { keyframes: removeKeys(found.clip.keyframes, selectedKeys) }));
        view.setState({ selectedKeys: [] });
        return;
      }
      const transitionId = view.getState().selectedTransitionId;
      if (selection.length === 0 && transitionId) {
        const removed = removeTransition(state().document, transitionId);
        view.setState({ selectedTransitionId: null });
        if (removed.ok) state().apply(() => removed.document, []);
        return;
      }
      const gap = view.getState().selectedGap;
      if (selection.length === 0 && gap) {
        view.setState({ selectedGap: null });
        apply((doc) => closeGap(doc, gap));
        return;
      }
      if (selection.length === 0) return;
      const ids = expanded(selection);
      apply((doc) => (ripple ? rippleDeleteClips(doc, ids) : deleteClips(doc, ids)), []);
    },
    duplicate: () => {
      const { selection, document } = state();
      if (selection.length === 0) return;
      const result = duplicateGroup(document, expanded(selection));
      if (result.clipIds.length === 0) {
        notify("noRoom", "error");
        return;
      }
      apply(() => result.document, result.clipIds);
    },
    link: () => {
      const { selection, document } = state();
      const next = linkClips(document, selection);
      if (next === document) notify("linkNeedsTwo");
      else state().apply(() => next);
    },
    unlink: () => {
      const { selection, document } = state();
      const next = unlinkClips(document, selection);
      if (next !== document) state().apply(() => next);
    },
    insertMedia: async (media, atMs, preferTrackId, durationMs) => {
      const type = clipTypeForMedia(media.type);
      if (!type) {
        notify("unsupportedMedia", "error");
        return false;
      }
      const sourceMs = type === "image" ? undefined : await assets.sourceDuration(media.id);
      return insertClips(sizedMediaClips(type, media.id, atMs ?? playhead(), sourceMs, durationMs), preferTrackId);
    },
    startJob: async (purpose, input, target) => {
      if (!canStart(purpose, runningKinds())) {
        notify("tooManyJobs", "error");
        return;
      }
      const id = addJob(purpose, target, input, null, false);
      const result = await requestJob(input);
      if (isActionError(result)) patchJob(id, { state: "failed", error: { code: result.code ?? "request_failed", message: result.error } });
      else patchJob(id, { created: result.data });
    },
    followJob: (purpose, job, target) => addJob(purpose, target, job, job, true),
    jobProgress: (id, settling) => patchJob(id, { settling }),
    jobFailed: (id, error) => patchJob(id, { state: "failed", error, settling: false }),
    jobFinished: (id) => patchJob(id, { state: "done", settling: false }),
    dismissJob: (id) => view.setState((current) => ({ jobs: current.jobs.filter((job) => job.id !== id) })),
    insertClips,
    insertLibrary: (clips, trackId) => settle(insertVideoClips(state().document, clips, trackId)),
    insertEffect: (kind) => {
      const placed = addEffectClip(state().document, kind ? [freshVfx(kind, defaultReactTrack(state().document))] : [], playhead());
      return settle(placed && { document: placed.document, ids: [placed.clipId] });
    },
    addBehavior: (clipId, kind, property) => {
      const behavior = draftBehavior(kind, property, {}, randomBehaviorSeed(), defaultReactTrack(state().document));
      if (typeof behavior === "string") {
        notify(`behaviors.${behavior}`, "error");
        return null;
      }
      const result = addBehavior(state().document, clipId, behavior);
      if (!result.ok) {
        notify(`behaviors.${result.reason}`, "error");
        return null;
      }
      state().apply(() => result.document);
      return behavior.id;
    },
    updateBehavior: (clipId, behaviorId, settings) => {
      const result = updateBehavior(state().document, clipId, behaviorId, settings);
      if (!result.ok) {
        notify(`behaviors.${result.reason}`, "error");
        return false;
      }
      state().apply(() => result.document);
      return true;
    },
    removeBehavior: (clipId, behaviorId) => {
      const result = removeBehavior(state().document, clipId, behaviorId);
      if (!result.ok) {
        notify(`behaviors.${result.reason}`, "error");
        return false;
      }
      state().apply(() => result.document);
      return true;
    },
    bakeBehavior: async (clipId, behaviorId) => {
      const levels = await reactLevels.ready(state().document);
      const result = bakeBehavior(state().document, clipId, behaviorId, levels ?? NO_LEVELS);
      if (!result.ok) {
        notify(`behaviors.${result.reason}`, "error");
        return false;
      }
      state().apply(() => result.document);
      if (result.clamped > 0) notify("behaviors.clamped");
      return true;
    },
    setParent: (clipIds, parentId, keepVisual) => {
      const result = setParents(state().document, clipIds, parentId, { keepVisual, atMs: playhead() });
      if (!result.ok) {
        notify(`parenting.${result.reason}`, "error");
        return false;
      }
      if (result.document !== state().document) state().apply(() => result.document);
      return true;
    },
    selectChildren: (clipId) => {
      const children = childIds(state().document, clipId);
      if (children.length > 0) state().select(children);
    },
    addMarker: () => {
      const result = addMarker(state().document, playhead());
      if (!result.markerId) notify("markerTaken");
      else state().apply(() => result.document);
    },
    addClipMarker: () => {
      const clipId = state().selection.find((id) => {
        const found = findClip(state().document, id);
        return found !== null && found.clip.startMs <= playhead() && playhead() <= found.clip.startMs + found.clip.durationMs;
      });
      if (!clipId) return notify("clipMarkerOutside");
      const result = addClipMarker(state().document, clipId, playhead(), {});
      if (!result.ok) return notify(`clipMarker.${result.reason}`, "error");
      state().apply(() => result.document);
    },
    toggleGuide: () => {
      const ids = state().selection;
      const clips = ids.flatMap((id) => findClip(state().document, id)?.clip ?? []).filter((clip) => clip.type !== "null");
      if (clips.length === 0) return;
      const on = !clips.every((clip) => clip.guide);
      state().apply((doc) => clips.reduce((next, clip) => updateClip(next, clip.id, { guide: on || undefined }), doc));
    },
    removeMarker: (markerId) => state().apply((doc) => removeMarker(doc, markerId)),
    jumpMarker: (direction) => {
      const marker = adjacentMarker(state().document, playhead(), direction);
      if (marker) playback.seek(marker.atMs);
    },
    setAspect: (aspect) => {
      if (state().document.canvas.aspect === aspect) return;
      state().update((draft) => {
        draft.canvas.aspect = aspect;
      });
    },
    setBackground: (color) => {
      if (!/^#[0-9a-fA-F]{6}$/.test(color) || state().document.canvas.background === color) return;
      state().update((draft) => {
        draft.canvas.background = color;
      });
    },
    zoom: (direction) => view.setState((current) => ({ pxPerSecond: zoomBy(current.pxPerSecond, direction) })),
    toggleSnapping: () => view.setState((current) => ({ snapping: !current.snapping })),
    toggleSafeArea: () => view.setState((current) => ({ safeArea: !current.safeArea })),
    togglePerception: (overlay) => view.setState((current) => ({ [overlay]: !current[overlay] })),
    toggleTransparencyGrid: () => view.setState((current) => ({ transparencyGrid: !current.transparencyGrid })),
    setShutter: (change) => {
      const canvas = state().document.canvas;
      const next = { ...canvas, ...change };
      if (shutterIssue(next) || (next.shutterAngle === canvas.shutterAngle && next.shutterPhase === canvas.shutterPhase)) return;
      state().update((draft) => {
        Object.assign(draft.canvas, change);
      });
    },
    setPerspective: (perspective) => {
      const next = perspectiveChange(state().document.canvas, perspective);
      if (next === null) return;
      state().update((draft) => {
        draft.canvas.perspective = next;
      });
    },
    setScrubbing: (scrubbing) => {
      if (view.getState().scrubbing !== scrubbing) view.setState({ scrubbing });
    },
    toggleBlurWhileScrubbing: () => view.setState((current) => ({ blurWhileScrubbing: !current.blurWhileScrubbing })),
    setPreviewQuality: (previewQuality) => view.setState({ previewQuality }),
    toggleLoop: () => playback.setLoop(!view.getState().loop),
    playRange: () => {
      if (!playback.playRange()) notify("rangeMissing");
    },
    fitPreview: () => {
      const { previewContainer } = view.getState();
      view.setState(previewContainer ? { previewFit: true, previewViewport: fitViewport(previewContainer, videoCanvasSize(state().document)) } : { previewFit: true });
    },
    zoomPreview: (scale) => {
      const { previewViewport, previewContainer } = view.getState();
      view.setState({ previewViewport: zoomAtCenter(previewViewport, scale, previewContainer), previewFit: false });
    },
    stepPreviewZoom: (direction) => commands.zoomPreview(stepZoom(view.getState().previewViewport.scale, direction)),
    toggleMagnetic: () => {
      const magnetic = !view.getState().magnetic;
      view.setState({ magnetic });
      if (magnetic) apply((doc) => doc);
    },
    toggleLinkedSelection: () => view.setState((current) => ({ linkedSelection: !current.linkedSelection })),
    toggleSolo: (trackId) => {
      view.setState((current) => ({
        soloTrackIds: current.soloTrackIds.includes(trackId) ? current.soloTrackIds.filter((id) => id !== trackId) : [...current.soloTrackIds, trackId],
      }));
      playback.documentChanged();
    },
    toggleMixer: () => view.setState((current) => ({ mixerOpen: !current.mixerOpen })),
    setTrackHeight: (trackHeight) => view.setState({ trackHeight }),
    notify,
    editTransform: (clipId, next) => {
      const found = findClip(state().document, clipId);
      if (!found) return;
      const patch = placedPatch(clipLookup(state().document), found.clip, next, playhead(), canvasAspect(state().document));
      if (typeof patch === "string") {
        notify(patch);
        return;
      }
      state().apply((doc) => updateClip(doc, clipId, patch));
    },
    jumpKey: (direction) => {
      const { selection, document } = state();
      const found = selection.length === 1 ? findClip(document, selection[0]) : null;
      if (!found) return;
      const at = adjacentKey(keyTimes(found.clip), playhead() - found.clip.startMs, direction);
      if (at !== null) playback.seek(found.clip.startMs + at);
    },
    toggleKey: () => {
      const { selection, document } = state();
      const visual = selection.filter((id) => findClip(document, id)?.clip.type !== "audio");
      if (visual.length === 0) return;
      const result = toggleSelectionMoment(document, visual, playhead());
      if (!result.ok) notify(result.reason, result.reason === "keyframeOutside" ? "info" : "error");
      else if (result.document !== document) state().apply(() => result.document);
    },
    easeKeys: (easing) => {
      const { focus, selectedKeys } = view.getState();
      const keyed = focus && selectedKeys.length > 0 ? findClip(state().document, focus.clipId) : null;
      if (keyed) {
        const keyframes = easeKeys(keyed.clip.keyframes, selectedKeys, easing);
        if (keyframes !== keyed.clip.keyframes) state().apply((doc) => updateClip(doc, keyed.clip.id, { keyframes }));
        return;
      }
      const { selection, document } = state();
      const clip = selection.length === 1 ? findClip(document, selection[0])?.clip : null;
      const local = clip ? localTime(clip, playhead()) : null;
      const patch = clip && local !== null ? setMomentEasing(clip, local, easing) : null;
      if (!clip || !patch) notify("noKeysToEase", "info");
      else state().apply((doc) => updateClip(doc, clip.id, patch));
    },
    selectPropertyKeys: (clipId, property) => {
      const found = findClip(state().document, clipId);
      if (found) view.setState({ selectedKeys: propertyKeys(found.clip.keyframes, property), keyProperty: property });
    },
    patchKeyframes: (clipId, build, anywhere = false) => {
      const found = findClip(state().document, clipId);
      const inside = found ? localTime(found.clip, playhead()) : null;
      const local = found && anywhere ? Math.min(Math.max(0, Math.round(playhead() - found.clip.startMs)), found.clip.durationMs) : inside;
      if (!found || local === null) {
        notify("keyframeOutside");
        return;
      }
      const patch = build(found.clip, local, canvasAspect(state().document));
      if (!patch) return;
      const next = updateClip(state().document, clipId, patch);
      if (next === state().document) notify("clipLocked", "error");
      else state().apply(() => next);
    },
    setTool: (tool) => view.setState({ tool, dragMode: null }),
    cycleTrimTool: () => {
      const current = view.getState().tool;
      const index = TRIM_TOOLS.indexOf(current);
      view.setState({ tool: TRIM_TOOLS[(index + 1) % TRIM_TOOLS.length] });
    },
    blade: (trackId, atMs, allTracks) => {
      const document = state().document;
      const next = blade(document, trackId, atMs, { allTracks, linked: linkedSelection() });
      if (next === document) notify("nothingToSplit");
      else apply(() => next);
    },
    cutAllAtPlayhead: () => commands.blade(null, playhead(), true),
    selectForward: (clipId, allTracks) => {
      const doc = state().document;
      const anchor = clipId ?? state().selection[0];
      if (!anchor) return;
      state().select(expanded(selectForward(doc, anchor, allTracks)));
    },
    selectFromPlayhead: (direction) => state().select(expanded(selectFromPlayhead(state().document, playhead(), direction, selectedTrackIds()))),
    selectGap: (gap) => {
      view.setState({ selectedGap: gap });
      if (gap) state().select([]);
    },
    closeAllGaps: (trackId) => apply((doc) => closeGaps(doc, trackId)),
    markIn: () => view.setState((current) => ({ range: { ...current.range, inMs: current.playheadMs } })),
    markOut: () => view.setState((current) => ({ range: { ...current.range, outMs: current.playheadMs } })),
    clearRange: () => view.setState({ range: { inMs: null, outMs: null } }),
    lift: () => {
      const range = markedRange();
      if (!range) notify("rangeMissing");
      else apply((doc) => liftRange(doc, range, selectedTrackIds()), []);
    },
    extract: () => {
      const range = markedRange();
      if (!range) notify("rangeMissing");
      else apply((doc) => extractRange(doc, range, selectedTrackIds()), []);
    },
    copy: () => {
      const payload = copyClips(state().document, expanded(state().selection));
      if (!payload) return;
      clipboard = payload;
      void navigator.clipboard?.writeText(encodeClipboard(payload)).catch(() => undefined);
    },
    cut: () => {
      commands.copy();
      commands.remove(false);
    },
    clipboardPayload: () => clipboard,
    pasteImages: async (files) => {
      for (const file of files) {
        const image = await asUploadableImage(file);
        if (!image) {
          notify("pasteFailed", "error");
          continue;
        }
        const form = new FormData();
        form.append("media", image);
        form.append("mediaType", "image");
        form.append("description", image.name || "clipboard.png");
        const uploaded = await uploadMediaAction(form);
        if (uploaded.error || !uploaded.mediaId) {
          notify("pasteFailed", "error");
          continue;
        }
        void assets.loadLibrary();
        insertClips(mediaClips("image", uploaded.mediaId, playhead(), undefined));
      }
    },
    paste: (mode, payload) => {
      const source = payload ?? clipboard;
      if (!source) return;
      const result = pasteClips(state().document, source, playhead(), mode);
      if (!result) notify("noRoom", "error");
      else apply(() => result.document, result.ids);
    },
    nudge: (frames) => {
      const { document, selection } = state();
      const { tool } = view.getState();
      const target = selection.length > 0 && (tool === "roll" || tool === "slide") ? findClip(document, selection[0])?.clip : undefined;
      if (target && tool === "slide") {
        trimNotice(commands.slide(target.id, target.startMs + msOfFrame(frames), linkedSelection()));
        return;
      }
      if (target) {
        const edge = nearestEdge(target, playhead());
        trimNotice(commands.roll(target.id, edge, (edge === "start" ? target.startMs : clipEnd(target)) + msOfFrame(frames), linkedSelection()));
        return;
      }
      const ids = expanded(selection);
      if (ids.length > 0) apply((doc) => nudgeClips(doc, ids, frames));
    },
    roll: (clipId, edge, atMs, linked) => {
      const document = state().document;
      const result = rollCut(document, clipId, edge, atMs, sourceOfClip(document), { linked });
      if (result.ok) apply(() => result.document);
      return result;
    },
    slide: (clipId, startMs, linked) => {
      const document = state().document;
      const result = slideClip(document, clipId, startMs, sourceOfClip(document), { linked });
      if (result.ok) apply(() => result.document);
      return result;
    },
    rollToPlayhead: (edge) => {
      const { document, selection } = state();
      const clipId = clipUnder(document, selection, playhead());
      if (!clipId) notify("trim.noClip");
      else trimNotice(commands.roll(clipId, edge, playhead(), linkedSelection()));
    },
    toggleDisabled: () => {
      const ids = expanded(state().selection);
      if (ids.length > 0) state().apply((doc) => toggleDisabled(doc, ids));
    },
    relink: () => {
      const document = state().document;
      const next = relinkClips(document, state().selection);
      if (next === document) notify("nothingToRelink");
      else state().apply(() => next);
    },
    enterFocus: (clipId) => {
      const doc = state().document;
      const id = clipId ?? state().selection[0];
      const found = id ? findClip(doc, id) : null;
      if (!found) return;
      if (view.getState().focus?.clipId === found.clip.id) {
        commands.leaveFocus();
        return;
      }
      state().select([found.clip.id]);
      const { pxPerSecond, scrollLeft } = focusView(found.clip.startMs, found.clip.durationMs, view.getState().viewportPx);
      view.setState({ focus: { clipId: found.clip.id, solo: false, zoom: false }, selectedKeys: [], pxPerSecond, scrollRequest: scrollLeft });
      const local = localTime(found.clip, playhead());
      if (local === null) playback.seek(found.clip.startMs);
    },
    leaveFocus: () => view.setState({ focus: null, selectedKeys: [] }),
    escape: () => {
      const current = view.getState();
      if (current.focus) commands.leaveFocus();
      else if (current.tool !== "select") commands.setTool("select");
      else if (current.selectedGap) view.setState({ selectedGap: null });
      else state().select([]);
    },
    toggleFocusOption: (option) =>
      view.setState((current) => (current.focus ? { focus: { ...current.focus, [option]: !current.focus[option] } } : {})),
    zoomToFit: () => {
      const { viewportPx } = view.getState();
      view.setState({ pxPerSecond: fitZoom(Math.max(contentDuration(state().document), 1000), viewportPx * 0.95), scrollRequest: 0 });
    },
  };
  return commands;
}
