import { describe, expect, it } from "vitest";

import { appendById, removeById, replaceById } from "@/lib/mercadolivre/pages";

const rows = [
  { id: "a", text: "first" },
  { id: "b", text: "second" },
];

describe("keyset page rows", () => {
  it("appends a page without repeating a row already shown", () => {
    expect(appendById(rows, [{ id: "b", text: "again" }, { id: "c", text: "third" }])).toEqual([
      { id: "a", text: "first" },
      { id: "b", text: "second" },
      { id: "c", text: "third" },
    ]);
  });

  it("replaces one row in place and leaves the others", () => {
    expect(replaceById(rows, { id: "b", text: "changed" }).map((row) => row.text)).toEqual(["first", "changed"]);
  });

  it("removes one row by id", () => {
    expect(removeById(rows, "a").map((row) => row.id)).toEqual(["b"]);
  });
});
