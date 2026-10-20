import { inboxEntryKey } from "./inbox-hold";
import type { InboxEntry } from "./types";

type EntryPatch = (entry: InboxEntry) => InboxEntry;

function matches(entry: InboxEntry, entryId: string, entryType: string): boolean {
  return entry.entry_id === entryId && entry.entry_type === entryType;
}

export function patchEntries(entries: InboxEntry[], entryId: string, entryType: string, patch: EntryPatch): InboxEntry[] {
  return entries.map((entry) => (matches(entry, entryId, entryType) ? patch(entry) : entry));
}

export function patchColumns<C extends { entries?: InboxEntry[] }>(
  columns: Map<string, C>,
  entryId: string,
  entryType: string,
  patch: EntryPatch,
): Map<string, C> {
  let changed = false;
  const next = new Map(columns);
  for (const [stageId, column] of columns) {
    if (!column?.entries?.some((entry) => matches(entry, entryId, entryType))) continue;
    changed = true;
    next.set(stageId, { ...column, entries: patchEntries(column.entries, entryId, entryType, patch) });
  }
  return changed ? next : columns;
}

export function clearUnreadCounts(
  entries: InboxEntry[],
  read: readonly Pick<InboxEntry, "entry_id" | "entry_type">[],
): InboxEntry[] {
  const keys = new Set(read.map(inboxEntryKey));
  let changed = false;
  const next = entries.map((entry) => {
    if (entry.unread_count === 0 || !keys.has(inboxEntryKey(entry))) return entry;
    changed = true;
    return { ...entry, unread_count: 0 };
  });
  return changed ? next : entries;
}
