"use client";

import { memo, useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { READ_ONLY_THREAD_ROW, ThreadRowProvider, useThreadToolCopy, type ThreadRowContextValue } from "@/components/crm/thread/thread-context";
import { ThreadRowView } from "@/components/crm/thread/ThreadRowView";
import type { InteractiveChoice } from "@/lib/conversations/interactive-message";
import type { ActiveConversation, ConversationMessage } from "@/lib/conversations/types";
import { simSenderLabel, simThreadRow, type SimSenderCopy } from "@/lib/workflows/sim-message";

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

const NO_NODES: ReadonlyMap<string, string> = new Map();
const noNodeLabel = () => undefined;

function useSimSenderCopy(): SimSenderCopy {
  const tChat = useTranslations("workflowDebug.chat");
  const tCrm = useTranslations("crm");
  return useMemo(
    () => ({ customer: tChat("customerSelf"), workflow: tCrm("messageSender.workflow"), agent: tCrm("messageSender.ai") }),
    [tChat, tCrm],
  );
}

function jumpToMessage(messageId: string) {
  document.querySelector(`[data-msg-id="${CSS.escape(messageId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function SimThreadProvider({
  messages,
  onChooseOption,
  nodeIds = NO_NODES,
  nodeLabel = noNodeLabel,
  children,
}: {
  messages: readonly ConversationMessage[];
  onChooseOption?: (choice: InteractiveChoice) => void;
  nodeIds?: ReadonlyMap<string, string>;
  nodeLabel?: (nodeId: string) => string | undefined;
  children: ReactNode;
}) {
  const toolCopy = useThreadToolCopy();
  const senderCopy = useSimSenderCopy();
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
      senderLabel: (message: ConversationMessage) => {
        const nodeId = nodeIds.get(message.id);
        return simSenderLabel(message, nodeId ? nodeLabel(nodeId) : undefined, senderCopy);
      },
    }),
    [messagesById, toolCopy, onChooseOption, nodeIds, nodeLabel, senderCopy],
  );
  return <ThreadRowProvider value={value}>{children}</ThreadRowProvider>;
}

export const SimMessageRow = memo(function SimMessageRow({ message }: { message: ConversationMessage }) {
  const row = useMemo(() => simThreadRow(message), [message]);
  return <ThreadRowView row={row} />;
});

export function SimMessageList({ messages }: { messages: readonly ConversationMessage[] }) {
  return (
    <SimThreadProvider messages={messages}>
      <ol className="space-y-1">
        {messages.map((message) => (
          <li key={message.id}>
            <SimMessageRow message={message} />
          </li>
        ))}
      </ol>
    </SimThreadProvider>
  );
}
