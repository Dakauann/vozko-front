import { describe, expect, it } from "vitest";

import { appendNew } from "@/lib/tiktok/pages";

describe("appendNew", () => {
  it("appends the next page without repeating items already shown", () => {
    const merged = appendNew([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }], (item) => item.id);
    expect(merged.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the current page when the next one brings nothing new", () => {
    expect(appendNew([{ id: "a" }], [{ id: "a" }], (item) => item.id)).toEqual([{ id: "a" }]);
    expect(appendNew([], [{ id: "a" }], (item) => item.id)).toEqual([{ id: "a" }]);
  });
});
