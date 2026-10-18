import type { GroupActivity, GroupRow, GroupSort, PageMeta } from "./types";

export interface ListStats {
  followed: number;
  members: number;
  net: number;
  messages: number;
  highAlertGroups: number;
  withoutPoster: number;
  unsyncedMembers: number;
}

export const PAGE_SIZES = [25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 50;

export type ServerSortColumn = "group" | "members";

export type ClientSortColumn = "net" | "messages" | "analysis" | "numbers" | "lastActivity";

export type SortDirection = "asc" | "desc";

export interface ClientSort {
  key: ClientSortColumn;
  direction: SortDirection;
}

export interface ColumnSort {
  key: ServerSortColumn | ClientSortColumn;
  direction: SortDirection;
}

export function netGrowth(activity: GroupActivity): number {
  return activity.joins - activity.leaves;
}

export function postingCount(row: Pick<GroupRow, "numbers">): number {
  return row.numbers.filter((seat) => seat.canPost).length;
}

export function seatsNeedAttention(row: Pick<GroupRow, "numbers">): boolean {
  return postingCount(row) === 0 || row.numbers.some((seat) => !seat.connected);
}

export function lastActivityOf(row: Pick<GroupRow, "activity" | "group">): string | undefined {
  return row.activity.lastActivity ?? row.group.lastActivityAt;
}

export function listStats(rows: GroupRow[]): ListStats {
  return rows.reduce<ListStats>(
    (stats, row) => ({
      followed: stats.followed + (row.group.followedAt ? 1 : 0),
      members: stats.members + row.group.memberCount,
      net: stats.net + netGrowth(row.activity),
      messages: stats.messages + row.activity.messages,
      highAlertGroups: stats.highAlertGroups + ((row.summary?.highAlertPct ?? 0) > 0 ? 1 : 0),
      withoutPoster: stats.withoutPoster + (postingCount(row) === 0 ? 1 : 0),
      unsyncedMembers: stats.unsyncedMembers + (row.group.membersSyncedAt ? 0 : 1),
    }),
    { followed: 0, members: 0, net: 0, messages: 0, highAlertGroups: 0, withoutPoster: 0, unsyncedMembers: 0 },
  );
}

export function maxMessages(rows: GroupRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.activity.messages), 1);
}

export function pageWithinTotal(page: number, meta: PageMeta, itemsOnPage: number): number | null {
  const lastPage = Math.max(1, meta.totalPages);
  if (itemsOnPage > 0 || page <= lastPage) return null;
  return lastPage;
}

export function parsePageSize(value: number): PageSize {
  return (PAGE_SIZES as readonly number[]).includes(value) ? (value as PageSize) : DEFAULT_PAGE_SIZE;
}

export function columnSort(sort: GroupSort, client: ClientSort | null): ColumnSort | null {
  if (client) return client;
  if (sort === "name") return { key: "group", direction: "asc" };
  if (sort === "name_desc") return { key: "group", direction: "desc" };
  if (sort === "members") return { key: "members", direction: "desc" };
  return null;
}

export function toggleServerSort(column: ServerSortColumn, current: GroupSort): GroupSort {
  if (column === "members") return "members";
  return current === "name" ? "name_desc" : "name";
}

export function toggleClientSort(column: ClientSortColumn, current: ClientSort | null): ClientSort {
  if (current?.key === column) return { key: column, direction: current.direction === "desc" ? "asc" : "desc" };
  return { key: column, direction: "desc" };
}

function sortValue(row: GroupRow, key: ClientSortColumn): number | null {
  switch (key) {
    case "net":
      return netGrowth(row.activity);
    case "messages":
      return row.activity.messages;
    case "analysis":
      return row.summary ? row.summary.positivity : null;
    case "numbers":
      return postingCount(row);
    case "lastActivity": {
      const at = lastActivityOf(row);
      const time = at ? Date.parse(at) : Number.NaN;
      return Number.isNaN(time) ? null : time;
    }
  }
}

export function sortRows(rows: GroupRow[], sort: ClientSort | null): GroupRow[] {
  if (!sort) return rows;
  const sign = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: sortValue(row, sort.key) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.index - b.index;
        return a.value === null ? 1 : -1;
      }
      return a.value === b.value ? a.index - b.index : (a.value - b.value) * sign;
    })
    .map((entry) => entry.row);
}

export function keepSelectedRows(previous: ReadonlyMap<string, GroupRow>, keys: ReadonlySet<string>, pageRows: GroupRow[]): Map<string, GroupRow> {
  const onPage = new Map(pageRows.map((row) => [row.group.id, row]));
  const next = new Map<string, GroupRow>();
  for (const key of keys) {
    const row = onPage.get(key) ?? previous.get(key);
    if (row) next.set(key, row);
  }
  return next;
}
