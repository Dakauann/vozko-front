import type {
  ActiveConversation,
  ConversationMessage,
  EntryType,
  WsServerEvent,
} from "./types";

import { resolveAutomationEnabled } from "./automation";
import { windowKey } from "./window-deck";


export interface WindowConversationState {
  conversation: ActiveConversation;
  loadingConversation: boolean;
  loadingHistory: boolean;
  pendingLoadMore: boolean;
  typingUserIds: string[];
  visible: boolean;
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

const OUTGOING_MESSAGE_TYPES = new Set([
  "operator",
  "ai_response",
  "tool_call",
  "tool_result",
  "system",
]);

export function incomingUnreadIds(messages: ConversationMessage[]): string[] {
  return messages
    .filter((m) => !m.read && !OUTGOING_MESSAGE_TYPES.has(m.message_type))
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
    pendingLoadMore: false,
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

export function markWindowLoadingMore(
  state: WindowConversations,
  key: string,
): WindowConversations {
  const w = state.get(key);
  if (!w) return state;
  return replace(state, key, {
    ...w,
    loadingHistory: true,
    pendingLoadMore: true,
  });
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
      pendingLoadMore: false,
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

export function applyWindowEvent(
  state: WindowConversations,
  event: WsServerEvent,
): WindowConversations {
  if (state.size === 0) return state;

  switch (event.type) {
    case "conversation:subscribed": {
      const p = event.payload;
      return update(state, p.entry_id, p.entry_type, (w) =>
        patchConversation(w, (c) => ({
          ...c,
          lead_name: p.lead_name || c.lead_name,
          lead_number: p.lead_number || c.lead_number,
          lead_picture: p.lead_picture || c.lead_picture,
          lead_metadata: p.lead_metadata ?? c.lead_metadata,
          unread_count: p.unread_count ?? c.unread_count,
          window_open: p.window_open ?? c.window_open,
          window_expires_at: p.window_expires_at ?? c.window_expires_at,
          window_closed_reason: p.window_closed_reason ?? c.window_closed_reason ?? null,
          automation_enabled: resolveAutomationEnabled(
            p.automation_enabled,
            c.automation_enabled,
          ),
        })),
      );
    }

    case "conversation:history": {
      const p = event.payload;
      const batch = p.messages ?? [];
      return update(state, p.entry_id, p.entry_type, (w) => {
        const prepend = w.pendingLoadMore;
        const settled: WindowConversationState = {
          ...w,
          loadingConversation: false,
          loadingHistory: false,
          pendingLoadMore: false,
        };
        return patchConversation(settled, (c) => {
          const messages = prepend
            ? [...batch, ...c.messages]
            : c.messages.length === 0
              ? batch
              : mergeById(c.messages, batch);
          return {
            ...c,
            messages,
            has_more:
              batch.length === 0 && c.messages.length > 0
                ? c.has_more
                : p.has_more,
            ...(p.total !== undefined ? { total: p.total } : {}),
          };
        });
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
          if (c.messages.some((m) => m.id === p.message.id)) return c;
          return {
            ...c,
            messages: [...c.messages, p.message],
            unread_count:
              incoming && !w.visible ? c.unread_count + 1 : c.unread_count,
          };
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

function mergeById(
  existing: ConversationMessage[],
  batch: ConversationMessage[],
): ConversationMessage[] {
  const seen = new Set(existing.map((m) => m.id));
  const additions = batch.filter((m) => !seen.has(m.id));
  if (additions.length === 0) return existing;
  return [...existing, ...additions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}
