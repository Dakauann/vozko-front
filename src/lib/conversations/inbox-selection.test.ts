import { describe, expect, it } from "vitest";

import { keepListed, pickRange } from "./inbox-selection";

const keys = ["a", "b", "c", "d", "e"];

describe("picking rows in the inbox", () => {
  it("adds every row between the anchor and the clicked row, in either direction", () => {
    expect([...pickRange(keys, new Set(["a"]), "b", "d")].sort()).toEqual(["a", "b", "c", "d"]);
    expect([...pickRange(keys, new Set(), "d", "b")].sort()).toEqual(["b", "c", "d"]);
  });

  it("picks just the clicked row when the anchor is gone from the list", () => {
    expect([...pickRange(keys, new Set(), "z", "c")]).toEqual(["c"]);
    expect([...pickRange(keys, new Set(), null, "c")]).toEqual(["c"]);
  });

  it("drops picked rows that left the list, so an action never reaches a hidden conversation", () => {
    const picked = new Set(["a", "z"]);
    expect([...keepListed(picked, keys)]).toEqual(["a"]);
    const all = new Set(["a", "b"]);
    expect(keepListed(all, keys)).toBe(all);
  });
});
