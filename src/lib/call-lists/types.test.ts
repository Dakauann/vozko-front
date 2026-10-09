import { describe, expect, it } from "vitest";

import { decodeItemsCursor, encodeItemsCursor, parseCallList, parseCallListItem, parseCallListItemPage, parseCallListNext, parseCallListPage } from "./types";

const list = {
  id: "list-1",
  name: "Retorno de outubro",
  status: "active",
  createdBy: "u1",
  assigneeIds: ["u1", "u2"],
  phone: { source: "contact", label: "landline" },
  selected: 1200,
  itemCount: 1130,
  closedCount: 240,
  openCount: 890,
  calledCount: 341,
  callbackCount: 26,
  acceptsOutcomes: true,
  statusMoves: ["paused", "archived"],
  skipped: { blocked: 40, no_number: 30 },
  createdAt: "2026-10-07T12:00:00Z",
  updatedAt: "2026-10-08T12:00:00Z",
};

const item = {
  id: "item-1",
  listId: "list-1",
  leadId: "lead-1",
  leadName: "Maria Souza",
  phone: "5511987654321",
  position: 12,
  state: "reserved",
  reservedBy: "u1",
  reservedUntil: "2026-10-08T12:15:00Z",
  closable: false,
  createdAt: "2026-10-07T12:00:00Z",
  updatedAt: "2026-10-08T12:00:00Z",
};

describe("parseCallList", () => {
  it("reads the progress and the phone choice of a list", () => {
    expect(parseCallList(list)).toEqual(list);
  });

  it("keeps the optional failure and build fields only when present", () => {
    const parsed = parseCallList({ ...list, status: "failed", failureCode: "no_callable_lead", builtAt: "2026-10-07T12:01:00Z" });
    expect(parsed).toMatchObject({ failureCode: "no_callable_lead", builtAt: "2026-10-07T12:01:00Z" });
    expect(parseCallList(list)).not.toHaveProperty("failureCode");
  });

  it("carries the server's verdicts on the list and nothing about a sign-off", () => {
    const parsed = parseCallList({ ...list, signedOffBy: "u9", signedOffAt: "2026-10-07T12:00:00Z", needsSignOff: true });
    expect(parsed).toMatchObject({ acceptsOutcomes: true, statusMoves: ["paused", "archived"], calledCount: 341, callbackCount: 26 });
    expect(parsed).not.toHaveProperty("signedOffBy");
    expect(parsed).not.toHaveProperty("needsSignOff");
  });

  it("refuses a list without the server's verdicts or progress counters", () => {
    expect(parseCallList({ ...list, acceptsOutcomes: undefined })).toBeNull();
    expect(parseCallList({ ...list, statusMoves: undefined })).toBeNull();
    expect(parseCallList({ ...list, statusMoves: ["running"] })).toBeNull();
    expect(parseCallList({ ...list, calledCount: undefined })).toBeNull();
    expect(parseCallList({ ...list, callbackCount: -1 })).toBeNull();
  });

  it("refuses an unknown status, a missing count or a malformed skip map", () => {
    expect(parseCallList({ ...list, status: "running" })).toBeNull();
    expect(parseCallList({ ...list, closedCount: undefined })).toBeNull();
    expect(parseCallList({ ...list, skipped: { blocked: "many" } })).toBeNull();
    expect(parseCallList({ ...list, assigneeIds: "u1" })).toBeNull();
    expect(parseCallList({ ...list, phone: { source: "fax" } })).toBeNull();
    expect(parseCallList(null)).toBeNull();
  });

  it("reads a missing skip map as no skips", () => {
    expect(parseCallList({ ...list, skipped: undefined })?.skipped).toEqual({});
  });
});

describe("parseCallListPage", () => {
  it("reads a server page of lists", () => {
    expect(parseCallListPage({ items: [list], total: 31, page: 2, pageSize: 20 })).toEqual({ items: [list], total: 31, page: 2, pageSize: 20 });
  });

  it("refuses a page with a list it cannot read", () => {
    expect(parseCallListPage({ items: [{ ...list, status: "x" }], total: 1, page: 1, pageSize: 20 })).toBeNull();
    expect(parseCallListPage({ items: [], page: 1, pageSize: 20 })).toBeNull();
  });
});

describe("parseCallListItem", () => {
  it("reads an item with its reservation", () => {
    expect(parseCallListItem(item)).toEqual(item);
  });

  it("reads the callback, refusal, outcome and attempts of an item", () => {
    const parsed = parseCallListItem({
      ...item,
      state: "pending",
      disposition: "_callback",
      callbackAt: "2026-10-09T15:00:00Z",
      refusal: "invalid_number",
      lastCallId: "call-1",
      outcome: "answered",
      attempts: 2,
      note: "Pediu retorno",
    });
    expect(parsed).toMatchObject({ disposition: "_callback", callbackAt: "2026-10-09T15:00:00Z", refusal: "invalid_number", lastCallId: "call-1", outcome: "answered", attempts: 2, note: "Pediu retorno" });
  });

  it("reads the bairro and the city of the lead, and whether the viewer can close the item", () => {
    expect(parseCallListItem({ ...item, leadDistrict: "Aldeia", leadCity: "Barueri", closable: true })).toMatchObject({ leadDistrict: "Aldeia", leadCity: "Barueri", closable: true });
    expect(parseCallListItem(item)).not.toHaveProperty("leadDistrict");
  });

  it("refuses an item without the server's closable verdict", () => {
    expect(parseCallListItem({ ...item, closable: undefined })).toBeNull();
    expect(parseCallListItem({ ...item, closable: "yes" })).toBeNull();
  });

  it("refuses an unknown state or outcome", () => {
    expect(parseCallListItem({ ...item, state: "done" })).toBeNull();
    expect(parseCallListItem({ ...item, outcome: "maybe" })).toBeNull();
    expect(parseCallListItem({ ...item, phone: 5511 })).toBeNull();
  });
});

describe("parseCallListItemPage", () => {
  it("reads the next position cursor only when the server sent one", () => {
    expect(parseCallListItemPage({ items: [item], next: 50 })).toEqual({ items: [item], next: { after: 50 } });
    expect(parseCallListItemPage({ items: [] })).toEqual({ items: [] });
    expect(parseCallListItemPage({ items: [{ ...item, state: "x" }] })).toBeNull();
  });

  it("carries the agenda key and the instant of a pending page into its cursor", () => {
    const asOf = "2026-10-08T12:00:00Z";
    expect(parseCallListItemPage({ items: [item], next: 7, nextAt: "2026-10-08T10:00:00Z", asOf })).toEqual({
      items: [item],
      next: { after: 7, afterAt: "2026-10-08T10:00:00Z", asOf },
    });
    expect(parseCallListItemPage({ items: [item], next: 9, asOf })).toEqual({ items: [item], next: { after: 9, asOf } });
    expect(parseCallListItemPage({ items: [item], asOf })).toEqual({ items: [item] });
  });
});

describe("items cursor", () => {
  it("survives the trip through the page query key", () => {
    const cursor = { after: 7, afterAt: "2026-10-08T10:00:00Z", asOf: "2026-10-08T12:00:00Z" };
    expect(decodeItemsCursor(encodeItemsCursor(cursor))).toEqual(cursor);
    expect(decodeItemsCursor(encodeItemsCursor({ after: 3 }))).toEqual({ after: 3 });
  });

  it("reads anything else as the first page", () => {
    expect(decodeItemsCursor(undefined)).toBeUndefined();
    expect(decodeItemsCursor("50")).toBeUndefined();
    expect(decodeItemsCursor(JSON.stringify({ after: "x" }))).toBeUndefined();
  });
});

describe("parseCallListNext", () => {
  it("reads the reserved item with the lead card, the last interaction and the lines", () => {
    const parsed = parseCallListNext({
      list,
      item,
      lead: { id: "lead-1", name: "Maria Souza", district: "Vila Mariana", city: "São Paulo", familyCount: 2 },
      lastInteraction: { entryId: "e1", entryType: "whatsapp", at: "2026-10-08T11:00:00Z" },
      trunks: [{ id: "t1", name: "Matriz" }],
      refused: 1,
      more: false,
    });
    expect(parsed).toEqual({
      list,
      item,
      lead: { id: "lead-1", name: "Maria Souza", district: "Vila Mariana", city: "São Paulo", familyCount: 2 },
      lastInteraction: { entryId: "e1", entryType: "whatsapp", at: "2026-10-08T11:00:00Z" },
      trunks: [{ id: "t1", name: "Matriz" }],
      refused: 1,
      more: false,
    });
  });

  it("reads an empty queue and a line refusal", () => {
    expect(parseCallListNext({ list, trunks: [], trunkRefusal: "no_dialable_trunk", refused: 0, more: true })).toEqual({
      list,
      trunks: [],
      trunkRefusal: "no_dialable_trunk",
      refused: 0,
      more: true,
    });
  });

  it("refuses an item without its lead card, or lines it cannot read", () => {
    expect(parseCallListNext({ list, item, trunks: [], refused: 0, more: false })).toBeNull();
    expect(parseCallListNext({ list, trunks: [{ id: 1 }], refused: 0, more: false })).toBeNull();
    expect(parseCallListNext({ list, trunks: [], trunkRefusal: "maybe", refused: 0, more: false })).toBeNull();
  });
});
