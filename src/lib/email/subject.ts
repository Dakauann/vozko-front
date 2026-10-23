import type { ConversationMessage } from "@/lib/conversations/types";

function subjectOf(message: Pick<ConversationMessage, "metadata">): string | null {
  const value = (message.metadata as Record<string, unknown> | undefined)?.email_subject;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function latestEmailSubject(messages: readonly Pick<ConversationMessage, "metadata">[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const subject = subjectOf(messages[index]);
    if (subject !== null) return subject;
  }
  return null;
}
