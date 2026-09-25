import {
  isAgentMessage,
  isFromContact,
  messageTypeOf,
} from "@/lib/conversations/direction";
import { senderOf, type SenderKind } from "@/lib/conversations/sender";
import type { ConversationMessage } from "@/lib/conversations/types";

export type MessageMix = {
  customer: number;
  team: number;
  ai: number;
  automation: number;
  media: number;
  tools: number;
};

type Author = "customer" | "team" | "ai" | "automation" | "tools";

const AUTHOR_BY_SENDER: Record<SenderKind, Author | null> = {
  contact: "customer",
  human: "team",
  external: "team",
  ai: "ai",
  workflow: "automation",
  campaign: "automation",
  system: null,
};

const TOOL_TYPES = new Set(["tool_call", "tool_result"]);

function authorOf(message: ConversationMessage): Author | null {
  const messageType = messageTypeOf(message);
  if (messageType && TOOL_TYPES.has(messageType)) return "tools";

  const sender = senderOf(message);
  if (sender) return AUTHOR_BY_SENDER[sender.kind];

  if (messageType === "system") return null;
  if (isFromContact(message)) return "customer";
  if (isAgentMessage(message)) return "ai";
  return "team";
}

function carriesMedia(message: ConversationMessage): boolean {
  return Boolean(message.media_type || message.media_id) || messageTypeOf(message) === "audio";
}

export function messageMix(messages: readonly ConversationMessage[]): MessageMix {
  const mix: MessageMix = { customer: 0, team: 0, ai: 0, automation: 0, media: 0, tools: 0 };
  for (const message of messages) {
    const author = authorOf(message);
    if (author) mix[author] += 1;
    if (carriesMedia(message)) mix.media += 1;
  }
  return mix;
}
