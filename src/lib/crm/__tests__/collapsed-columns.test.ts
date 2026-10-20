import { describe, expect, it } from "vitest";

import {
  collapsedColumnsKey,
  parseCollapsedColumns,
  readCollapsedColumns,
  toggleCollapsedColumn,
  writeCollapsedColumns,
} from "../collapsed-columns";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    data,
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
};

describe("collapsed columns key", () => {
  it("is separate per viewer and per board, so one person's layout never leaks to another", () => {
    const a = collapsedColumnsKey("conversation-funnel", "user-1");
    expect(a).not.toBe(collapsedColumnsKey("conversation-funnel", "user-2"));
    expect(a).not.toBe(collapsedColumnsKey("opportunities", "user-1"));
  });

  it("is absent without a signed in viewer, so nothing is stored under a shared key", () => {
    expect(collapsedColumnsKey("opportunities", null)).toBeNull();
    expect(collapsedColumnsKey("opportunities", "")).toBeNull();
  });
});

describe("parsing what was stored", () => {
  it("reads a list of column ids", () => {
    expect(parseCollapsedColumns('["a","b"]')).toEqual(["a", "b"]);
  });

  it("falls back to nothing collapsed on anything malformed", () => {
    expect(parseCollapsedColumns(null)).toEqual([]);
    expect(parseCollapsedColumns("not json")).toEqual([]);
    expect(parseCollapsedColumns('{"a":true}')).toEqual([]);
    expect(parseCollapsedColumns('["a",3]')).toEqual([]);
  });

  it("drops duplicates so a toggle always flips the column", () => {
    expect(parseCollapsedColumns('["a","a"]')).toEqual(["a"]);
  });
});

describe("toggling a column", () => {
  it("collapses an expanded column and expands a collapsed one", () => {
    expect(toggleCollapsedColumn([], "a")).toEqual(["a"]);
    expect(toggleCollapsedColumn(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("storage access", () => {
  it("round trips through storage", () => {
    const storage = memoryStorage();
    writeCollapsedColumns(storage, "k", ["a"]);
    expect(readCollapsedColumns(storage, "k")).toEqual(["a"]);
  });

  it("survives storage that throws on read or write, as in a private window", () => {
    expect(readCollapsedColumns(throwingStorage, "k")).toEqual([]);
    expect(() => writeCollapsedColumns(throwingStorage, "k", ["a"])).not.toThrow();
  });

  it("does nothing without storage", () => {
    expect(readCollapsedColumns(null, "k")).toEqual([]);
    expect(() => writeCollapsedColumns(null, "k", ["a"])).not.toThrow();
  });
});
