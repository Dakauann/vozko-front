export type InboxStatusTab = "all" | "new" | "ongoing" | "finished";

export interface InboxEmptyInput {
  query: string;
  filterCount: number;
  status: InboxStatusTab;
  blockedByDepartment: boolean;
}

export type InboxEmptyState =
  | { kind: "search"; action: "clearSearch" }
  | { kind: "filters"; action: "clearFilters" }
  | { kind: "department"; action: null }
  | { kind: Exclude<InboxStatusTab, "all">; action: "showActive" }
  | { kind: "none"; action: null };

export function inboxEmptyState({ query, filterCount, status, blockedByDepartment }: InboxEmptyInput): InboxEmptyState {
  if (query.trim()) return { kind: "search", action: "clearSearch" };
  if (filterCount > 0) return { kind: "filters", action: "clearFilters" };
  if (blockedByDepartment) return { kind: "department", action: null };
  if (status !== "all") return { kind: status, action: "showActive" };
  return { kind: "none", action: null };
}
