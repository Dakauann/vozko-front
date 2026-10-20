import type { EntryType } from "./types";

export type HistoryAnchor = { messageId: string } | { timestamp: string };

const WIDE_PAGE = 100;
const PAST_EVERY_MESSAGE_MS = 24 * 60 * 60 * 1000;

function target(entryId: string, entryType: EntryType | string) {
  return { entry_id: entryId, entry_type: entryType };
}

export function loadAroundPayload(entryId: string, entryType: EntryType | string, anchor: HistoryAnchor) {
  return "messageId" in anchor
    ? { ...target(entryId, entryType), message_id: anchor.messageId }
    : { ...target(entryId, entryType), timestamp: anchor.timestamp };
}

export function presentPayload(entryId: string, entryType: EntryType | string, now: Date) {
  return {
    ...target(entryId, entryType),
    timestamp: new Date(now.getTime() + PAST_EVERY_MESSAGE_MS).toISOString(),
    page_size: WIDE_PAGE,
  };
}

export function loadAfterPayload(entryId: string, entryType: EntryType | string, after: string) {
  return { ...target(entryId, entryType), after, page_size: WIDE_PAGE };
}
