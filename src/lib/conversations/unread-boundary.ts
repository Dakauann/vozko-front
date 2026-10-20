import { isFromContact } from "./direction";
import type { ConversationMessage } from "./types";

export interface UnreadBoundary {
  threadKey: string | null;
  settled: boolean;
  messageId: string | null;
}

export const noUnreadBoundary: UnreadBoundary = { threadKey: null, settled: false, messageId: null };

function firstUnreadFromContact(messages: readonly ConversationMessage[]): string | null {
  return messages.find((message) => !message.read && isFromContact(message))?.id ?? null;
}

export function trackUnreadBoundary(
  previous: UnreadBoundary,
  threadKey: string | null,
  messages: readonly ConversationMessage[],
  loading: boolean,
): UnreadBoundary {
  const current = previous.threadKey === threadKey ? previous : { threadKey, settled: false, messageId: null };
  if (current.settled || loading) return current;
  if (messages.length > 0) return { threadKey, settled: true, messageId: firstUnreadFromContact(messages) };
  if (threadKey !== null) return { threadKey, settled: true, messageId: null };
  return current;
}
