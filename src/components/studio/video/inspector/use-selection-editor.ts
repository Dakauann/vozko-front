"use client";

import { useEffect, useMemo } from "react";
import { useStore } from "zustand";

import type { Clip, Transform, VideoDocument } from "@/lib/studio/document";
import { applyToSelection, transformPatch, type PatchBuilder, type SelectionEdit, type SourceDurations } from "@/lib/studio/selection-edit";
import { hasSourceTime } from "@/lib/studio/timeline";

import { useVideoEditor } from "../editor-context";
import { reportSelection } from "./selection-notice";

export interface SelectionEditor {
  ids: readonly string[];
  run: (edit: (doc: VideoDocument) => SelectionEdit) => boolean;
  patch: (build: PatchBuilder) => boolean;
  transform: (change: (shown: Transform) => Partial<Transform>) => boolean;
  gesture: { onStart: () => void; onCommit: () => void };
  playheadMs: () => number;
}

export function useSelectionEditor(ids: readonly string[]): SelectionEditor {
  const { store, view } = useVideoEditor();
  return useMemo(() => {
    const playheadMs = () => view.getState().playheadMs;
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
      transform: (change) => patch((clip) => transformPatch(clip, change, playheadMs())),
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
