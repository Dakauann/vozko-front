"use client";

import { useMemo } from "react";

import type { ConversationCommand } from "@/components/crm/CrmCommandPalette";
import { usePersonalActions } from "@/hooks/use-personal-actions";
import type { PersonalInboxControls } from "@/hooks/use-personal-marks";
import type { CountedEntry } from "@/lib/conversations/personal-marks";

export function usePersonalCommands(entry: CountedEntry | null, controls: PersonalInboxControls | undefined): ConversationCommand[] {
  const { available, togglePin, canMarkUnread, markUnread } = usePersonalActions(controls);
  return useMemo<ConversationCommand[]>(() => {
    if (!entry || !available) return [];
    return [
      { id: "conversation.pin", run: () => togglePin(entry) },
      ...(canMarkUnread(entry) ? [{ id: "conversation.markUnread" as const, run: () => markUnread(entry) }] : []),
    ];
  }, [entry, available, togglePin, canMarkUnread, markUnread]);
}
