"use client";

import { isActionError, type ActionResult } from "@/app/actions/action-result";
import { uploadMediaAction } from "@/app/actions/medias";
import type { MediaGenerationError } from "@/hooks/use-media-generation";
import { canStart, KEPT_FINISHED_JOBS } from "@/lib/media-generation/limits";
import type { MediaGenerationInput, MediaGenerationJob } from "@/lib/media-generation/types";
import { asUploadableImage } from "@/components/studio/canvas/uploadable-image";
import type { Media } from "@/lib/medias/types";
import { encodeClipboard } from "@/lib/studio/clip-clipboard";
import { newStudioId, type Clip, type Layer, type Transform, type VideoAspect, type VideoDocument } from "@/lib/studio/document";
import { adjacentKey, keyTimes, localTime } from "@/lib/studio/keyframe-edit";
import { toggleSelectionMoment, transformPatch } from "@/lib/studio/selection-edit";
import { closeGaps, duplicateGroup, linkClips, magnetize, placeStack, splitAt, unlinkClips, withLinked } from "@/lib/studio/edits";
import { removeKeys } from "@/lib/studio/focus-lanes";
import { addMarker, adjacentMarker, removeMarker } from "@/lib/studio/markers";
import { clipTypeForMedia, mediaClips, overlayClip, sizedMediaClips } from "@/lib/studio/media-clips";
import type { StudioEditorStore } from "@/lib/studio/store";
import { textPresetClips, type TextStylePreset } from "@/lib/studio/text-presets";
import { contentDuration, deleteClips, findClip, isClipPickable, placeClips, rippleDeleteClips, updateClip, type ClipPatch } from "@/lib/studio/timeline";

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
import type { PlaybackController } from "./playback-controller";
import { TRIM_TOOLS, type NoticeTone, type TimelineTool, type TrackHeight, type VideoJob, type VideoJobPurpose, type VideoJobTarget, type VideoViewStore } from "./view-store";

export interface EditorCommands {
  undo: () => void;
  redo: () => void;
  apply: (operation: (doc: VideoDocument) => VideoDocument, nextSelection?: string[]) => void;
  selectClip: (clipId: string, additive: boolean) => void;
  selectClips: (ids: string[]) => void;
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
  insertLayer: (layer: Layer) => boolean;
  insertClips: (clips: Clip[], preferTrackId?: string) => boolean;
  insertTextPreset: (preset: TextStylePreset, content: string) => boolean;
  addMarker: () => void;
  removeMarker: (markerId: string) => void;
  jumpMarker: (direction: 1 | -1) => void;
  setAspect: (aspect: VideoAspect) => void;
  setBackground: (color: string) => void;
  zoom: (direction: 1 | -1) => void;
  toggleSnapping: () => void;
  toggleSafeArea: () => void;
  toggleMagnetic: () => void;
  toggleLinkedSelection: () => void;
  toggleSolo: (trackId: string) => void;
  setTrackHeight: (height: TrackHeight) => void;
  notify: (key: string, tone?: NoticeTone) => void;
  editTransform: (clipId: string, next: Transform) => void;
  jumpKey: (direction: 1 | -1) => void;
  toggleKey: () => void;
  patchKeyframes: (clipId: string, build: (clip: Clip, localMs: number) => ClipPatch | null, anywhere?: boolean) => void;
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
  view: VideoViewStore;
  assets: AssetCatalog;
  playback: PlaybackController;
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

export function createEditorCommands({ store, view, assets, playback, requestJob }: CommandDeps): EditorCommands {
  const state = () => store.getState();
  let clipboard: ClipboardPayload | null = null;
  const selectedTrackIds = () => {
    const doc = state().document;
    const ids = new Set(state().selection.map((id) => findClip(doc, id)?.track.id).filter((id): id is string => Boolean(id)));
    return ids.size > 0 ? [...ids] : undefined;
  };
  const markedRange = () => {
    const { inMs, outMs } = view.getState().range;
    if (inMs === null || outMs === null || outMs <= inMs) return null;
    return { inMs, outMs };
  };
  const playhead = () => view.getState().playheadMs;
  const linkedSelection = () => view.getState().linkedSelection;
  const expanded = (ids: readonly string[]) => {
    const { document } = state();
    return (linkedSelection() ? withLinked(document, ids) : [...ids]).filter((id) => isClipPickable(document, id));
  };

  const notify = (key: string, tone: NoticeTone = "info") => view.setState({ notice: { key, tone } });

  const apply = (operation: (doc: VideoDocument) => VideoDocument, nextSelection?: string[]) =>
    state().apply((doc) => magnetize(operation(doc), view.getState().magnetic), nextSelection);

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

  const addJob = (purpose: VideoJobPurpose, target: VideoJobTarget, created: MediaGenerationJob | null, byAgent: boolean): string => {
    const id = newStudioId("job");
    const job: VideoJob = { id, purpose, target, created, state: "running", settling: false, error: null, byAgent };
    view.setState((current) => ({ jobs: keepRecentJobs([...current.jobs, job]) }));
    return id;
  };

  const runningKinds = () => view.getState().jobs.filter((job) => job.state === "running").map((job) => job.purpose);

  const commands: EditorCommands = {
    undo: () => state().undo(),
    redo: () => state().redo(),
    apply,
    selectClip: (clipId, additive) => {
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
    selectClips: (ids) => state().select(expanded(ids)),
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
      const id = addJob(purpose, target, null, false);
      const result = await requestJob(input);
      if (isActionError(result)) patchJob(id, { state: "failed", error: { code: result.code ?? "request_failed", message: result.error } });
      else patchJob(id, { created: result.data });
    },
    followJob: (purpose, job, target) => addJob(purpose, target, job, true),
    jobProgress: (id, settling) => patchJob(id, { settling }),
    jobFailed: (id, error) => patchJob(id, { state: "failed", error, settling: false }),
    jobFinished: (id) => patchJob(id, { state: "done", settling: false }),
    dismissJob: (id) => view.setState((current) => ({ jobs: current.jobs.filter((job) => job.id !== id) })),
    insertLayer: (layer) => insertClips([overlayClip(layer, playhead())]),
    insertClips,
    insertTextPreset: (preset, content) => settle(placeStack(state().document, textPresetClips(preset, content, playhead()))),
    addMarker: () => {
      const result = addMarker(state().document, playhead());
      if (!result.markerId) notify("markerTaken");
      else state().apply(() => result.document);
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
    setTrackHeight: (trackHeight) => view.setState({ trackHeight }),
    notify,
    editTransform: (clipId, next) => {
      const found = findClip(state().document, clipId);
      if (!found) return;
      const patch = transformPatch(found.clip, () => next, playhead());
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
    patchKeyframes: (clipId, build, anywhere = false) => {
      const found = findClip(state().document, clipId);
      const inside = found ? localTime(found.clip, playhead()) : null;
      const local = found && anywhere ? Math.min(Math.max(0, Math.round(playhead() - found.clip.startMs)), found.clip.durationMs) : inside;
      if (!found || local === null) {
        notify("keyframeOutside");
        return;
      }
      const patch = build(found.clip, local);
      if (!patch) return;
      const next = updateClip(state().document, clipId, patch);
      if (next === state().document) notify("keyframeLimit", "error");
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
      const ids = expanded(state().selection);
      if (ids.length > 0) apply((doc) => nudgeClips(doc, ids, frames));
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
