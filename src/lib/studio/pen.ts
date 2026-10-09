import type { PathNode, Subpath } from "./path-nodes";
import type { Point } from "./viewport";

export interface PenDraft {
  nodes: PathNode[];
  closed: boolean;
}

export const EMPTY_PEN: PenDraft = { nodes: [], closed: false };

const ANGLE_STEP = Math.PI / 4;

function near(point: Point, node: PathNode | undefined, radius: number): boolean {
  return node !== undefined && Math.hypot(point.x - node.x, point.y - node.y) <= radius;
}

export function penPress(draft: PenDraft, point: Point, closeRadius: number): { draft: PenDraft; finished: boolean } {
  if (draft.nodes.length >= 2 && near(point, draft.nodes[0], closeRadius)) return { draft: { ...draft, closed: true }, finished: true };
  if (near(point, draft.nodes[draft.nodes.length - 1], closeRadius)) return { draft, finished: false };
  return { draft: { nodes: [...draft.nodes, { x: point.x, y: point.y }], closed: false }, finished: false };
}

export function penUndo(draft: PenDraft): PenDraft {
  return draft.nodes.length === 0 ? draft : { nodes: draft.nodes.slice(0, -1), closed: false };
}

export function penDrag(draft: PenDraft, point: Point, breakHandle: boolean): PenDraft {
  const index = draft.closed ? 0 : draft.nodes.length - 1;
  const node = draft.nodes[index];
  if (!node) return draft;
  const out = { x: point.x, y: point.y };
  const dragged: PathNode = breakHandle ? { ...node, out } : { x: node.x, y: node.y, in: { x: 2 * node.x - point.x, y: 2 * node.y - point.y }, out };
  return { ...draft, nodes: draft.nodes.map((n, i) => (i === index ? dragged : n)) };
}

export function penFinish(draft: PenDraft): Subpath | null {
  return draft.nodes.length >= 2 ? { closed: draft.closed, nodes: draft.nodes } : null;
}

export function constrainAngle(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.round(Math.atan2(dy, dx) / ANGLE_STEP) * ANGLE_STEP;
  return { x: from.x + Math.cos(angle) * distance, y: from.y + Math.sin(angle) * distance };
}
