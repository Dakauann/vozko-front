import { describe, expect, it } from "vitest";

import { asTableRow, draftTableRows } from "./manager-drafts";
import { QUICK_VIEWS, filterRows, matchesSearch, matchesView } from "./manager-views";
import { fixtureDraft, fixtureMetrics, fixtureRow } from "./manager-test-fixtures";

const scope = { campaigns: new Set<string>(), adSets: new Set<string>(), adSetCampaigns: new Map<string, string>() };
const draftRow = (state: "editing" | "failed" | "publishing") => draftTableRows([fixtureDraft({ state })], "campaign", scope, "BRL")[0];

describe("matchesView", () => {
  it("offers Meta's four quick views", () => {
    expect(QUICK_VIEWS).toEqual(["all", "active", "issues", "delivered"]);
  });

  it("keeps everything in Todos", () => {
    expect(matchesView(asTableRow(fixtureRow({ delivery: "off" })), "all")).toBe(true);
    expect(matchesView(draftRow("editing"), "all")).toBe(true);
  });

  it("keeps only delivering objects in Ativos", () => {
    expect(matchesView(asTableRow(fixtureRow({ delivery: "active" })), "active")).toBe(true);
    expect(matchesView(asTableRow(fixtureRow({ delivery: "off" })), "active")).toBe(false);
    expect(matchesView(draftRow("editing"), "active")).toBe(false);
  });

  it("collects rejected objects, objects with issues and drafts that failed in Com problemas", () => {
    expect(matchesView(asTableRow(fixtureRow({ delivery: "rejected" })), "issues")).toBe(true);
    expect(matchesView(asTableRow(fixtureRow({ delivery: "with_issues" })), "issues")).toBe(true);
    expect(matchesView(asTableRow(fixtureRow({ issues: [{ code: 1, summary: "Erro", message: "", level: "AD" }] })), "issues")).toBe(true);
    expect(matchesView(asTableRow(fixtureRow({ reviewFeedback: { Texto: "Muito texto" } })), "issues")).toBe(true);
    expect(matchesView(asTableRow(fixtureRow()), "issues")).toBe(false);
    expect(matchesView(draftRow("failed"), "issues")).toBe(true);
    expect(matchesView(draftRow("editing"), "issues")).toBe(false);
  });

  it("keeps objects with impressions in the range in Tiveram veiculação", () => {
    expect(matchesView(asTableRow(fixtureRow({ metrics: fixtureMetrics({ impressions: 12 }) })), "delivered")).toBe(true);
    expect(matchesView(asTableRow(fixtureRow()), "delivered")).toBe(false);
    expect(matchesView(draftRow("editing"), "delivered")).toBe(false);
  });
});

describe("matchesSearch", () => {
  it("matches the name without case or accents, or the id", () => {
    const row = fixtureRow({ name: "Promoção de Verão", metaId: "120210" });
    expect(matchesSearch(row, "promocao")).toBe(true);
    expect(matchesSearch(row, "VERÃO")).toBe(true);
    expect(matchesSearch(row, "2021")).toBe(true);
    expect(matchesSearch(row, "inverno")).toBe(false);
    expect(matchesSearch(row, "  ")).toBe(true);
  });
});

describe("filterRows", () => {
  it("applies the view to every row", () => {
    const rows = [
      asTableRow(fixtureRow({ metaId: "1", name: "Leads SP", delivery: "active" })),
      asTableRow(fixtureRow({ metaId: "2", name: "Leads RJ", delivery: "off" })),
      draftRow("editing"),
    ];
    expect(filterRows(rows, "active", "").map((row) => row.metaId)).toEqual(["1"]);
    expect(filterRows(rows, "all", "").map((row) => row.metaId)).toEqual(["1", "2", "d1:campaign"]);
  });

  it("searches only draft rows, since the report already searched the published ones", () => {
    const rows = [asTableRow(fixtureRow({ metaId: "1", name: "Vendas" })), draftRow("editing")];
    expect(filterRows(rows, "all", "leads").map((row) => row.metaId)).toEqual(["1", "d1:campaign"]);
    expect(filterRows(rows, "all", "vendas").map((row) => row.metaId)).toEqual(["1"]);
  });
});
