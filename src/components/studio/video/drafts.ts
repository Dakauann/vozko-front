"use client";

import { useCallback } from "react";

import type { ModelKind } from "@/lib/media-generation/types";

import { useVideoEditor, useViewState } from "./editor-context";
import { EMPTY_AI_DRAFT, type AiDraft, type VideoJobPurpose } from "./view-store";

export function useClipPick(purpose: VideoJobPurpose): [string | null, (clipId: string | null) => void] {
  const { view } = useVideoEditor();
  const picked = useViewState((s) => s.clipPicks[purpose] ?? null);
  const pick = useCallback(
    (clipId: string | null) => view.setState((current) => ({ clipPicks: { ...current.clipPicks, [purpose]: clipId ?? undefined } })),
    [view, purpose],
  );
  return [picked, pick];
}

export function useAiDraft(kind: ModelKind): [AiDraft, (patch: Partial<AiDraft>) => void] {
  const { view } = useVideoEditor();
  const draft = useViewState((s) => s.aiDrafts[kind] ?? EMPTY_AI_DRAFT);
  const update = useCallback(
    (patch: Partial<AiDraft>) =>
      view.setState((current) => ({ aiDrafts: { ...current.aiDrafts, [kind]: { ...(current.aiDrafts[kind] ?? EMPTY_AI_DRAFT), ...patch } } })),
    [view, kind],
  );
  return [draft, update];
}
