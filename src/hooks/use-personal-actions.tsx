"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";

import type { PersonalInboxControls } from "@/hooks/use-personal-marks";
import {
  isMarkedUnread,
  isPinned,
  rendersUnread,
  type CountedEntry,
  type MarkedEntry,
} from "@/lib/conversations/personal-marks";
import { performReversible } from "@/lib/crm/undoable";

export interface PersonalActions {
  available: boolean;
  isPinned: (entry: MarkedEntry) => boolean;
  rendersUnread: (entry: CountedEntry) => boolean;
  canMarkUnread: (entry: MarkedEntry) => boolean;
  togglePin: (entry: MarkedEntry) => void;
  markUnread: (entry: MarkedEntry) => void;
}

export function usePersonalActions(controls: PersonalInboxControls | undefined): PersonalActions {
  const t = useTranslations("crmInbox.personal");
  const marks = controls?.marks;

  const togglePin = useCallback(
    (entry: MarkedEntry) => {
      if (!controls) return;
      const wasPinned = isPinned(controls.marks, entry);
      void performReversible(
        {
          apply: () => controls.pin(entry, !wasPinned),
          inverse: () => controls.pin(entry, wasPinned),
          labelKey: wasPinned ? "unpinned" : "pinned",
        },
        t,
      );
    },
    [controls, t],
  );

  const canMarkUnread = useCallback(
    (entry: MarkedEntry) => (controls ? !isMarkedUnread(controls.marks, entry) : false),
    [controls],
  );

  const markUnread = useCallback(
    (entry: MarkedEntry) => {
      if (!controls || isMarkedUnread(controls.marks, entry)) return;
      void performReversible(
        {
          apply: () => controls.markUnread(entry),
          inverse: () => controls.clearUnreadMark(entry),
          labelKey: "markedUnread",
        },
        t,
      );
    },
    [controls, t],
  );

  return useMemo<PersonalActions>(
    () => ({
      available: Boolean(controls),
      isPinned: (entry) => (marks ? isPinned(marks, entry) : false),
      rendersUnread: (entry) => (marks ? rendersUnread(entry, marks) : entry.unread_count > 0),
      canMarkUnread,
      togglePin,
      markUnread,
    }),
    [controls, marks, canMarkUnread, togglePin, markUnread],
  );
}
