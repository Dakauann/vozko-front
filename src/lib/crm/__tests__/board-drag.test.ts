import { describe, expect, it } from "vitest";

import {
  adjacentColumn,
  boardAnnouncement,
  boardDragId,
  canUndoCardMove,
  shiftToCenter,
  isSyntheticColumn,
  moveColumn,
  parseBoardDragId,
  resolveBoardDrop,
  type ColumnSlot,
} from "../board-drag";

describe("board drag ids", () => {
  it("keeps a card and a column with the same id apart, because both live in one drag context", () => {
    expect(boardDragId("card", "x")).not.toBe(boardDragId("column", "x"));
  });

  it("reads back the kind and the original id, even when the id itself contains the separator", () => {
    expect(parseBoardDragId(boardDragId("card", "whatsapp-e1:extra"))).toEqual({
      kind: "card",
      id: "whatsapp-e1:extra",
    });
  });

  it("refuses ids it did not mint, so a foreign draggable never reaches a move", () => {
    expect(parseBoardDragId("other:x")).toBeNull();
    expect(parseBoardDragId("card")).toBeNull();
    expect(parseBoardDragId(42)).toBeNull();
  });
});

describe("where a drag landed", () => {
  const order = ["a", "b", "c"];

  it("moves a card dropped on another column", () => {
    expect(
      resolveBoardDrop({ kind: "card", id: "deal-1", columnId: "a" }, "c", order),
    ).toEqual({ kind: "card", itemId: "deal-1", from: "a", to: "c" });
  });

  it("does nothing when a card is dropped back on its own column, so no request is sent", () => {
    expect(resolveBoardDrop({ kind: "card", id: "deal-1", columnId: "a" }, "a", order)).toBeNull();
  });

  it("does nothing when a card is dropped outside every column", () => {
    expect(resolveBoardDrop({ kind: "card", id: "deal-1", columnId: "a" }, null, order)).toBeNull();
  });

  it("lets a card land in a column outside the reorderable order, such as the untagged one", () => {
    expect(
      resolveBoardDrop({ kind: "card", id: "deal-1", columnId: "a" }, "__unstaged__", order),
    ).toEqual({ kind: "card", itemId: "deal-1", from: "a", to: "__unstaged__" });
  });

  it("reorders columns when a column is dropped over another one", () => {
    expect(resolveBoardDrop({ kind: "column", id: "a", columnId: "a" }, "c", order)).toEqual({
      kind: "column",
      order: ["b", "c", "a"],
    });
  });

  it("refuses a column reorder onto a column that is not part of the order", () => {
    expect(
      resolveBoardDrop({ kind: "column", id: "a", columnId: "a" }, "__unstaged__", order),
    ).toBeNull();
  });

  it("does nothing when a column is dropped where it started", () => {
    expect(resolveBoardDrop({ kind: "column", id: "b", columnId: "b" }, "b", order)).toBeNull();
  });

  it("does nothing without a subject", () => {
    expect(resolveBoardDrop(null, "b", order)).toBeNull();
  });
});

describe("column reorder", () => {
  it("moves left as well as right", () => {
    expect(moveColumn(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveColumn(["a", "b", "c"], "a", "b")).toEqual(["b", "a", "c"]);
  });

  it("returns the same order when either id is unknown", () => {
    const order = ["a", "b"];
    expect(moveColumn(order, "z", "a")).toBe(order);
    expect(moveColumn(order, "a", "z")).toBe(order);
  });
});

describe("keyboard steps between columns", () => {
  const slots: ColumnSlot[] = [
    { id: "c", left: 600, width: 288 },
    { id: "a", left: 0, width: 288 },
    { id: "b", left: 300, width: 288 },
  ];

  it("follows what the viewer sees, left to right, not the order the columns registered", () => {
    expect(adjacentColumn(slots, "a", "right")?.id).toBe("b");
    expect(adjacentColumn(slots, "c", "left")?.id).toBe("b");
  });

  it("stops at the board edges instead of wrapping around", () => {
    expect(adjacentColumn(slots, "a", "left")).toBeNull();
    expect(adjacentColumn(slots, "c", "right")).toBeNull();
  });

  it("ignores up and down, because cards keep no order inside a column", () => {
    expect(adjacentColumn(slots, "b", "up")).toBeNull();
    expect(adjacentColumn(slots, "b", "down")).toBeNull();
  });

  it("refuses an unknown starting column", () => {
    expect(adjacentColumn(slots, "z", "right")).toBeNull();
  });

  it("shifts the lifted card sideways until it is centred on the target column", () => {
    expect(shiftToCenter({ id: "b", left: 300, width: 288 }, { left: 10, width: 268 })).toBe(300);
    expect(shiftToCenter({ id: "a", left: 0, width: 288 }, { left: 310, width: 268 })).toBe(-300);
  });
});

describe("undo after a card move", () => {
  it("is offered when the card came from a real column", () => {
    expect(canUndoCardMove("stage-a", "stage-b")).toBe(true);
  });

  it("is not offered when the card came from a synthetic column the server cannot move back into", () => {
    expect(isSyntheticColumn("__unstaged__")).toBe(true);
    expect(isSyntheticColumn("__unassigned__")).toBe(true);
    expect(canUndoCardMove("__unstaged__", "stage-b")).toBe(false);
    expect(canUndoCardMove("__unassigned__", "user-1")).toBe(false);
  });

  it("is not offered for a move that changed nothing", () => {
    expect(canUndoCardMove("stage-a", "stage-a")).toBe(false);
  });
});

describe("screen reader announcements", () => {
  const card = { kind: "card" as const, label: "Marina" };
  const column = { kind: "column" as const, label: "Proposta" };
  const novo = { id: "a", name: "Novo" };
  const proposta = { id: "b", name: "Proposta" };

  it("names the card and its column on lift", () => {
    expect(boardAnnouncement("lift", card, { from: novo, to: novo })).toEqual({
      key: "cardLifted",
      values: { item: "Marina", column: "Novo" },
    });
  });

  it("names the column the card is over while moving", () => {
    expect(boardAnnouncement("move", card, { from: novo, to: proposta })).toEqual({
      key: "cardOver",
      values: { item: "Marina", column: "Proposta" },
    });
  });

  it("says when the card is back over its own column", () => {
    expect(boardAnnouncement("move", card, { from: novo, to: novo }).key).toBe("cardOverSource");
  });

  it("says when the card is over no column at all", () => {
    expect(boardAnnouncement("move", card, { from: novo, to: null })).toEqual({
      key: "cardOverNothing",
      values: { item: "Marina" },
    });
  });

  it("confirms the new column on drop", () => {
    expect(boardAnnouncement("drop", card, { from: novo, to: proposta })).toEqual({
      key: "cardDropped",
      values: { item: "Marina", column: "Proposta" },
    });
  });

  it("says the card stayed when dropped on its own column or outside", () => {
    expect(boardAnnouncement("drop", card, { from: novo, to: novo }).key).toBe("cardReturned");
    expect(boardAnnouncement("drop", card, { from: novo, to: null })).toEqual({
      key: "cardReturned",
      values: { item: "Marina", column: "Novo" },
    });
  });

  it("says where the card went back to on cancel", () => {
    expect(boardAnnouncement("cancel", card, { from: novo, to: proposta })).toEqual({
      key: "cardCancelled",
      values: { item: "Marina", column: "Novo" },
    });
  });

  it("speaks about positions for a column drag", () => {
    expect(boardAnnouncement("lift", column, { from: proposta, to: proposta })).toEqual({
      key: "columnLifted",
      values: { column: "Proposta" },
    });
    expect(boardAnnouncement("move", column, { from: proposta, to: novo })).toEqual({
      key: "columnOver",
      values: { column: "Proposta", target: "Novo" },
    });
    expect(boardAnnouncement("drop", column, { from: proposta, to: novo })).toEqual({
      key: "columnDropped",
      values: { column: "Proposta", target: "Novo" },
    });
    expect(boardAnnouncement("drop", column, { from: proposta, to: proposta }).key).toBe(
      "columnReturned",
    );
    expect(boardAnnouncement("cancel", column, { from: proposta, to: novo }).key).toBe(
      "columnCancelled",
    );
  });
});
