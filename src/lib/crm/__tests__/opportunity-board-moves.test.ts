import { describe, expect, it } from "vitest";

import {
  dealAge,
  moveDealBetweenColumns,
  requiresDealEdit,
  rotSignal,
  type Opportunity,
  type OpportunityColumn,
} from "@/lib/crm/opportunities";

function deal(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "d1",
    workspaceId: "w1",
    pipelineId: "p1",
    stageId: "a",
    title: "Contrato anual",
    valueCents: 5000,
    currency: "BRL",
    status: "open",
    version: 3,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function column(id: string, entries: Opportunity[], extra: Partial<OpportunityColumn> = {}): OpportunityColumn {
  return {
    id,
    name: id,
    total: entries.length,
    valueTotal: entries.reduce((sum, e) => sum + e.valueCents, 0),
    entries,
    ...extra,
  };
}

describe("moving a deal on the board", () => {
  it("takes the deal, its count and its value out of the source and puts them on top of the target", () => {
    const moving = deal();
    const other = deal({ id: "d2", stageId: "b", valueCents: 100 });
    const next = moveDealBetweenColumns([column("a", [moving]), column("b", [other])], moving, "a", "b");

    expect(next[0]).toMatchObject({ total: 0, valueTotal: 0, entries: [] });
    expect(next[1].total).toBe(2);
    expect(next[1].valueTotal).toBe(5100);
    expect(next[1].entries?.map((e) => e.id)).toEqual(["d1", "d2"]);
    expect(next[1].entries?.[0].stageId).toBe("b");
  });

  it("moves back with the same function, which is how a failed move rolls back", () => {
    const moving = deal();
    const start = [column("a", [moving]), column("b", [])];
    const moved = moveDealBetweenColumns(start, moving, "a", "b");
    const back = moveDealBetweenColumns(moved, { ...moving, stageId: "b" }, "b", "a");

    expect(back[0].entries?.map((e) => [e.id, e.stageId])).toEqual([["d1", "a"]]);
    expect(back[0]).toMatchObject({ total: 1, valueTotal: 5000 });
    expect(back[1]).toMatchObject({ total: 0, valueTotal: 0, entries: [] });
  });

  it("never counts below zero when the source page did not hold the deal", () => {
    const moving = deal();
    const next = moveDealBetweenColumns([column("a", [], { total: 0, valueTotal: 0 }), column("b", [])], moving, "a", "b");
    expect(next[0]).toMatchObject({ total: 0, valueTotal: 0 });
  });

  it("does not place the deal twice when it is already in the target", () => {
    const moving = deal({ stageId: "b" });
    const next = moveDealBetweenColumns([column("a", []), column("b", [moving])], moving, "a", "b");
    expect(next[1].entries?.filter((e) => e.id === "d1")).toHaveLength(1);
  });
});

describe("columns that need the deal form instead of a direct move", () => {
  it("sends a lost move through the form, which asks for the reason", () => {
    expect(requiresDealEdit({ isLost: true }, deal())).toBe(true);
  });

  it("sends a won move through the form when the deal has no value yet", () => {
    expect(requiresDealEdit({ isWon: true }, deal({ valueCents: 0 }))).toBe(true);
    expect(requiresDealEdit({ isWon: true }, deal({ valueCents: 10 }))).toBe(false);
  });

  it("moves directly into an ordinary column", () => {
    expect(requiresDealEdit({}, deal())).toBe(false);
  });
});

describe("deal signals carry numbers, not words, so every locale can phrase them", () => {
  const now = new Date("2026-10-18T12:00:00Z").getTime();

  it("flags an open deal idle for a week as a warning with its idle days", () => {
    expect(rotSignal("open", "2026-10-10T12:00:00Z", undefined, now)).toEqual({ tone: "warning", days: 8 });
  });

  it("flags two idle weeks as danger", () => {
    expect(rotSignal("open", "2026-10-01T12:00:00Z", undefined, now)).toEqual({ tone: "danger", days: 17 });
  });

  it("never flags a closed deal", () => {
    expect(rotSignal("won", "2026-01-01T00:00:00Z", undefined, now)).toBeNull();
  });

  it("describes the age as today, yesterday, days or a date", () => {
    expect(dealAge("2026-10-18T08:00:00Z", now)).toEqual({ kind: "today" });
    expect(dealAge("2026-10-17T08:00:00Z", now)).toEqual({ kind: "yesterday" });
    expect(dealAge("2026-10-08T08:00:00Z", now)).toEqual({ kind: "days", days: 10 });
    expect(dealAge("2026-08-01T08:00:00Z", now)).toEqual({ kind: "date", date: new Date("2026-08-01T08:00:00Z") });
  });

  it("has no age for a missing or broken date", () => {
    expect(dealAge(undefined, now)).toBeNull();
    expect(dealAge("nope", now)).toBeNull();
  });
});
