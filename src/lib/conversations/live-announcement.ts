import { isFromContact } from "./direction";
import { mediaLabelKey, type MediaLabelKey } from "./thread-labels";
import type { ConversationMessage } from "./types";

export const ANNOUNCE_GAP_MS = 4000;

const PREVIEW_LIMIT = 80;
const ELLIPSIS = "...";

export interface Announcement {
  count: number;
  sender: string | null;
  preview: string | null;
  mediaKey: MediaLabelKey | null;
}

export interface AnnouncerState {
  lastAt: number;
  pending: readonly ConversationMessage[];
}

export interface AnnouncementPlan {
  state: AnnouncerState;
  announce: Announcement | null;
  flushAt: number | null;
}

export const idleAnnouncer: AnnouncerState = { lastAt: Number.NEGATIVE_INFINITY, pending: [] };

function senderNameOf(message: ConversationMessage): string {
  return message.sender_name?.trim() || message.from;
}

function previewOf(text: string | undefined): string | null {
  const collapsed = (text ?? "").replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  if (collapsed.length <= PREVIEW_LIMIT) return collapsed;
  return `${collapsed.slice(0, PREVIEW_LIMIT - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`;
}

export function announcementFor(messages: readonly ConversationMessage[]): Announcement | null {
  const inbound = messages.filter(isFromContact);
  const last = inbound[inbound.length - 1];
  if (!last) return null;
  const senders = new Set(inbound.map(senderNameOf));
  const preview = previewOf(last.text);
  return {
    count: inbound.length,
    sender: senders.size === 1 ? senderNameOf(last) : null,
    preview,
    mediaKey: preview === null && last.media_type ? mediaLabelKey(last.media_type) : null,
  };
}

export function planAnnouncement(
  state: AnnouncerState,
  arrived: readonly ConversationMessage[],
  now: number,
): AnnouncementPlan {
  const inbound = arrived.filter(isFromContact);
  if (inbound.length === 0 && state.pending.length === 0) return { state, announce: null, flushAt: null };

  const pending = [...state.pending, ...inbound];
  const readyAt = state.lastAt + ANNOUNCE_GAP_MS;
  if (now < readyAt) return { state: { lastAt: state.lastAt, pending }, announce: null, flushAt: readyAt };

  return { state: { lastAt: now, pending: [] }, announce: announcementFor(pending), flushAt: null };
}
