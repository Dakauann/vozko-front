import type { InboxEntry } from "./types";

function activityTime(entry: InboxEntry): number {
  const time = entry.last_message_at ? Date.parse(entry.last_message_at) : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function hasNewerActivity(current: InboxEntry, updated: InboxEntry): boolean {
  return activityTime(updated) > activityTime(current);
}

export function placeUpdatedEntry(entries: InboxEntry[], updated: InboxEntry): InboxEntry[] {
  const index = entries.findIndex(
    (entry) => entry.entry_id === updated.entry_id && entry.entry_type === updated.entry_type,
  );
  if (index === -1) {
    return [updated, ...entries];
  }
  if (!hasNewerActivity(entries[index], updated)) {
    const next = [...entries];
    next[index] = updated;
    return next;
  }
  return [updated, ...entries.slice(0, index), ...entries.slice(index + 1)];
}
