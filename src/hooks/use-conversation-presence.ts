"use client";

import { useMemo } from "react";

import { useSignedInUserId } from "@/contexts/auth-context";
import { useOptionalCrm } from "@/contexts/crm-context";
import type { EntryType } from "@/lib/conversations/types";
import { typistsIn } from "@/lib/conversations/typing";
import { otherViewers, typingOperatorNames, viewersOf, type EntryViewer } from "@/lib/conversations/viewers";

const NOBODY: EntryViewer[] = [];
const NO_NAMES: string[] = [];

export interface ConversationPresence {
  viewers: EntryViewer[];
  typingNames: string[];
}

export function useConversationPresence(entryId: string | null, entryType: EntryType | null): ConversationPresence {
  const crm = useOptionalCrm();
  const selfId = useSignedInUserId();
  const viewersByEntry = crm?.viewersByEntry;
  const typingByEntry = crm?.typingByEntry;

  return useMemo(() => {
    if (!entryId || !entryType || !viewersByEntry || !typingByEntry) return { viewers: NOBODY, typingNames: NO_NAMES };
    const everyone = viewersOf(viewersByEntry, entryId, entryType);
    return {
      viewers: otherViewers(viewersByEntry, entryId, entryType, selfId),
      typingNames: typingOperatorNames(typistsIn(typingByEntry, entryId, entryType), everyone, selfId),
    };
  }, [entryId, entryType, selfId, typingByEntry, viewersByEntry]);
}
