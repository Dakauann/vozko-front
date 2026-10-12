"use client";

import { useEffect, useMemo } from "react";
import { useStore } from "zustand";

import { canvasAspect, type Anchor, type Clip, type Transform, type VideoDocument } from "@/lib/studio/document";
import type { ColorProperty, KeyframeProperty } from "@/lib/studio/keyframes";
import { anchorEdit, applyToSelection, blurPatch, keyedPatch, paintPatch, transformPatch, type PatchBuilder, type SelectionEdit, type SourceDurations } from "@/lib/studio/selection-edit";
import { hasSourceTime } from "@/lib/studio/clip-time";
import { anchorOf } from "@/lib/studio/clip-placement";

import { useVideoEditor } from "../editor-context";
import { reportSelection } from "./selection-notice";

export interface SelectionEditor {
  ids: readonly string[];
  run: (edit: (doc: VideoDocument) => SelectionEdit) => boolean;
  patch: (build: PatchBuilder) => boolean;
  transform: (change: (shown: Transform) => Partial<Transform>) => boolean;
  blur: (change: (shown: number) => number) => boolean;
  keyed: (property: KeyframeProperty, change: (shown: number) => number) => boolean;
  paint: (property: ColorProperty, color: string) => boolean;
  anchor: (change: (current: Anchor) => Anchor, keepVisual: boolean) => boolean;
  aspect: () => number;
  gesture: { onStart: () => void; onCommit: () => void };
  playheadMs: () => number;
}

export function useSelectionEditor(ids: readonly string[]): SelectionEditor {
  const { store, view } = useVideoEditor();
  return useMemo(() => {
    const playheadMs = () => view.getState().playheadMs;
    const aspect = () => canvasAspect(store.getState().document);
    const run = (edit: (doc: VideoDocument) => SelectionEdit): boolean => {
      const result = edit(store.getState().document);
      if (!result.ok) {
        reportSelection(result.reason);
        return false;
      }
      store.getState().apply(() => result.document);
      return true;
    };
    const patch = (build: PatchBuilder) => run((doc) => applyToSelection(doc, ids, build));
    return {
      ids,
      run,
      patch,
      transform: (change) => patch((clip) => transformPatch(clip, change, playheadMs(), aspect())),
      blur: (change) => patch((clip) => blurPatch(clip, change, playheadMs())),
      keyed: (property, change) => patch((clip) => keyedPatch(clip, property, change, playheadMs())),
      paint: (property, color) => patch((clip) => paintPatch(clip, property, color, playheadMs())),
      anchor: (change, keepVisual) => {
        let moment = false;
        const applied = patch((clip) => {
          const edit = anchorEdit(clip, change(anchorOf(clip)), keepVisual, playheadMs(), aspect());
          if (typeof edit === "string") return edit;
          moment ||= edit.kept === "moment";
          return edit.patch;
        });
        if (applied && moment) reportSelection("anchorMoment");
        return applied;
      },
      aspect,
      gesture: { onStart: () => store.getState().beginTransaction(), onCommit: () => store.getState().commitTransaction() },
      playheadMs,
    };
  }, [ids, store, view]);
}

export function useSourceDurations(clips: readonly Clip[]): SourceDurations {
  const { assets } = useVideoEditor();
  const assetIds = useMemo(() => [...new Set(clips.filter((clip) => hasSourceTime(clip.type) && clip.assetId).map((clip) => clip.assetId!))], [clips]);
  const known = useStore(assets.store, (state) => state.assets);
  const key = assetIds.join(",");

  useEffect(() => {
    for (const assetId of key === "" ? [] : key.split(",")) {
      if (assets.store.getState().assets[assetId]?.durationMs === undefined) void assets.sourceDuration(assetId);
    }
  }, [key, assets]);

  return useMemo(() => Object.fromEntries(assetIds.map((assetId) => [assetId, known[assetId]?.durationMs])), [assetIds, known]);
}
