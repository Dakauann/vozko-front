import { normalizeWireMessage } from "@/lib/conversations/message-wire";
import type { ActiveConversation, ConversationMessage } from "@/lib/conversations/types";

import type { GroupFeedMessage, GroupMessagesPage } from "./types";

export interface FeedLabels {
  ourTeam: string;
  unknown: string;
}

export function toThreadMessage(message: GroupFeedMessage, labels: FeedLabels): ConversationMessage {
  const normalized = normalizeWireMessage({
    ...message,
    entryType: "unofficial_whatsapp",
    sentBy: null,
    senderName: message.ourTeam ? labels.ourTeam : message.senderName || labels.unknown,
    edited_at: message.editedAt,
    retracted_at: message.retractedAt,
    transcript: message.transcript,
  });
  return { ...normalized, sent_by: null };
}

export function feedConversation(conversationId: string): ActiveConversation {
  return {
    entry_id: conversationId,
    entry_type: "unofficial_whatsapp",
    lead_name: "",
    lead_number: "",
    messages: [],
    has_more: false,
    unread_count: 0,
    window_open: false,
    window_expires_at: null,
    is_group: true,
  };
}

export interface FeedState {
  phase: "loading" | "ready" | "failed";
  messages: GroupFeedMessage[];
  nextBefore: string | null;
  loadingOlder: boolean;
  olderFailed: boolean;
}

export type FeedEvent =
  | { type: "refresh" }
  | { type: "latest"; page: GroupMessagesPage }
  | { type: "latest-failed" }
  | { type: "older-start" }
  | { type: "older"; page: GroupMessagesPage }
  | { type: "older-failed" };

export const initialFeed: FeedState = { phase: "loading", messages: [], nextBefore: null, loadingOlder: false, olderFailed: false };

function cursorOf(page: GroupMessagesPage): string | null {
  return page.hasMore && page.nextBefore ? page.nextBefore : null;
}

function prependOlder(current: GroupFeedMessage[], older: GroupFeedMessage[]): GroupFeedMessage[] {
  const known = new Set(current.map((m) => m.id));
  return [...older.filter((m) => !known.has(m.id)), ...current];
}

export function feedReducer(state: FeedState, event: FeedEvent): FeedState {
  switch (event.type) {
    case "refresh":
      return initialFeed;
    case "latest":
      return { ...initialFeed, phase: "ready", messages: event.page.messages, nextBefore: cursorOf(event.page) };
    case "latest-failed":
      return { ...initialFeed, phase: "failed" };
    case "older-start":
      if (state.phase !== "ready" || state.loadingOlder || !state.nextBefore) return state;
      return { ...state, loadingOlder: true, olderFailed: false };
    case "older":
      return {
        ...state,
        messages: prependOlder(state.messages, event.page.messages),
        nextBefore: cursorOf(event.page),
        loadingOlder: false,
      };
    case "older-failed":
      return { ...state, loadingOlder: false, olderFailed: true };
  }
}

export function atHistoryStart(state: FeedState): boolean {
  return state.phase === "ready" && state.nextBefore === null && state.messages.length > 0;
}
