"use client";

import { createContext, useContext, useMemo } from "react";
import { useTranslations } from "next-intl";

import { NO_MESSAGE_ACTIONS_API, type MessageActionsApi } from "@/hooks/use-message-actions";
import type { ThreadPerspective } from "@/lib/conversations/bubble-side";
import type { InteractiveChoice } from "@/lib/conversations/interactive-message";
import type { ToolCopy, ToolDefinitionByName } from "@/lib/conversations/tool-events";
import type { ActiveConversation, ConversationMessage } from "@/lib/conversations/types";

export type ArrivalStart = false | { opacity: number };

export interface ThreadRowContextValue {
  conversation: ActiveConversation;
  messagesById: ReadonlyMap<string, ConversationMessage>;
  matchedIds: ReadonlySet<string>;
  currentMatchId: string | null;
  arrivalStart: (messageId: string) => ArrivalStart;
  canSeekOriginal: boolean;
  onJumpToMessage: (messageId: string) => void;
  onReply?: (message: ConversationMessage) => void;
  onRetrySend?: (requestId: string) => void;
  onResendMessage?: (messageId: string) => void;
  resendingIds: ReadonlySet<string>;
  messageActions?: MessageActionsApi;
  editingId?: string | null;
  onStartEdit?: (messageId: string) => void;
  onStopEdit?: () => void;
  onDeleteNote?: (noteId: string) => void;
  toolDefinitions: ToolDefinitionByName;
  toolCopy: ToolCopy;
  onChooseOption?: (choice: InteractiveChoice) => void;
  perspective?: ThreadPerspective;
  senderLabel?: (message: ConversationMessage) => string;
}

type ResolvedThreadRow = ThreadRowContextValue & {
  perspective: ThreadPerspective;
  messageActions: MessageActionsApi;
  editingId: string | null;
  onStartEdit: (messageId: string) => void;
  onStopEdit: () => void;
  onDeleteNote: (noteId: string) => void;
};

const ThreadRowContext = createContext<ThreadRowContextValue | null>(null);

export const ThreadRowProvider = ThreadRowContext.Provider;

const NO_IDS: ReadonlySet<string> = new Set();
const NO_TOOLS: ToolDefinitionByName = new Map();
const STILL = () => false as const;

export const READ_ONLY_THREAD_ROW: Pick<
  ThreadRowContextValue,
  "matchedIds" | "currentMatchId" | "arrivalStart" | "canSeekOriginal" | "resendingIds" | "toolDefinitions"
> = {
  matchedIds: NO_IDS,
  currentMatchId: null,
  arrivalStart: STILL,
  canSeekOriginal: false,
  resendingIds: NO_IDS,
  toolDefinitions: NO_TOOLS,
};

export function useThreadToolCopy(): ToolCopy {
  const tThread = useTranslations("crmConversation.thread");
  return useMemo<ToolCopy>(
    () => ({
      fallbackName: tThread("tool.fallbackName"),
      resultTitle: tThread("tool.resultTitle"),
      callSubtitle: tThread("tool.callSubtitle"),
      resultSubtitle: tThread("tool.resultSubtitle"),
      callRunning: tThread("tool.callRunning"),
      resultDone: tThread("tool.resultDone"),
      imageSentTo: (recipient) => tThread("tool.imageSentTo", { recipient }),
    }),
    [tThread],
  );
}

function ignore() {}

export function useThreadRow(): ResolvedThreadRow {
  const value = useContext(ThreadRowContext);
  if (!value) throw new Error("thread rows render inside ThreadRowProvider");
  return {
    ...value,
    perspective: value.perspective ?? "business",
    messageActions: value.messageActions ?? NO_MESSAGE_ACTIONS_API,
    editingId: value.editingId ?? null,
    onStartEdit: value.onStartEdit ?? ignore,
    onStopEdit: value.onStopEdit ?? ignore,
    onDeleteNote: value.onDeleteNote ?? ignore,
  };
}
