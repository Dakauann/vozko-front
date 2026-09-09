import type {
  ActiveConversation,
  ConversationMessage,
  EntryType,
  WsServerEvent,
} from "./types";

import { resolveAutomationEnabled } from "./automation";
import { windowKey } from "./window-deck";

/**
 * Transcript state for the conversations open in floating windows.
 *
 * The centre pane keeps its own single `activeConversation` in the socket hook;
 * this is the parallel store for every conversation opened BESIDE it. Both are
 * fed by the same frames, and every frame the server sends is entry-addressed,
 * so routing is a map lookup rather than a "is this the current one?" guard.
 *
 * Pure and socket-free on purpose: the fiddly parts of a live thread — the
 * three ways a history batch can land, duplicate suppression, per-entry typing
 * — are the parts worth testing without a WebSocket in the room.
 */

export interface WindowConversationState {
  conversation: ActiveConversation;
  /** The first batch after subscribing is still in flight (thread skeleton). */
  loadingConversation: boolean;
  /** An older page is in flight (scroll-up spinner). */
  loadingHistory: boolean;
  /** The next history batch is an older page, so it prepends. */
  pendingLoadMore: boolean;
  typingUserIds: string[];
  /**
   * Whether the operator can actually SEE this conversation.
   *
   * False while the window is parked in the dock. It is what separates "open"
   * from "being read": a minimized window keeps its subscription and keeps
   * receiving, but nobody is looking at it, so its messages must not be
   * receipted as read and they count towards its unread badge instead.
   */
  visible: boolean;
}

export type WindowConversations = ReadonlyMap<string, WindowConversationState>;

export interface OpenWindowConversationInput {
  entryId: string;
  entryType: EntryType;
  leadName?: string;
  leadNumber?: string;
  /** Seeded from the inbox row so the window opens with the same face. */
  leadPicture?: string;
  windowOpen?: boolean;
  windowExpiresAt?: string | null;
  conversationStatus?: string;
  isGroup?: boolean;
}

/**
 * Message types the operator's own side produced. An outgoing message is never
 * "unread" for us, so it never joins a mark_read batch.
 */
const OUTGOING_MESSAGE_TYPES = new Set([
  "operator",
  "ai_response",
  "tool_call",
  "tool_result",
  "system",
]);

/** The inbound messages in a batch that still need a read receipt. */
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

  // Reopening a window we still hold keeps its transcript: re-fetching a thread
  // the operator just closed would blank a conversation they can already read.
  // And with messages already on screen there is nothing to wait for, so the
  // skeleton stays down rather than covering a readable thread.
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

/**
 * Parks or restores a window's VISIBILITY, which is what decides whether its
 * messages are being read.
 *
 * Restoring clears the badge: the operator is now looking at the thread, and
 * the caller sends the read receipts that go with it.
 */
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

/** The messages in a window that still need a read receipt. */
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

/** Clears in-flight flags for every window; used when the socket drops. */
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

/**
 * Folds one server frame into the open windows.
 *
 * Messages arriving here are expected to be normalized already — the hook owns
 * the wire-shape translation and this module owns the thread semantics.
 */
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
          // Only when the server actually names one: an absent picture in a
          // later frame means "unchanged", not "this contact has no face".
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
            // A window asks for its transcript twice (the subscribe reply and
            // an explicit load_history), and one of those answers can come back
            // empty because the server already sent those ids to this socket.
            // An empty answer says nothing about whether older pages exist, so
            // it must not retract a "there is more" we were already told.
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
            // Arriving at a PARKED window is what an unread badge is for.
            // A visible window is being read, and its receipt is sent
            // instead, so counting there would show a badge on a thread the
            // operator is looking at.
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

    /**
     * The conversation left this operator's scope — it was assigned to someone
     * else, and they may no longer see it.
     *
     * The server decides who gets this: never the person it was assigned to,
     * and never anyone holding `conversations:view_others`, so a supervisor or
     * workspace admin keeps their window. For everyone else the window closes,
     * exactly as the row vanishes from their inbox. Leaving it open would keep
     * a live thread on screen that its owner can no longer reply in.
     */
    case "conversation:entry_removed": {
      const p = event.payload;
      return closeWindowConversation(state, windowKey(p.entry_id, p.entry_type));
    }

    default:
      return state;
  }
}

/**
 * A batch that is neither the first page nor an older page: the server replayed
 * a thread we already hold (a resubscribe after a reconnect). Keep what is on
 * screen, add whatever is genuinely new, and put it back in time order.
 */
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
