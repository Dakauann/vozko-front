const KEY_PREFIX = "crm.kanban.collapsed";

export type CollapsedColumnsBoard = "conversation-funnel" | "opportunities";

export function collapsedColumnsKey(
  board: CollapsedColumnsBoard,
  viewerId: string | null,
): string | null {
  return viewerId ? `${KEY_PREFIX}.${board}.${viewerId}` : null;
}

export function parseCollapsedColumns(raw: string | null): string[] {
  if (!raw) return [];
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(decoded) || !decoded.every((id) => typeof id === "string")) return [];
  return [...new Set(decoded as string[])];
}

export function toggleCollapsedColumn(list: readonly string[], columnId: string): string[] {
  return list.includes(columnId) ? list.filter((id) => id !== columnId) : [...list, columnId];
}

export function readCollapsedColumns(
  storage: Pick<Storage, "getItem"> | null,
  key: string,
): string[] {
  try {
    return parseCollapsedColumns(storage?.getItem(key) ?? null);
  } catch {
    return [];
  }
}

export function writeCollapsedColumns(
  storage: Pick<Storage, "setItem"> | null,
  key: string,
  list: readonly string[],
): void {
  try {
    storage?.setItem(key, JSON.stringify(list));
  } catch {
    return;
  }
}
