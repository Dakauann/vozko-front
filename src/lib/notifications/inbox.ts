import type { NotificationCategory, NotificationItem, NotificationPage, NotificationSummary } from "./types";

export type NotificationCategoryFilter = NotificationCategory | "all";

export interface NotificationFilter {
  category: NotificationCategoryFilter;
  unreadOnly: boolean;
}

export type ReadChange = "read" | "unread";

export function isUnread(item: NotificationItem): boolean {
  return !item.readAt;
}

export function matchesFilter(item: NotificationItem, filter: NotificationFilter): boolean {
  if (filter.category !== "all" && item.category !== filter.category) return false;
  return !filter.unreadOnly || isUnread(item);
}

function withReadAt(item: NotificationItem, readAt: string | null): NotificationItem {
  if (readAt) return { ...item, readAt };
  const unread = { ...item };
  delete unread.readAt;
  return unread;
}

function mapItems(pages: NotificationPage[], change: (item: NotificationItem) => NotificationItem): NotificationPage[] {
  return pages.map((page) => ({ ...page, items: page.items.map(change) }));
}

export function pagesAfterReadChange(pages: NotificationPage[], ids: ReadonlySet<string>, readAt: string | null): NotificationPage[] {
  return mapItems(pages, (item) => (ids.has(item.id) ? withReadAt(item, readAt) : item));
}

export function pagesAfterAllRead(pages: NotificationPage[], category: NotificationCategory | null, readAt: string): NotificationPage[] {
  return mapItems(pages, (item) => (isUnread(item) && (category === null || item.category === category) ? withReadAt(item, readAt) : item));
}

export function pagesAfterArrival<T extends { id: string }, P extends { items: T[]; next: string }>(pages: P[], item: T): P[] {
  if (pages.some((page) => page.items.some((entry) => entry.id === item.id))) return pages;
  if (pages.length === 0) return [{ items: [item], next: "" } as P];
  const [first, ...rest] = pages;
  return [{ ...first, items: [item, ...first.items] }, ...rest];
}

function shifted(summary: NotificationSummary, category: NotificationCategory, delta: number): NotificationSummary {
  return {
    ...summary,
    unread: Math.max(0, summary.unread + delta),
    byCategory: { ...summary.byCategory, [category]: Math.max(0, (summary.byCategory[category] ?? 0) + delta) },
  };
}

export function summaryAfterReadChange(summary: NotificationSummary, items: NotificationItem[], change: ReadChange): NotificationSummary {
  const affected = items.filter((item) => isUnread(item) === (change === "read"));
  const delta = change === "read" ? -1 : 1;
  return affected.reduce((next, item) => shifted(next, item.category, delta), summary);
}

export function summaryAfterAllRead(summary: NotificationSummary, category: NotificationCategory | null): NotificationSummary {
  if (category === null) return { unread: 0, byCategory: {}, capped: false };
  return shifted(summary, category, -(summary.byCategory[category] ?? 0));
}

export function summaryAfterArrival(summary: NotificationSummary, item: NotificationItem): NotificationSummary {
  return isUnread(item) ? shifted(summary, item.category, 1) : summary;
}
