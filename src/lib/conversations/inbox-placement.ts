import type { InboxEntry, InboxSort } from "./types";

export type InboxPlacement = (entries: InboxEntry[], updated: InboxEntry) => InboxEntry[];

function timeOf(iso: string | undefined): number | null {
  const time = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(time) ? null : time;
}

function activityTime(entry: InboxEntry): number {
  return timeOf(entry.last_message_at) ?? Number.NEGATIVE_INFINITY;
}

function sameEntry(a: InboxEntry, b: InboxEntry): boolean {
  return a.entry_id === b.entry_id && a.entry_type === b.entry_type;
}

function replaceAt(entries: InboxEntry[], index: number, updated: InboxEntry): InboxEntry[] {
  const next = [...entries];
  next[index] = updated;
  return next;
}

function withoutIndex(entries: InboxEntry[], index: number): InboxEntry[] {
  return index === -1 ? entries : [...entries.slice(0, index), ...entries.slice(index + 1)];
}

export function placeByRecency(entries: InboxEntry[], updated: InboxEntry): InboxEntry[] {
  const index = entries.findIndex((entry) => sameEntry(entry, updated));
  if (index !== -1 && activityTime(updated) <= activityTime(entries[index])) {
    return replaceAt(entries, index, updated);
  }
  return [updated, ...withoutIndex(entries, index)];
}

function compareByWaiting(a: InboxEntry, b: InboxEntry): number {
  const aSince = timeOf(a.waiting_since);
  const bSince = timeOf(b.waiting_since);
  if (aSince !== null && bSince !== null) return aSince - bSince;
  if (aSince !== null) return -1;
  if (bSince !== null) return 1;
  return activityTime(b) - activityTime(a);
}

export function placeByWaiting(entries: InboxEntry[], updated: InboxEntry): InboxEntry[] {
  const index = entries.findIndex((entry) => sameEntry(entry, updated));
  if (index !== -1 && compareByWaiting(entries[index], updated) === 0) {
    return replaceAt(entries, index, updated);
  }
  const rest = withoutIndex(entries, index);
  const position = rest.findIndex((entry) => compareByWaiting(updated, entry) < 0);
  return position === -1 ? [...rest, updated] : [...rest.slice(0, position), updated, ...rest.slice(position)];
}

export function placementFor(sort: InboxSort | undefined): InboxPlacement {
  return sort === "waiting" ? placeByWaiting : placeByRecency;
}
