import { describe, expect, it } from "vitest";

import { bulkChangeOf, bulkFieldsFor, bulkOutcomes, bulkTally, type BulkForm } from "./manager-bulk";

const form = (overrides: Partial<BulkForm> = {}): BulkForm => ({
  field: "name",
  mode: "set",
  value: "",
  find: "",
  replace: "",
  matchCase: false,
  ...overrides,
});

describe("bulkFieldsFor", () => {
  it("offers the name everywhere and the creative texts only on ads", () => {
    expect(bulkFieldsFor("campaign")).toEqual(["name"]);
    expect(bulkFieldsFor("adset")).toEqual(["name"]);
    expect(bulkFieldsFor("ad")).toEqual(["name", "primaryText", "headline", "description", "link"]);
  });
});

describe("bulkChangeOf", () => {
  it("sets a trimmed value", () => {
    expect(bulkChangeOf(form({ value: "  Black Friday " }), "campaign")).toEqual({
      change: { field: "name", mode: "set", value: "Black Friday" },
    });
  });

  it("finds and replaces, keeping the spaces the person typed", () => {
    expect(bulkChangeOf(form({ mode: "replace", find: " SP", replace: " RJ", matchCase: true }), "adset")).toEqual({
      change: { field: "name", mode: "replace", find: " SP", replace: " RJ", matchCase: true },
    });
  });

  it("refuses an empty name, an empty search and a creative field outside the ad level", () => {
    expect(bulkChangeOf(form({ value: "   " }), "campaign")).toEqual({ problem: "valueRequired" });
    expect(bulkChangeOf(form({ field: "description", value: "  " }), "ad")).toEqual({ change: { field: "description", mode: "set", value: "" } });
    expect(bulkChangeOf(form({ mode: "replace", find: "" }), "campaign")).toEqual({ problem: "findRequired" });
    expect(bulkChangeOf(form({ field: "headline", value: "Oferta" }), "campaign")).toEqual({ problem: "fieldNotForLevel" });
    expect(bulkChangeOf(form({ field: "headline", value: "Oferta" }), "ad")).toEqual({
      change: { field: "headline", mode: "set", value: "Oferta" },
    });
  });
});

describe("bulkOutcomes", () => {
  it("reports every requested object, counting a missing answer as a failure", () => {
    const outcomes = bulkOutcomes(
      ["1", "2", "3"],
      [
        { metaId: "1", ok: true },
        { metaId: "2", ok: false, error: { code: "meta_refused", message: "Nome muito longo" } },
      ],
    );
    expect(outcomes).toEqual([
      { metaId: "1", ok: true, object: undefined, message: null },
      { metaId: "2", ok: false, object: undefined, message: "Nome muito longo" },
      { metaId: "3", ok: false, object: undefined, message: null },
    ]);
    expect(bulkTally(outcomes)).toEqual({ ok: 1, failed: 2 });
  });
});
