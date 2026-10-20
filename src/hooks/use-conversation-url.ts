"use client";

import { useEffect, useRef } from "react";

import {
  needsHistoryEntry,
  readConversationDeepLink,
  withConversationDeepLink,
  type ConversationDeepLink,
} from "@/lib/conversations/deep-link";
import type { EntryType } from "@/lib/conversations/types";

interface ConversationUrlOptions {
  enabled: boolean;
  entryId: string | null;
  entryType: EntryType | null;
  onNavigate: (link: ConversationDeepLink | null) => void;
}

export function useConversationUrl({ enabled, entryId, entryType, onNavigate }: ConversationUrlOptions) {
  const previousRef = useRef<ConversationDeepLink | null | undefined>(undefined);
  const onNavigateRef = useRef(onNavigate);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  });

  useEffect(() => {
    if (!enabled) {
      previousRef.current = undefined;
      return;
    }
    const current = entryId && entryType ? { entryId, entryType } : null;
    const previous = previousRef.current;
    previousRef.current = current;
    if (previous === undefined) return;
    const { pathname, search, hash } = window.location;
    if (!needsHistoryEntry({ previous, current, inUrl: readConversationDeepLink(search) })) return;
    window.history.pushState(null, "", `${pathname}${withConversationDeepLink(search, current)}${hash}`);
  }, [enabled, entryId, entryType]);

  useEffect(() => {
    if (!enabled) return;
    const followHistory = () => onNavigateRef.current(readConversationDeepLink(window.location.search));
    window.addEventListener("popstate", followHistory);
    return () => window.removeEventListener("popstate", followHistory);
  }, [enabled]);
}
