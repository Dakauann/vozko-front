import { inboxEntryKey } from "./inbox-hold";
import type { InboxEntry, PersonalMark, PersonalMarkEntry } from "./types";

export type PersonalMarks = ReadonlyMap<string, PersonalMark>;

export type MarkedEntry = Pick<InboxEntry, "entry_id" | "entry_type">;

export const NO_PERSONAL_MARKS: PersonalMarks = new Map();

function carriesSomething(mark: PersonalMark | null | undefined): mark is PersonalMark {
  return Boolean(mark?.pinned_at || mark?.unread_marked_at);
}

function compact(mark: PersonalMark): PersonalMark | null {
  const kept: PersonalMark = {};
  if (mark.pinned_at) kept.pinned_at = mark.pinned_at;
  if (mark.unread_marked_at) kept.unread_marked_at = mark.unread_marked_at;
  return carriesSomething(kept) ? kept : null;
}

export function markOf(marks: PersonalMarks, entry: MarkedEntry): PersonalMark | null {
  return marks.get(inboxEntryKey(entry)) ?? null;
}

export function withMark(marks: PersonalMarks, entry: MarkedEntry, mark: PersonalMark | null): PersonalMarks {
  const key = inboxEntryKey(entry);
  const kept = mark ? compact(mark) : null;
  if (!kept && !marks.has(key)) return marks;
  const next = new Map(marks);
  if (kept) next.set(key, kept);
  else next.delete(key);
  return next;
}

export function marksFromPage(
  marks: PersonalMarks,
  pageEntries: readonly MarkedEntry[],
  pageMarks: readonly PersonalMarkEntry[] | undefined,
): PersonalMarks {
  if (!pageMarks) return marks;
  const next = new Map(marks);
  for (const entry of pageEntries) next.delete(inboxEntryKey(entry));
  for (const { entry_id, entry_type, ...mark } of pageMarks) {
    const kept = compact(mark);
    if (kept) next.set(inboxEntryKey({ entry_id, entry_type }), kept);
  }
  return next;
}

export function isPinned(marks: PersonalMarks, entry: MarkedEntry): boolean {
  return Boolean(markOf(marks, entry)?.pinned_at);
}

export function isMarkedUnread(marks: PersonalMarks, entry: MarkedEntry): boolean {
  return Boolean(markOf(marks, entry)?.unread_marked_at);
}

export type CountedEntry = MarkedEntry & Pick<InboxEntry, "unread_count">;

export function rendersUnread(entry: CountedEntry, marks: PersonalMarks): boolean {
  return entry.unread_count > 0 || isMarkedUnread(marks, entry);
}

export function pinnedFirst<T extends MarkedEntry>(entries: readonly T[], marks: PersonalMarks): { pinned: T[]; others: T[] } {
  const pinned: T[] = [];
  const others: T[] = [];
  for (const entry of entries) (isPinned(marks, entry) ? pinned : others).push(entry);
  return { pinned, others };
}

export function pinnedMark(current: PersonalMark | null, pinned: boolean, at: string): PersonalMark | null {
  return compact({ ...current, pinned_at: pinned ? current?.pinned_at || at : undefined });
}

export function unreadMark(current: PersonalMark | null, at: string): PersonalMark | null {
  return compact({ ...current, unread_marked_at: at });
}

export function withoutUnreadMark(current: PersonalMark | null): PersonalMark | null {
  return compact({ ...current, unread_marked_at: undefined });
}

const REFUSAL_CODES = ["not_allowed", "not_found", "invalid", "unsupported"];

export function markRefusalKey(code: string): string {
  return REFUSAL_CODES.includes(code) ? code : "failed";
}
