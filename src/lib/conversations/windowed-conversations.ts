import type {
  ActiveConversation,
  ConversationMessage,
  EntryType,
  WsServerEvent,
} from "./types";

import { resolveAutomationEnabled } from "./automation";
import { isFromContact } from "./direction";
import { readMessageCapabilities } from "./message-actions";
import { readMediaLimits } from "./attachment-rules";
import { mergeSubscribedLead, patchLead, type LeadPatch } from "./lead-patch";
import {
  applyHistoryPage,
  applyLiveMessage,
  applyMessageUpdate,
} from "./thread-merge";
import { windowKey } from "./window-deck";
import { applyWindowReopened } from "./window-reopen";
import { mergeWindowClosed } from "./window-closed";


export interface WindowConversationState {
  conversation: ActiveConversation;
  loadingConversation: boolean;
  loadingHistory: boolean;
  search: WindowMessageSearch | null;
  typingUserIds: string[];
  visible: boolean;
}

export interface WindowMessageSearch {
  query: string;
  results: ConversationMessage[] | null;
  totalItems: number;
  searching: boolean;
}

export type WindowConversations = ReadonlyMap<string, WindowConversationState>;

export interface OpenWindowConversationInput {
  entryId: string;
  entryType: EntryType;
  leadName?: string;
  leadNumber?: string;
  leadPicture?: string;
  windowOpen?: boolean;
  windowExpiresAt?: string | null;
  conversationStatus?: string;
  isGroup?: boolean;
}

export function incomingUnreadIds(messages: ConversationMessage[]): string[] {
  return messages
    .filter((m) => !m.read && isFromContact(m))
    .map((m) => m.id);
}

export function emptyWindowConversations(): WindowConversations {
  return new Map<string, WindowConversationState>();
}

export function windowConversation(
  state: WindowConversations,
  key: string,
): WindowConversationState | null {
  return state.get(key) ?? null;
}

export function openWindowConversation(
  state: WindowConversations,
  input: OpenWindowConversationInput,
): WindowConversations {
  const key = windowKey(input.entryId, input.entryType);
  const existing = state.get(key);

  if (existing) {
    if (existing.conversation.messages.length > 0) {
      return existing.loadingConversation
        ? replace(state, key, { ...existing, loadingConversation: false })
        : state;
    }
    return replace(state, key, { ...existing, loadingConversation: true });
  }

  const conversation: ActiveConversation = {
    entry_id: input.entryId,
    entry_type: input.entryType,
    lead_name: input.leadName ?? "",
    lead_picture: input.leadPicture,
    lead_number: input.leadNumber ?? "",
    messages: [],
    has_more: false,
    unread_count: 0,
    window_open: input.windowOpen ?? false,
    window_expires_at: input.windowExpiresAt ?? null,
    conversation_status: input.conversationStatus,
    is_group: input.isGroup,
  };

  return replace(state, key, {
    conversation,
    loadingConversation: true,
    loadingHistory: false,
    search: null,
    typingUserIds: [],
    visible: true,
  });
}

export function setWindowVisibility(
  state: WindowConversations,
  key: string,
  visible: boolean,
): WindowConversations {
  const w = state.get(key);
  if (!w || w.visible === visible) return state;

  return replace(state, key, {
    ...w,
    visible,
    conversation: visible
      ? { ...w.conversation, unread_count: 0 }
      : w.conversation,
  });
}

export function unreadIdsIn(w: WindowConversationState): string[] {
  return incomingUnreadIds(w.conversation.messages);
}

export function closeWindowConversation(
  state: WindowConversations,
  key: string,
): WindowConversations {
  if (!state.has(key)) return state;
  const next = new Map(state);
  next.delete(key);
  return next;
}

export function markWindowLoadingHistory(
  state: WindowConversations,
  key: string,
): WindowConversations {
  const w = state.get(key);
  if (!w || w.loadingHistory) return state;
  return replace(state, key, { ...w, loadingHistory: true });
}

export function settleWindowHistory(
  state: WindowConversations,
  key: string,
): WindowConversations {
  const w = state.get(key);
  if (!w || !w.loadingHistory) return state;
  return replace(state, key, { ...w, loadingHistory: false });
}

export function startWindowSearch(
  state: WindowConversations,
  key: string,
  query: string,
): WindowConversations {
  const w = state.get(key);
  if (!w) return state;
  return replace(state, key, {
    ...w,
    search: { query, results: null, totalItems: 0, searching: true },
  });
}

export function clearWindowSearch(
  state: WindowConversations,
  key: string,
): WindowConversations {
  const w = state.get(key);
  if (!w || w.search === null) return state;
  return replace(state, key, { ...w, search: null });
}

export function clearWindowLoading(
  state: WindowConversations,
): WindowConversations {
  if (state.size === 0) return state;
  const next = new Map(state);
  for (const [key, w] of next) {
    next.set(key, {
      ...w,
      loadingConversation: false,
      loadingHistory: false,
      search: w.search ? { ...w.search, searching: false } : null,
    });
  }
  return next;
}

function replace(
  state: WindowConversations,
  key: string,
  value: WindowConversationState,
): WindowConversations {
  const next = new Map(state);
  next.set(key, value);
  return next;
}

function update(
  state: WindowConversations,
  entryId: string,
  entryType: EntryType | string,
  updater: (w: WindowConversationState) => WindowConversationState,
): WindowConversations {
  const key = windowKey(entryId, entryType);
  const current = state.get(key);
  if (!current) return state;
  const updated = updater(current);
  return updated === current ? state : replace(state, key, updated);
}

function patchConversation(
  w: WindowConversationState,
  patch: (c: ActiveConversation) => ActiveConversation,
): WindowConversationState {
  const conversation = patch(w.conversation);
  return conversation === w.conversation ? w : { ...w, conversation };
}

export function patchWindowLead(
  state: WindowConversations,
  leadId: string,
  patch: LeadPatch,
): WindowConversations {
  let next: Map<string, WindowConversationState> | null = null;
  for (const [key, w] of state) {
    const patched = patchConversation(w, (c) => patchLead(c, leadId, patch));
    if (patched === w) continue;
    next ??= new Map(state);
    next.set(key, patched);
  }
  return next ?? state;
}

export function applyWindowEvent(
  state: WindowConversations,
  event: WsServerEvent,
): WindowConversations {
  if (state.size === 0) return state;

  switch (event.type) {
    case "conversation:subscribed": {
      const p = event.payload;
      return update(state, p.entry_id, p.entry_type, (w) =>
        patchConversation(w, (c) => mergeSubscribedLead({
          ...c,
          lead_metadata: p.lead_metadata ?? c.lead_metadata,
          unread_count: p.unread_count ?? c.unread_count,
          window_open: p.window_open ?? c.window_open,
          window_expires_at: p.window_expires_at ?? c.window_expires_at,
          ...mergeWindowClosed(p, c),
          window_tier: p.window_tier ?? null,
          message_capabilities: readMessageCapabilities(p.message_capabilities) ?? c.message_capabilities,
          media_limits: readMediaLimits(p.media_limits),
          automation_enabled: resolveAutomationEnabled(
            p.automation_enabled,
            c.automation_enabled,
          ),
        }, p)),
      );
    }

    case "conversation:history": {
      const p = event.payload;
      return update(state, p.entry_id, p.entry_type, (w) =>
        patchConversation(
          { ...w, loadingConversation: false, loadingHistory: false },
          (c) => applyHistoryPage(c, { ...p, messages: p.messages ?? [] }),
        ),
      );
    }

    case "conversation:message_updated": {
      const p = event.payload;
      return update(state, p.entry_id, p.entry_type, (w) =>
        patchConversation(w, (c) => applyMessageUpdate(c, p.message)),
      );
    }

    case "conversation:window_reopened": {
      const p = event.payload;
      return update(state, p.entry_id, p.entry_type, (w) =>
        patchConversation(w, (c) => applyWindowReopened(c, p)),
      );
    }

    case "conversation:search_messages_results": {
      const p = event.payload;
      return update(state, p.entry_id, p.entry_type, (w) => {
        if (!w.search || w.search.query !== p.query) return w;
        return {
          ...w,
          search: {
            query: w.search.query,
            results: p.messages ?? [],
            totalItems: p.total_items,
            searching: false,
          },
        };
      });
    }

    case "conversation:message":
    case "conversation:message_sent": {
      const p = event.payload;
      const incoming =
        event.type === "conversation:message" &&
        incomingUnreadIds([p.message]).length > 0;

      return update(state, p.entry_id, p.entry_type, (w) =>
        patchConversation(w, (c) => {
          const known =
            c.messages.some((m) => m.id === p.message.id) ||
            Boolean(c.held_live?.some((m) => m.id === p.message.id));
          if (known) return c;
          const placed = applyLiveMessage(c, p.message);
          return incoming && !w.visible
            ? { ...placed, unread_count: c.unread_count + 1 }
            : placed;
        }),
      );
    }

    case "conversation:read": {
      const p = event.payload;
      const ids = new Set(p.message_ids);
      return update(state, p.entry_id, p.entry_type, (w) =>
        patchConversation(w, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            ids.has(m.id) ? { ...m, read: true, read_at: p.read_at } : m,
          ),
        })),
      );
    }

    case "conversation:message_status": {
      const p = event.payload;
      return update(state, p.entry_id, p.entry_type, (w) =>
        patchConversation(w, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === p.message_id ? { ...m, delivery_status: p.status } : m,
          ),
        })),
      );
    }

    case "conversation:typing": {
      const p = event.payload;
      return update(state, p.entry_id, p.entry_type, (w) => {
        const present = w.typingUserIds.includes(p.user_id);
        if (p.is_typing === present) return w;
        return {
          ...w,
          typingUserIds: p.is_typing
            ? [...w.typingUserIds, p.user_id]
            : w.typingUserIds.filter((id) => id !== p.user_id),
        };
      });
    }

    case "conversation:entry_update": {
      const entry = event.payload.entry;
      return update(state, entry.entry_id, entry.entry_type, (w) =>
        patchConversation(w, (c) => ({
          ...c,
          lead_name: entry.lead_name || c.lead_name,
          lead_picture: entry.lead_picture || c.lead_picture,
          window_open: entry.window_open ?? c.window_open,
          window_expires_at: entry.window_expires_at ?? c.window_expires_at,
          conversation_status: entry.conversation_status ?? c.conversation_status,
          automation_enabled: resolveAutomationEnabled(
            entry.automation_enabled,
            c.automation_enabled,
          ),
          ai_handler: entry.ai_handler ?? c.ai_handler,
        })),
      );
    }

    case "conversation:conversation_status_update": {
      const p = event.payload;
      return update(state, p.entry_id, p.entry_type, (w) =>
        patchConversation(w, (c) => ({
          ...c,
          conversation_status: p.status ?? c.conversation_status,
        })),
      );
    }

    case "conversation:unsubscribed": {
      const p = event.payload;
      return closeWindowConversation(state, windowKey(p.entry_id, p.entry_type));
    }

    case "conversation:entry_removed": {
      const p = event.payload;
      return closeWindowConversation(state, windowKey(p.entry_id, p.entry_type));
    }

    default:
      return state;
  }
}
