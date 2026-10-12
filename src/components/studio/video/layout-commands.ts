import type { Alignment, DistributeAxis } from "@/lib/studio/arrange";
import type { VideoDocument } from "@/lib/studio/document";
import type { ClipSource } from "@/lib/studio/edits";
import { alignClips, distributeClips, type AlignTo, type FrameLayoutResult } from "@/lib/studio/frame-layout";
import type { StudioEditorStore } from "@/lib/studio/store";
import { moveToPlayhead, playheadTargets, sequenceClips, staggerClips, trimToPlayhead, type PlayheadEdge, type SequenceOptions, type TimingResult } from "@/lib/studio/timing-edits";

import type { NoticeTone, VideoViewStore } from "./view-store";

export interface LayoutCommands {
  alignClips: (ids: readonly string[], alignment: Alignment, relativeTo?: AlignTo) => boolean;
  distributeClips: (ids: readonly string[], axis: DistributeAxis) => boolean;
  alignSelection: (alignment: Alignment) => boolean;
  distributeSelection: (axis: DistributeAxis) => boolean;
  sequenceClips: (ids: readonly string[], options: SequenceOptions) => boolean;
  staggerClips: (ids: readonly string[], stepMs: number) => boolean;
  trimToPlayhead: (edge: PlayheadEdge, ripple: boolean) => boolean;
  moveToPlayhead: (edge: PlayheadEdge) => boolean;
}

interface LayoutCommandDeps {
  store: StudioEditorStore<VideoDocument>;
  view: VideoViewStore;
  notify: (key: string, tone?: NoticeTone) => void;
  apply: (operation: (doc: VideoDocument) => VideoDocument) => void;
  source: (doc: VideoDocument) => ClipSource;
}

export function createLayoutCommands({ store, view, notify, apply, source }: LayoutCommandDeps): LayoutCommands {
  const state = () => store.getState();
  const playhead = () => view.getState().playheadMs;

  const framed = (result: FrameLayoutResult): boolean => {
    if (!result.ok) {
      notify(`layout.${result.reason}`, result.reason === "keyframeOutside" ? "info" : "error");
      return false;
    }
    if (result.document !== state().document) state().apply(() => result.document);
    return true;
  };

  const timed = (result: TimingResult): boolean => {
    if (!result.ok) {
      notify(`timing.${result.reason}`, result.reason === "noClip" || result.reason === "unchanged" ? "info" : "error");
      return false;
    }
    if (result.document !== state().document) apply(() => result.document);
    return true;
  };

  const commands: LayoutCommands = {
    alignClips: (ids, alignment, relativeTo) => framed(alignClips(state().document, ids, alignment, { playheadMs: playhead(), relativeTo })),
    distributeClips: (ids, axis) => framed(distributeClips(state().document, ids, axis, { playheadMs: playhead() })),
    alignSelection: (alignment) => commands.alignClips(state().selection, alignment),
    distributeSelection: (axis) => commands.distributeClips(state().selection, axis),
    sequenceClips: (ids, options) => timed(sequenceClips(state().document, ids, options)),
    staggerClips: (ids, stepMs) => timed(staggerClips(state().document, ids, stepMs)),
    trimToPlayhead: (edge, ripple) => {
      const doc = state().document;
      const at = playhead();
      const ids = playheadTargets(doc, state().selection, at);
      return timed(trimToPlayhead(doc, ids, edge, at, source(doc), { ripple, linked: view.getState().linkedSelection }));
    },
    moveToPlayhead: (edge) => {
      const { selection, document } = state();
      if (selection.length === 0) {
        notify("timing.noSelection");
        return false;
      }
      return timed(moveToPlayhead(document, selection, edge, playhead()));
    },
  };
  return commands;
}
