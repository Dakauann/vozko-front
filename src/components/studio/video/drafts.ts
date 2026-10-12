"use client";

import { useCallback } from "react";

import type { ModelKind } from "@/lib/media-generation/types";

import { useVideoEditor, useViewState } from "./editor-context";
import { EMPTY_AI_DRAFT, type AiDraft, type VideoJobPurpose, type VideoViewStore } from "./view-store";

export function pickClip(view: VideoViewStore, purpose: VideoJobPurpose, clipId: string | null): void {
  view.setState((current) => ({ clipPicks: { ...current.clipPicks, [purpose]: clipId ?? undefined } }));
}

export function useClipPick(purpose: VideoJobPurpose): [string | null, (clipId: string | null) => void] {
  const { view } = useVideoEditor();
  const picked = useViewState((s) => s.clipPicks[purpose] ?? null);
  const pick = useCallback((clipId: string | null) => pickClip(view, purpose, clipId), [view, purpose]);
  return [picked, pick];
}

export function withAiDraft(drafts: Partial<Record<ModelKind, AiDraft>>, kind: ModelKind, patch: Partial<AiDraft>): Partial<Record<ModelKind, AiDraft>> {
  return { ...drafts, [kind]: { ...(drafts[kind] ?? EMPTY_AI_DRAFT), ...patch } };
}

export function openAiForm(view: VideoViewStore, kind: ModelKind, patch: Partial<AiDraft> = {}): void {
  view.setState((current) => ({ panel: "ai", aiKind: kind, aiDrafts: withAiDraft(current.aiDrafts, kind, patch) }));
}

export function useAiDraft(kind: ModelKind): [AiDraft, (patch: Partial<AiDraft>) => void] {
  const { view } = useVideoEditor();
  const draft = useViewState((s) => s.aiDrafts[kind] ?? EMPTY_AI_DRAFT);
  const update = useCallback((patch: Partial<AiDraft>) => view.setState((current) => ({ aiDrafts: withAiDraft(current.aiDrafts, kind, patch) })), [view, kind]);
  return [draft, update];
}
