import { describe, expect, it } from "vitest";

import { cleanFallback, formatMergeTag, insertAtCaret, mergeTagCatalog } from "./merge-tags";

describe("mergeTagCatalog", () => {
  it("lists the contact tags first, then the custom fields", () => {
    const catalog = mergeTagCatalog([{ key: "plano", label: "Plano" }]);
    expect(catalog.map((option) => option.tag)).toEqual(["first_name", "name", "email", "company", "field.plano"]);
    expect(catalog[4]).toEqual({ group: "field", tag: "field.plano", key: "plano", label: "Plano" });
  });

  it("skips keys the backend would not accept and duplicates", () => {
    const catalog = mergeTagCatalog([
      { key: "Plano", label: "x" },
      { key: "com espaço", label: "x" },
      { key: "ok_1", label: "" },
      { key: "ok_1", label: "again" },
    ]);
    expect(catalog.filter((option) => option.group === "field")).toEqual([{ group: "field", tag: "field.ok_1", key: "ok_1", label: "ok_1" }]);
  });
});

describe("formatMergeTag", () => {
  it("formats with and without a fallback", () => {
    expect(formatMergeTag("first_name")).toBe("{{first_name}}");
    expect(formatMergeTag("first_name", "cliente")).toBe("{{first_name|cliente}}");
    expect(formatMergeTag("first_name", "   ")).toBe("{{first_name}}");
  });

  it("removes characters that would break the tag and caps the length", () => {
    expect(formatMergeTag("name", "a|b{c}\nd")).toBe("{{name|abcd}}");
    expect(Array.from(cleanFallback("x".repeat(150)))).toHaveLength(100);
  });
});

describe("insertAtCaret", () => {
  it("inserts at the caret", () => {
    expect(insertAtCaret("Olá, !", 5, 5, "{{first_name}}")).toEqual({ text: "Olá, {{first_name}}!", caret: 19 });
  });

  it("replaces the selection and tolerates reversed or out of range offsets", () => {
    expect(insertAtCaret("Olá, você!", 9, 5, "{{name}}")).toEqual({ text: "Olá, {{name}}!", caret: 13 });
    expect(insertAtCaret("abc", 10, 10, "!")).toEqual({ text: "abc!", caret: 4 });
  });
});
