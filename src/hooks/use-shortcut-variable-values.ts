"use client";

import { useMemo } from "react";

import { useSignedInUserName } from "@/contexts/auth-context";
import { useOptionalCrm } from "@/contexts/crm-context";
import type { EntryType } from "@/lib/conversations/types";
import { windowKey } from "@/lib/conversations/window-deck";
import type { ShortcutVariableValues } from "@/lib/message-shortcuts/variables";

interface LeadIdentity {
  lead_name?: string;
  lead_number?: string;
}

export function useShortcutVariableValues(entryId: string, entryType: EntryType): ShortcutVariableValues {
  const crm = useOptionalCrm();
  const operatorName = useSignedInUserName();
  const active = crm?.activeConversation;
  const windowed = crm?.windowConversations.get(windowKey(entryId, entryType))?.conversation;
  const listed = crm?.inbox.find((entry) => entry.entry_id === entryId && entry.entry_type === entryType);

  const lead: LeadIdentity | undefined =
    active && active.entry_id === entryId && active.entry_type === entryType ? active : (windowed ?? listed);

  return useMemo(
    () => ({ leadName: lead?.lead_name ?? null, leadPhone: lead?.lead_number ?? null, operatorName }),
    [lead?.lead_name, lead?.lead_number, operatorName],
  );
}
