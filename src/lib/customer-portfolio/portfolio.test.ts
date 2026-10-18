import { describe, expect, it } from "vitest";

import {
  customerLines,
  type PortfolioEntry,
  type PortfolioSubject,
  heldByOther,
  holderParam,
  holdingState,
  parsePortfolioHolding,
  parsePortfolioPage,
  type PortfolioRow,
} from "./portfolio";

const entry = {
  id: "e-1",
  holderId: "u-ana",
  holderName: "Ana",
  addedBy: "u-ana",
  subject: { kind: "contact", contactType: "instagram", contactId: "ig-1" } as PortfolioSubject,
  addedAt: "2026-10-18T12:00:00Z",
  updatedAt: "2026-10-18T12:00:00Z",
};

const row = {
  id: "e-1",
  holderId: "u-ana",
  holderName: "Ana",
  holderReceives: true,
  addedBy: "u-mia",
  addedByName: "Mia",
  subject: { kind: "lead", leadId: "l-1" },
  display: { name: "Maria Souza", number: "5511987654321" },
  addedAt: "2026-10-18T12:00:00Z",
  updatedAt: "2026-10-18T12:00:00Z",
};

describe("parsePortfolioHolding", () => {
  it("reads a customer held in a carteira", () => {
    expect(parsePortfolioHolding({ subject: entry.subject, entry })).toEqual({ subject: entry.subject, entry });
  });

  it("reads a customer in nobody's carteira", () => {
    expect(parsePortfolioHolding({ subject: { kind: "lead", leadId: "l-1" }, entry: null })).toEqual({ subject: { kind: "lead", leadId: "l-1" }, entry: null });
  });

  it("refuses what is not a holding", () => {
    for (const value of [null, {}, { subject: { kind: "robot" }, entry: null }, { subject: entry.subject, entry: { ...entry, holderId: "" } }, { subject: entry.subject }]) {
      expect(parsePortfolioHolding(value)).toBeNull();
    }
  });
});

describe("parsePortfolioPage", () => {
  it("reads rows and the page", () => {
    const page = parsePortfolioPage({ data: [row], meta: { page: 1, pageSize: 20, totalPages: 1, totalItems: 1 } });
    expect(page).toEqual({ items: [row], page: 1, pageSize: 20, totalPages: 1, totalItems: 1 });
  });

  it("refuses a page with a broken row", () => {
    expect(parsePortfolioPage({ data: [{ ...row, holderReceives: "yes" }], meta: { page: 1, pageSize: 20, totalPages: 1, totalItems: 1 } })).toBeNull();
    expect(parsePortfolioPage({ data: [row] })).toBeNull();
  });
});

describe("holdingState", () => {
  it("tells free, mine and someone else's apart", () => {
    const held: PortfolioEntry = entry;
    expect(holdingState({ subject: held.subject, entry: null }, "u-ana")).toBe("free");
    expect(holdingState({ subject: held.subject, entry: held }, "u-ana")).toBe("mine");
    expect(holdingState({ subject: held.subject, entry: held }, "u-bob")).toBe("other");
  });
});

describe("heldByOther", () => {
  it("reads who holds the customer from the refusal", () => {
    expect(heldByOther({ code: "customer_portfolio_held_by_other", expected: { entryId: "e-1", holderId: "u-bob", holderName: "Bob" } })).toEqual({
      entryId: "e-1",
      holderId: "u-bob",
      holderName: "Bob",
    });
  });

  it("ignores other refusals and refusals without an entry", () => {
    expect(heldByOther({ code: "forbidden" })).toBeNull();
    expect(heldByOther({ code: "customer_portfolio_held_by_other" })).toBeNull();
  });
});

describe("holderParam", () => {
  it("sends nothing for the caller's own carteira, all for the team and the id for a member", () => {
    expect(holderParam({ kind: "mine" })).toBeNull();
    expect(holderParam({ kind: "all" })).toBe("all");
    expect(holderParam({ kind: "member", userId: "u-bob" })).toBe("u-bob");
  });
});

describe("customerLines", () => {
  const base = row as PortfolioRow;
  it("puts the name first and the handle and number under it", () => {
    expect(customerLines({ ...base, display: { name: "Maria", handle: "maria.ig" } })).toEqual({ primary: "Maria", secondary: "@maria.ig" });
    expect(customerLines({ ...base, display: { name: "Maria" } })).toEqual({ primary: "Maria", secondary: "" });
  });

  it("falls back to the handle, then to the number", () => {
    expect(customerLines({ ...base, display: { handle: "maria.ig" } })).toEqual({ primary: "@maria.ig", secondary: "" });
    expect(customerLines({ ...base, display: {} })).toEqual({ primary: "", secondary: "" });
  });
});
