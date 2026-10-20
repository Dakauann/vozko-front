"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { useSignedInUserId } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { conversationDrafts } from "@/lib/conversations/browser-drafts";
import { draftPreview, type ConversationDraft, type DraftKind, type DraftScope } from "@/lib/conversations/drafts";

const SAVE_DELAY_MS = 400;

export function useDraftScope(): DraftScope | null {
  const userId = useSignedInUserId();
  const workspaceId = useWorkspace().currentWorkspace?.id ?? null;
  return useMemo(() => (userId && workspaceId ? { userId, workspaceId } : null), [userId, workspaceId]);
}

export function readDraft(
  scope: DraftScope | null,
  entryKey: string | null,
  kind: DraftKind = "message",
): ConversationDraft | null {
  return scope && entryKey ? conversationDrafts.read(scope, entryKey, kind) : null;
}

export function useDraftPreview(entryKey: string): string | null {
  const scope = useDraftScope();
  const snapshot = useCallback(() => draftPreview(readDraft(scope, entryKey)), [scope, entryKey]);
  return useSyncExternalStore(conversationDrafts.subscribe, snapshot, () => null);
}

export function useDraftAutosave(entryKey: string, current: ConversationDraft, kind: DraftKind = "message") {
  const scope = useDraftScope();
  const latestRef = useRef({ scope, current });
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serialized = JSON.stringify(current);

  useEffect(() => {
    latestRef.current = { scope, current: JSON.parse(serialized) as ConversationDraft };
    if (!scope) return;
    pendingRef.current = true;
    const timer = setTimeout(() => {
      pendingRef.current = false;
      conversationDrafts.write(scope, entryKey, latestRef.current.current, kind);
    }, SAVE_DELAY_MS);
    timerRef.current = timer;
    return () => clearTimeout(timer);
  }, [entryKey, scope, serialized, kind]);

  useEffect(
    () => () => {
      const { scope: lastScope, current: lastDraft } = latestRef.current;
      if (pendingRef.current && lastScope) conversationDrafts.write(lastScope, entryKey, lastDraft, kind);
    },
    [entryKey, kind],
  );

  const discard = useCallback(() => {
    pendingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (scope) conversationDrafts.clear(scope, entryKey, kind);
  }, [entryKey, scope, kind]);

  return discard;
}
