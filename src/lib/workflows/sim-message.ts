import { isOutgoingMessage } from "@/lib/conversations/direction";
import { normalizeWireMessage } from "@/lib/conversations/message-wire";
import { senderOf } from "@/lib/conversations/sender";
import type { ThreadRow } from "@/lib/conversations/thread-rows";
import type { ConversationMessage } from "@/lib/conversations/types";

export function payloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

export function simConversationMessage(wire: unknown): ConversationMessage | undefined {
  const fields = payloadRecord(wire);
  if (typeof fields.id !== "string" || fields.id === "") return undefined;
  return normalizeWireMessage(fields);
}

export function simThreadRow(message: ConversationMessage): Extract<ThreadRow, { kind: "message" }> {
  return {
    kind: "message",
    key: message.id,
    message,
    outgoing: isOutgoingMessage(message),
    groupPosition: "single",
    channelRunStart: false,
    runGap: false,
  };
}

export interface SimSenderCopy {
  customer: string;
  workflow: string;
  agent: string;
}

export function simSenderLabel(message: ConversationMessage, nodeLabel: string | undefined, copy: SimSenderCopy): string {
  if (!isOutgoingMessage(message)) return copy.customer;
  if (senderOf(message)?.kind === "ai") return message.sender_name?.trim() || nodeLabel || copy.agent;
  return nodeLabel || copy.workflow;
}
