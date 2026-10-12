import type { Point } from "../convex";
import { isUpright } from "./look-views";
import { area, cornersOf, EDGES, textAnchor, unitBounds, type Box, type EdgeName, type SceneElement, type SceneGround } from "./scene";
import { inkCorners, isText, type TextMeasure } from "./text-ink";

export interface LayoutItem {
  el: SceneElement;
  box: Box;
  corners: Point[];
  text: boolean;
  upright: boolean;
}

export interface AlignmentMiss {
  off: LayoutItem;
  edge: EdgeName;
  distance: number;
  partners: string[];
  members: LayoutItem[];
  neighbor: LayoutItem;
}

export interface Symmetry {
  axis: LayoutItem[];
  pairs: [LayoutItem, LayoutItem][];
}

export const BACKGROUND_SHARE = 0.7;
const SAME_EDGE = 0.002;
const ARTBOARD_AXIS = 0.5;
const MIN_SYMMETRIC = 3;
const MIRROR_SIZE = 0.9;
const MIRROR_ANGLE = 0.5;
const NEAR_EDGE: readonly [number, number] = [0.004, 0.02];
const CONTAIN_SLACK = 0.002;
const DECOR_OPACITY = 0.6;
const EDGE_TOUCH = 0.001;
const MAX_SIZE_RATIO = 3;
const AXIS_MIDDLES: ReadonlySet<EdgeName> = new Set(["center", "middle"]);
const AXIS_EDGES: Record<EdgeName, EdgeName[]> = {
  left: ["left", "center", "right"],
  center: ["left", "center", "right"],
  right: ["left", "center", "right"],
  top: ["top", "middle", "bottom"],
  middle: ["top", "middle", "bottom"],
  bottom: ["top", "middle", "bottom"],
};

export function bleeds(b: Box): number {
  return [b.left <= EDGE_TOUCH, b.right >= 1 - EDGE_TOUCH, b.top <= EDGE_TOUCH, b.bottom >= 1 - EDGE_TOUCH].filter(Boolean).length;
}

export function layoutItems(scene: SceneGround, measure: TextMeasure): LayoutItem[] {
  return scene.elements.flatMap((el): LayoutItem[] => {
    if (el.opacity <= 0 || area(el.box) >= BACKGROUND_SHARE || bleeds(el.box) >= 2) return [];
    if (!isText(el)) return [{ el, box: el.box, corners: cornersOf(el, scene.canvas), text: false, upright: isUpright(el.transform) }];
    const corners = inkCorners(scene, el, measure);
    return [{ el, box: unitBounds(corners, scene.canvas), corners, text: true, upright: isUpright(el.transform) }];
  });
}

function contains(outer: Box, inner: Box): boolean {
  return outer.left <= inner.left + CONTAIN_SLACK && outer.right >= inner.right - CONTAIN_SLACK && outer.top <= inner.top + CONTAIN_SLACK && outer.bottom >= inner.bottom - CONTAIN_SLACK;
}

export function nested(a: LayoutItem, b: LayoutItem): boolean {
  return contains(a.box, b.box) || contains(b.box, a.box);
}

function edgesOf(item: LayoutItem): EdgeName[] {
  if (!item.text || !item.el.layer) return ["left", "center", "right", "top", "middle", "bottom"];
  return [textAnchor(item.el.layer), "middle"];
}

function sharesAxis(a: LayoutItem, b: LayoutItem, edge: EdgeName): boolean {
  return AXIS_EDGES[edge].some((other) => other !== edge && edgesOf(a).includes(other) && edgesOf(b).includes(other) && Math.abs(EDGES[other](a.box) - EDGES[other](b.box)) <= SAME_EDGE);
}

function aligns(item: LayoutItem): boolean {
  return item.upright && (item.text || item.el.opacity >= DECOR_OPACITY);
}

export function isVerticalEdge(edge: EdgeName): boolean {
  return edge === "left" || edge === "center" || edge === "right";
}

function stackGap(a: Box, b: Box, edge: EdgeName): [number, number] {
  return isVerticalEdge(edge) ? (a.bottom <= b.top ? [a.bottom, b.top] : [b.bottom, a.top]) : a.right <= b.left ? [a.right, b.left] : [b.right, a.left];
}

function nearestOf(off: LayoutItem, line: readonly LayoutItem[], edge: EdgeName): LayoutItem {
  const gap = (item: LayoutItem) => {
    const [from, to] = stackGap(off.box, item.box, edge);
    return to - from;
  };
  return line.reduce((best, item) => (gap(item) < gap(best) ? item : best));
}

function crossSize(item: LayoutItem, edge: EdgeName): number {
  return isVerticalEdge(edge) ? item.box.right - item.box.left : item.box.bottom - item.box.top;
}

function comparable(a: LayoutItem, b: LayoutItem, edge: EdgeName): boolean {
  const [small, large] = [crossSize(a, edge), crossSize(b, edge)].sort((x, y) => x - y);
  return large <= small * MAX_SIZE_RATIO;
}

export function clearBetween(a: LayoutItem, b: LayoutItem, edge: EdgeName, others: readonly LayoutItem[]): boolean {
  const [from, to] = stackGap(a.box, b.box, edge);
  const at = EDGES[edge](b.box);
  return !others.some((c) => {
    if (c === a || c === b) return false;
    const [low, high] = isVerticalEdge(edge) ? [c.box.top, c.box.bottom] : [c.box.left, c.box.right];
    const [start, end] = isVerticalEdge(edge) ? [c.box.left, c.box.right] : [c.box.top, c.box.bottom];
    return low >= from && high <= to && start < at && end > at;
  });
}

function related(off: LayoutItem, neighbor: LayoutItem, edge: EdgeName, others: readonly LayoutItem[]): boolean {
  return !AXIS_MIDDLES.has(edge) || (comparable(off, neighbor, edge) && clearBetween(off, neighbor, edge, others));
}

function onAxis(item: LayoutItem): boolean {
  return Math.abs(EDGES.center(item.box) - ARTBOARD_AXIS) <= SAME_EDGE;
}

function similar(a: number, b: number): boolean {
  return Math.min(a, b) >= Math.max(a, b) * MIRROR_SIZE;
}

function mirrors(a: LayoutItem, b: LayoutItem): boolean {
  if (a.text !== b.text || Math.abs(a.el.rotation + b.el.rotation) > MIRROR_ANGLE) return false;
  if (Math.abs(EDGES.center(a.box) + EDGES.center(b.box) - 2 * ARTBOARD_AXIS) > SAME_EDGE || Math.abs(EDGES.middle(a.box) - EDGES.middle(b.box)) > SAME_EDGE) return false;
  return similar(a.box.bottom - a.box.top, b.box.bottom - b.box.top) && (a.text || similar(a.box.right - a.box.left, b.box.right - b.box.left));
}

export function symmetry(items: readonly LayoutItem[]): Symmetry | null {
  if (items.length < MIN_SYMMETRIC) return null;
  const unpaired = items.filter((item) => !onAxis(item));
  const pairs: [LayoutItem, LayoutItem][] = [];
  while (unpaired.length > 0) {
    const first = unpaired.shift()!;
    const at = unpaired.findIndex((other) => mirrors(first, other));
    if (at < 0) return null;
    const [second] = unpaired.splice(at, 1);
    pairs.push([first, second]);
  }
  return { axis: items.filter(onAxis), pairs };
}

export function alignmentMisses(items: readonly LayoutItem[]): AlignmentMiss[] {
  const upright = items.filter(aligns);
  const best = new Map<string, AlignmentMiss>();
  const order = new Map(upright.map((item, index) => [item, index]));
  for (const edge of Object.keys(EDGES) as EdgeName[]) {
    const sorted = upright.filter((item) => edgesOf(item).includes(edge)).map((item) => ({ item, at: EDGES[edge](item.box) })).sort((x, y) => x.at - y.at);
    const within = (index: number, low: number, high: number) => {
      const found: typeof sorted = [];
      for (let j = index - 1; j >= 0 && sorted[index].at - sorted[j].at <= high; j--) if (sorted[index].at - sorted[j].at > low) found.push(sorted[j]);
      for (let j = index + 1; j < sorted.length && sorted[j].at - sorted[index].at <= high; j++) if (sorted[j].at - sorted[index].at > low) found.push(sorted[j]);
      return found;
    };
    const partners = sorted.map((_, index) => within(index, -1, SAME_EDGE).map((entry) => entry.item));
    const place = new Map(sorted.map((entry, index) => [entry.item, index]));
    sorted.forEach(({ item: a }, i) => {
      for (const { item: b, at } of within(i, NEAR_EDGE[0], NEAR_EDGE[1])) {
        if (nested(a, b) || sharesAxis(a, b, edge)) continue;
        const bLine = partners[place.get(b)!];
        const aLine = partners[i];
        if (aLine.length > bLine.length || (aLine.length === bLine.length && order.get(a)! < order.get(b)!)) continue;
        const line = [b, ...bLine];
        const neighbor = nearestOf(a, line, edge);
        if (!related(a, neighbor, edge, upright)) continue;
        const distance = Math.abs(sorted[i].at - at);
        const key = `${a.el.id}:${edge}`;
        const current = best.get(key);
        if (!current || distance < current.distance) best.set(key, { off: a, edge, distance, partners: line.map((c) => c.el.id).sort(), members: line, neighbor });
      }
    });
  }
  const byLayer = new Map<string, AlignmentMiss>();
  for (const miss of best.values()) {
    const current = byLayer.get(miss.off.el.id);
    if (!current || miss.distance < current.distance) byLayer.set(miss.off.el.id, miss);
  }
  return [...byLayer.values()];
}
