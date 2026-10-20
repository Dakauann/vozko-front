"use client";

import { useOptionalCrm } from "@/contexts/crm-context";
import type { ActiveConversation, EntryType } from "@/lib/conversations/types";
import { windowKey } from "@/lib/conversations/window-deck";

export function useEntryConversation(entryId: string, entryType: EntryType): ActiveConversation | null {
  const crm = useOptionalCrm();
  if (!crm) return null;
  const active = crm.activeConversation;
  if (active && active.entry_id === entryId && active.entry_type === entryType) return active;
  return crm.windowConversations.get(windowKey(entryId, entryType))?.conversation ?? null;
}
