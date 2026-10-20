"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useSignedInUserId } from "@/contexts/auth-context";
import { useOptionalCrm } from "@/contexts/crm-context";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  NO_MESSAGE_ACTIONS,
  NO_MESSAGE_CAPABILITIES,
  allowedActions,
  lastEditableMessage,
  type MessageActions,
  type MessageCapabilities,
} from "@/lib/conversations/message-actions";
import type { MessageActionRequest } from "@/lib/conversations/message-commands";
import { reactionToSend } from "@/lib/conversations/reactions";
import type { ActiveConversation, ConversationMessage } from "@/lib/conversations/types";

type ConversationRef = Pick<ActiveConversation, "entry_id" | "entry_type" | "message_capabilities">;

export interface MessageActionsApi {
  selfId: string | null;
  actionsFor: (message: ConversationMessage) => MessageActions;
  lastEditable: (messages: readonly ConversationMessage[]) => ConversationMessage | null;
  react: (message: ConversationMessage, emoji: string) => void;
  edit: (message: ConversationMessage, text: string) => void;
  remove: (message: ConversationMessage) => void;
}

function ignore() {}

export const NO_MESSAGE_ACTIONS_API: MessageActionsApi = {
  selfId: null,
  actionsFor: () => NO_MESSAGE_ACTIONS,
  lastEditable: () => null,
  react: ignore,
  edit: ignore,
  remove: ignore,
};

export function useMessageActions(conversation: ConversationRef | null): MessageActionsApi {
  const t = useTranslations("crmMessage.actionError");
  const selfId = useSignedInUserId();
  const { can } = useWorkspace();
  const run = useOptionalCrm()?.runMessageAction;
  const canSend = can("conversations", "send");
  const entryId = conversation?.entry_id ?? "";
  const entryType = conversation?.entry_type;
  const capabilities: MessageCapabilities =
    canSend && run ? (conversation?.message_capabilities ?? NO_MESSAGE_CAPABILITIES) : NO_MESSAGE_CAPABILITIES;

  const actionsFor = useCallback(
    (message: ConversationMessage) => allowedActions(message, capabilities, selfId ?? "", new Date()),
    [capabilities, selfId],
  );

  const lastEditable = useCallback(
    (messages: readonly ConversationMessage[]) => lastEditableMessage(messages, capabilities, selfId ?? "", new Date()),
    [capabilities, selfId],
  );

  const dispatch = useCallback(
    (request: MessageActionRequest) => {
      if (!run?.(request)) toast.error(t("failed"));
    },
    [run, t],
  );

  const react = useCallback(
    (message: ConversationMessage, emoji: string) => {
      if (!entryType) return;
      dispatch({ kind: "react", entryId, entryType, messageId: message.id, emoji: reactionToSend(message.reactions, emoji) });
    },
    [dispatch, entryId, entryType],
  );

  const edit = useCallback(
    (message: ConversationMessage, text: string) => {
      const next = text.trim();
      if (!entryType || !next || next === message.text.trim()) return;
      dispatch({ kind: "edit", entryId, entryType, messageId: message.id, text: next });
    },
    [dispatch, entryId, entryType],
  );

  const remove = useCallback(
    (message: ConversationMessage) => {
      if (!entryType) return;
      dispatch({ kind: "delete", entryId, entryType, messageId: message.id });
    },
    [dispatch, entryId, entryType],
  );

  return useMemo(
    () => ({ selfId, actionsFor, lastEditable, react, edit, remove }),
    [selfId, actionsFor, lastEditable, react, edit, remove],
  );
}
