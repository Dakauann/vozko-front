import { describe, expect, it } from "vitest";

import { encodeInteractiveListRows, readCanonicalButtons, readCanonicalListRows } from "./interactive-options";

const CANONICAL_ROWS = `[{"title":"Aulas Aquáticas","rows":[{"id":"1","title":"Horários Aquáticas 🏊‍♀️","description":""},{"id":"2","title":"Materiais Aquáticos 🥽","description":""}]}]`;

describe("the options form reads only the shape the server stores", () => {
  it("binds the canonical list rows", () => {
    expect(readCanonicalListRows(CANONICAL_ROWS)).toEqual([
      { id: "1", title: "Horários Aquáticas 🏊‍♀️", description: "" },
      { id: "2", title: "Materiais Aquáticos 🥽", description: "" },
    ]);
  });

  it("binds the canonical buttons", () => {
    expect(readCanonicalButtons(`[{"Type":"reply","ID":"sim","Title":"Sim","CopyCode":""}]`)).toEqual([
      { Type: "reply", ID: "sim", Title: "Sim", CopyCode: "" },
    ]);
  });

  it("treats a missing value as no options yet", () => {
    expect(readCanonicalListRows(undefined)).toEqual([]);
    expect(readCanonicalButtons("")).toEqual([]);
    expect(readCanonicalButtons("[]")).toEqual([]);
  });

  it.each([
    ["the list the builder wrote with capitalized keys", `[{"Title":"Aulas Aquáticas","Rows":[{"ID":"1","Title":"Horários"},{"ID":"2","Title":"Materiais"}]}]`],
    ["rows without their description", `[{"title":"A","rows":[{"id":"1","title":"Um"}]}]`],
    ["a row id that is not text", `[{"title":"A","rows":[{"id":1,"title":"Um","description":""}]}]`],
    ["an extra key", `[{"title":"A","rows":[{"id":"1","title":"Um","description":"","Id":"x"}]}]`],
    ["an array that the server has not stored as text yet", [{ title: "A", rows: [] }]],
    ["broken json", "{not json"],
  ])("refuses %s as illegible", (_, value) => {
    expect(readCanonicalListRows(value)).toBeNull();
  });

  it.each([
    ["lowercase buttons", `[{"type":"reply","id":"sim","title":"Sim","copy_code":""}]`],
    ["buttons without CopyCode", `[{"Type":"reply","ID":"sim","Title":"Sim"}]`],
    ["an object instead of a list", `{"ID":"sim"}`],
  ])("refuses %s as illegible", (_, value) => {
    expect(readCanonicalButtons(value)).toBeNull();
  });

  it("writes back the shape it reads", () => {
    const rows = readCanonicalListRows(CANONICAL_ROWS) ?? [];
    expect(readCanonicalListRows(encodeInteractiveListRows(rows))).toEqual(rows);
  });
});
