"use client";

import { useCallback, useState } from "react";

import { readDraft, useDraftScope } from "@/hooks/use-conversation-drafts";
import type { ReplyTarget } from "@/lib/conversations/drafts";

interface EntryReplyState {
  entryKey: string | null;
  reply: ReplyTarget | null;
}

export function useEntryReply(entryKey: string | null) {
  const scope = useDraftScope();
  const [target, setTarget] = useState<EntryReplyState>(() => ({
    entryKey,
    reply: readDraft(scope, entryKey)?.reply ?? null,
  }));

  if (target.entryKey !== entryKey) {
    setTarget({ entryKey, reply: readDraft(scope, entryKey)?.reply ?? null });
  }

  const replyTo = target.entryKey === entryKey ? target.reply : null;

  const reply = useCallback(
    (message: ReplyTarget) => {
      if (entryKey) setTarget({ entryKey, reply: message });
    },
    [entryKey],
  );

  const clearReply = useCallback(() => setTarget((current) => ({ entryKey: current.entryKey, reply: null })), []);

  return { replyTo, reply, clearReply };
}
