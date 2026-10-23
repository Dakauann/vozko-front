"use client";

import { memo, useCallback, useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ChatMessageRow } from "@/components/crm/thread/ChatMessageRow";
import { READ_ONLY_THREAD_ROW, ThreadRowProvider, useThreadToolCopy, type ThreadRowContextValue } from "@/components/crm/thread/thread-context";
import { groupPositions, type GroupPosition } from "@/lib/chat/message-groups";
import type { InteractiveChoice } from "@/lib/conversations/interactive-message";
import type { ActiveConversation, ConversationMessage } from "@/lib/conversations/types";
import { simGroupMember, simSenderLabel, simThreadRow, type SimSenderCopy } from "@/lib/workflows/sim-message";

const SIM_CONVERSATION: ActiveConversation = {
  entry_id: "sim-entry",
  entry_type: "whatsapp",
  lead_name: "",
  lead_number: "",
  messages: [],
  has_more: false,
  unread_count: 0,
  window_open: true,
  window_expires_at: null,
};

const NO_SENDERS: ReadonlyMap<string, string> = new Map();

export type SimSenderLabel = (message: ConversationMessage) => string;

function useSimSenderCopy(): SimSenderCopy {
  const tChat = useTranslations("workflowDebug.chat");
  const tCrm = useTranslations("crm");
  return useMemo(
    () => ({ customer: tChat("customerSelf"), workflow: tCrm("messageSender.workflow"), agent: tCrm("messageSender.ai") }),
    [tChat, tCrm],
  );
}

export function useSimSenderLabel(senders: ReadonlyMap<string, string> = NO_SENDERS): SimSenderLabel {
  const copy = useSimSenderCopy();
  return useCallback((message: ConversationMessage) => simSenderLabel(message, senders.get(message.id), copy), [senders, copy]);
}

function jumpToMessage(messageId: string) {
  document.querySelector(`[data-msg-id="${CSS.escape(messageId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function SimThreadProvider({
  messages,
  onChooseOption,
  senderLabel,
  children,
}: {
  messages: readonly ConversationMessage[];
  onChooseOption?: (choice: InteractiveChoice) => void;
  senderLabel?: SimSenderLabel;
  children: ReactNode;
}) {
  const toolCopy = useThreadToolCopy();
  const fallbackLabel = useSimSenderLabel();
  const label = senderLabel ?? fallbackLabel;
  const messagesById = useMemo(() => new Map(messages.map((message): [string, ConversationMessage] => [message.id, message])), [messages]);
  const value = useMemo<ThreadRowContextValue>(
    () => ({
      ...READ_ONLY_THREAD_ROW,
      conversation: SIM_CONVERSATION,
      messagesById,
      onJumpToMessage: jumpToMessage,
      toolCopy,
      onChooseOption,
      perspective: "customer",
      senderLabel: label,
    }),
    [messagesById, toolCopy, onChooseOption, label],
  );
  return <ThreadRowProvider value={value}>{children}</ThreadRowProvider>;
}

export const SimMessageRow = memo(function SimMessageRow({ message, position = "single" }: { message: ConversationMessage; position?: GroupPosition }) {
  const row = useMemo(() => simThreadRow(message, position), [message, position]);
  return <ChatMessageRow row={row} />;
});

export function SimMessageList({ messages, senders }: { messages: readonly ConversationMessage[]; senders?: ReadonlyMap<string, string> }) {
  const senderLabel = useSimSenderLabel(senders);
  const positions = useMemo(() => groupPositions(messages.map((message) => simGroupMember(message, senderLabel(message)))), [messages, senderLabel]);
  return (
    <SimThreadProvider messages={messages} senderLabel={senderLabel}>
      <ol>
        {messages.map((message, index) => (
          <li key={message.id}>
            <SimMessageRow message={message} position={positions[index] ?? "single"} />
          </li>
        ))}
      </ol>
    </SimThreadProvider>
  );
}
