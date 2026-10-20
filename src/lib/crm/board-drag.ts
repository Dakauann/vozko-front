export type BoardDragKind = "card" | "column";

const DRAG_ID_SEPARATOR = ":";
const DRAG_KINDS: readonly BoardDragKind[] = ["card", "column"];

export function boardDragId(kind: BoardDragKind, id: string): string {
  return `${kind}${DRAG_ID_SEPARATOR}${id}`;
}

export function parseBoardDragId(
  dragId: string | number,
): { kind: BoardDragKind; id: string } | null {
  if (typeof dragId !== "string") return null;
  const at = dragId.indexOf(DRAG_ID_SEPARATOR);
  if (at < 0) return null;
  const kind = dragId.slice(0, at) as BoardDragKind;
  if (!DRAG_KINDS.includes(kind)) return null;
  return { kind, id: dragId.slice(at + 1) };
}

export function isSyntheticColumn(columnId: string): boolean {
  return columnId.startsWith("__") && columnId.endsWith("__");
}

export interface BoardDragSubject {
  kind: BoardDragKind;
  id: string;
  columnId: string;
}

export type BoardDrop =
  | { kind: "card"; itemId: string; from: string; to: string }
  | { kind: "column"; order: string[] };

export function moveColumn(order: string[], fromId: string, toId: string): string[] {
  const from = order.indexOf(fromId);
  const to = order.indexOf(toId);
  if (from < 0 || to < 0) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

export function resolveBoardDrop(
  subject: BoardDragSubject | null,
  overColumnId: string | null,
  columnOrder: readonly string[],
): BoardDrop | null {
  if (!subject || !overColumnId || overColumnId === subject.columnId) return null;
  if (subject.kind === "card") {
    return { kind: "card", itemId: subject.id, from: subject.columnId, to: overColumnId };
  }
  const order = [...columnOrder];
  const next = moveColumn(order, subject.columnId, overColumnId);
  return next === order ? null : { kind: "column", order: next };
}

export function canUndoCardMove(from: string, to: string): boolean {
  return from !== to && !isSyntheticColumn(from);
}

export type BoardStepDirection = "left" | "right" | "up" | "down";

export interface ColumnSlot {
  id: string;
  left: number;
  width: number;
}

export function adjacentColumn(
  slots: readonly ColumnSlot[],
  currentId: string,
  direction: BoardStepDirection,
): ColumnSlot | null {
  if (direction !== "left" && direction !== "right") return null;
  const ordered = [...slots].sort((a, b) => a.left - b.left);
  const at = ordered.findIndex((slot) => slot.id === currentId);
  if (at < 0) return null;
  return ordered[direction === "left" ? at - 1 : at + 1] ?? null;
}

export function shiftToCenter(
  target: ColumnSlot,
  active: { left: number; width: number },
): number {
  return target.left + target.width / 2 - (active.left + active.width / 2);
}

export type BoardDragPhase = "lift" | "move" | "drop" | "cancel";

export interface BoardPlace {
  id: string;
  name: string;
}

export interface BoardAnnouncement {
  key: string;
  values: Record<string, string>;
}

function cardAnnouncement(
  phase: BoardDragPhase,
  item: string,
  from: BoardPlace,
  to: BoardPlace | null,
): BoardAnnouncement {
  const landed = to !== null && to.id !== from.id;
  switch (phase) {
    case "lift":
      return { key: "cardLifted", values: { item, column: from.name } };
    case "move":
      if (!to) return { key: "cardOverNothing", values: { item } };
      return { key: landed ? "cardOver" : "cardOverSource", values: { item, column: to.name } };
    case "drop":
      return landed
        ? { key: "cardDropped", values: { item, column: to.name } }
        : { key: "cardReturned", values: { item, column: from.name } };
    case "cancel":
      return { key: "cardCancelled", values: { item, column: from.name } };
  }
}

function columnAnnouncement(
  phase: BoardDragPhase,
  column: string,
  from: BoardPlace,
  to: BoardPlace | null,
): BoardAnnouncement {
  const landed = to !== null && to.id !== from.id;
  switch (phase) {
    case "lift":
      return { key: "columnLifted", values: { column } };
    case "move":
      if (!to) return { key: "columnOverNothing", values: { column } };
      return { key: "columnOver", values: { column, target: to.name } };
    case "drop":
      return landed
        ? { key: "columnDropped", values: { column, target: to.name } }
        : { key: "columnReturned", values: { column } };
    case "cancel":
      return { key: "columnCancelled", values: { column } };
  }
}

export function boardAnnouncement(
  phase: BoardDragPhase,
  subject: { kind: BoardDragKind; label: string },
  place: { from: BoardPlace; to: BoardPlace | null },
): BoardAnnouncement {
  return subject.kind === "card"
    ? cardAnnouncement(phase, subject.label, place.from, place.to)
    : columnAnnouncement(phase, subject.label, place.from, place.to);
}
