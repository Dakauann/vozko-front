import { describe, expect, it } from "vitest";

import { DEFAULT_INBOX_SORT, inboxSortKey, readInboxSort, writeInboxSort } from "./inbox-sort";

function memory(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as Storage;
}

describe("the remembered inbox sort", () => {
  it("is kept per viewer", () => {
    const storage = memory();
    writeInboxSort(storage, inboxSortKey("ana")!, "waiting");
    expect(readInboxSort(storage, inboxSortKey("ana"))).toBe("waiting");
    expect(readInboxSort(storage, inboxSortKey("bruno"))).toBe(DEFAULT_INBOX_SORT);
  });

  it("falls back to the most recent first for unknown values, missing viewers and failing storage", () => {
    const storage = memory();
    storage.setItem(inboxSortKey("ana")!, "sideways");
    expect(readInboxSort(storage, inboxSortKey("ana"))).toBe("recent");
    expect(readInboxSort(storage, null)).toBe("recent");
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    expect(readInboxSort(broken, inboxSortKey("ana"))).toBe("recent");
    expect(() => writeInboxSort(broken, inboxSortKey("ana")!, "waiting")).not.toThrow();
  });
});
