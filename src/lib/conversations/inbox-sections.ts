import { pinnedFirst, type PersonalMarks } from "./personal-marks";
import type { InboxEntry } from "./types";

export type InboxSection = "pinned" | "others";

export type InboxListItem = { kind: "header"; section: InboxSection } | { kind: "entry"; entry: InboxEntry };

function rows(entries: readonly InboxEntry[]): InboxListItem[] {
  return entries.map((entry) => ({ kind: "entry", entry }));
}

export function inboxSections(entries: readonly InboxEntry[], marks: PersonalMarks): InboxListItem[] {
  const { pinned, others } = pinnedFirst(entries, marks);
  if (pinned.length === 0) return rows(others);
  const pinnedItems: InboxListItem[] = [{ kind: "header", section: "pinned" }, ...rows(pinned)];
  return others.length === 0 ? pinnedItems : [...pinnedItems, { kind: "header", section: "others" }, ...rows(others)];
}

export function sectionEntries(items: readonly InboxListItem[]): InboxEntry[] {
  return items.flatMap((item) => (item.kind === "entry" ? [item.entry] : []));
}
