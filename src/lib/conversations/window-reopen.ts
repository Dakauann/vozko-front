import type { ActiveConversation, EntryType, WsWindowReopenedPayload } from "./types";

export function reopensWithTemplate(entryType: EntryType | string): boolean {
  return entryType === "whatsapp";
}

export function applyWindowReopened<T extends ActiveConversation>(conversation: T, reopened: WsWindowReopenedPayload): T {
  return {
    ...conversation,
    window_open: true,
    window_expires_at: reopened.window_expires_at ?? conversation.window_expires_at,
    window_closed_reason: null,
    window_closed_detail: null,
  };
}
