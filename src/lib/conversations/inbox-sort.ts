import type { InboxSort } from "./types";

export const INBOX_SORTS: readonly InboxSort[] = ["recent", "waiting"];

export const DEFAULT_INBOX_SORT: InboxSort = "recent";

const KEY_PREFIX = "crm.inbox.sort";

export function inboxSortKey(viewerId: string | null): string | null {
  return viewerId ? `${KEY_PREFIX}.${viewerId}` : null;
}

function isInboxSort(value: unknown): value is InboxSort {
  return typeof value === "string" && (INBOX_SORTS as readonly string[]).includes(value);
}

export function readInboxSort(storage: Pick<Storage, "getItem"> | null, key: string | null): InboxSort {
  if (!key) return DEFAULT_INBOX_SORT;
  try {
    const stored = storage?.getItem(key);
    return isInboxSort(stored) ? stored : DEFAULT_INBOX_SORT;
  } catch {
    return DEFAULT_INBOX_SORT;
  }
}

export function writeInboxSort(storage: Pick<Storage, "setItem"> | null, key: string, sort: InboxSort): void {
  try {
    storage?.setItem(key, sort);
  } catch {
    return;
  }
}
