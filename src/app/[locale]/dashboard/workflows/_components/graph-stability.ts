import type { Edge, Node } from "@xyflow/react";

type NodesEqual = (prev: readonly Node[], next: readonly Node[]) => boolean;

const GROUP_NODE_TYPE = "groupNode";
const BOUNDS_PAD = 520;
const FALLBACK_WIDTH = 320;
const FALLBACK_HEIGHT = 140;
const EMPTY_BOUNDS = { x: -900, y: -650, width: 1800, height: 1300 };

function styleSize(node: Node, key: "width" | "height"): unknown {
  return (node.style as Record<string, unknown> | undefined)?.[key];
}

function sameGroupSize(prev: Node, next: Node): boolean {
  if (next.type !== GROUP_NODE_TYPE) return true;
  return (
    prev.width === next.width &&
    prev.height === next.height &&
    prev.measured?.width === next.measured?.width &&
    prev.measured?.height === next.measured?.height &&
    styleSize(prev, "width") === styleSize(next, "width") &&
    styleSize(prev, "height") === styleSize(next, "height")
  );
}

function everyPair<T>(prev: readonly T[], next: readonly T[], same: (a: T, b: T) => boolean): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < next.length; i++) {
    if (prev[i] !== next[i] && !same(prev[i], next[i])) return false;
  }
  return true;
}

function sameNodeIdentity(prev: Node, next: Node): boolean {
  return prev.id === next.id && prev.type === next.type;
}

function samePosition(prev: Node, next: Node): boolean {
  return prev.position.x === next.position.x && prev.position.y === next.position.y;
}

export const sameNodeStructure: NodesEqual = (prev, next) =>
  everyPair(prev, next, (a, b) => sameNodeIdentity(a, b) && a.data === b.data && sameGroupSize(a, b));

export const sameNodeLayout: NodesEqual = (prev, next) =>
  everyPair(prev, next, (a, b) => sameNodeIdentity(a, b) && a.data === b.data && sameGroupSize(a, b) && samePosition(a, b));

export const sameNodeGeometry: NodesEqual = (prev, next) =>
  everyPair(
    prev,
    next,
    (a, b) =>
      sameNodeIdentity(a, b) &&
      samePosition(a, b) &&
      a.width === b.width &&
      a.height === b.height &&
      a.measured?.width === b.measured?.width &&
      a.measured?.height === b.measured?.height,
  );

export function sameEdgeStructure(prev: readonly Edge[], next: readonly Edge[]): boolean {
  return everyPair(
    prev,
    next,
    (a, b) => a.id === b.id && a.source === b.source && a.target === b.target && a.sourceHandle === b.sourceHandle && a.label === b.label,
  );
}

export function isNodeGestureActive(nodes: readonly Node[]): boolean {
  return nodes.some((node) => node.dragging === true || node.resizing === true);
}

export function holdDuringGesture(same: NodesEqual): NodesEqual {
  return (prev, next) => isNodeGestureActive(next) || same(prev, next);
}

export function graphBounds(nodes: readonly Node[], pad = BOUNDS_PAD) {
  if (nodes.length === 0) return EMPTY_BOUNDS;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const width = node.measured?.width ?? node.width ?? FALLBACK_WIDTH;
    const height = node.measured?.height ?? node.height ?? FALLBACK_HEIGHT;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }
  return { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
}
