import { produce, type Draft } from "immer";

import type { CanvasSize, ImageDocument, ImageSurface, Layer, StudioGroup, Transform } from "./document";
import { boxBounds, unionBounds, type Bounds } from "./arrange";
import { dropItem, siblingItems, type TreeItem } from "./groups";
import { indexOf, type LayerIndex } from "./layer-index";
import { LAYER_RANGES } from "./layer-ranges";
import type { IssueCode } from "./validate";

export const LAYOUT_DIRECTIONS = ["horizontal", "vertical"] as const;
export const LAYOUT_ALIGNS = ["start", "center", "end"] as const;
export const LAYOUT_SIZINGS = ["hug", "fixed"] as const;
export const ITEM_SIZINGS = ["fixed", "fill", "hug"] as const;
export const LAYOUT_SPACING_RANGE = [0, 10_000] as const;

export type LayoutDirection = (typeof LAYOUT_DIRECTIONS)[number];
export type LayoutAlign = (typeof LAYOUT_ALIGNS)[number];
export type LayoutSizing = (typeof LAYOUT_SIZINGS)[number];
export type ItemSizing = (typeof ITEM_SIZINGS)[number];

export interface LayoutPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Layout {
  direction: LayoutDirection;
  gap?: number;
  autoGap?: boolean;
  padding?: LayoutPadding;
  alignMain?: LayoutAlign;
  alignCross?: LayoutAlign;
  width: LayoutSizing;
  height: LayoutSizing;
}

export interface LayoutItem {
  width?: ItemSizing;
  height?: ItemSizing;
  absolute?: boolean;
}

export type HugMeasure = (layer: Layer, widthPx: number | null, canvas: CanvasSize) => { width: number; height: number } | null;

type Axis = "x" | "y";

interface PxBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
}

interface Run {
  surface: ImageSurface;
  canvas: CanvasSize;
  index: LayerIndex;
  boxes: Map<string, PxBox>;
  measure?: HugMeasure;
}

const ZERO_PADDING: LayoutPadding = { top: 0, right: 0, bottom: 0, left: 0 };
const EPSILON = 1e-9;
const MOVE_PX = 0.5;
const SIZE_KEY: Record<Axis, "w" | "h"> = { x: "w", y: "h" };
const ITEM_KEY: Record<Axis, "width" | "height"> = { x: "width", y: "height" };

function within(value: number, [lo, hi]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= lo && value <= hi;
}

function toPx(t: Transform, canvas: CanvasSize): PxBox {
  return { cx: t.x * canvas.width, cy: t.y * canvas.height, w: t.w * canvas.width, h: t.h * canvas.height, rotation: t.rotation };
}

const UNIT_CANVAS: CanvasSize = { width: 1, height: 1 };

function boundsOf(box: PxBox): Bounds {
  return boxBounds({ x: box.cx, y: box.cy, w: box.w, h: box.h, rotation: box.rotation, opacity: 1 }, UNIT_CANVAS);
}

function startOf(b: Bounds, axis: Axis): number {
  return axis === "x" ? b.left : b.top;
}

function sizeOf(b: Bounds, axis: Axis): number {
  return axis === "x" ? b.right - b.left : b.bottom - b.top;
}

function other(axis: Axis): Axis {
  return axis === "x" ? "y" : "x";
}

function mainAxis(layout: Layout): Axis {
  return layout.direction === "horizontal" ? "x" : "y";
}

function padStart(padding: LayoutPadding, axis: Axis): number {
  return axis === "x" ? padding.left : padding.top;
}

function padEnd(padding: LayoutPadding, axis: Axis): number {
  return axis === "x" ? padding.right : padding.bottom;
}

function groupOf(run: Run, id: string): StudioGroup | undefined {
  return run.index.groups.get(id);
}

function layerOf(run: Run, id: string): Layer | undefined {
  return run.index.layers.get(id);
}

function itemSpec(run: Run, item: TreeItem): LayoutItem {
  return (item.kind === "layer" ? layerOf(run, item.id)?.layoutItem : groupOf(run, item.id)?.layoutItem) ?? {};
}

function itemHidden(run: Run, item: TreeItem): boolean {
  if (item.kind === "layer") return Boolean(layerOf(run, item.id)?.hidden);
  return (run.index.members.get(item.id) ?? []).every((id) => layerOf(run, id)?.hidden);
}

function flowItems(run: Run, groupId: string): TreeItem[] {
  return siblingItems(run.surface, groupId).filter((item) => !(item.kind === "layer" && layerOf(run, item.id)?.clip) && !itemHidden(run, item) && !itemSpec(run, item).absolute);
}

function clipFollowers(run: Run, layerId: string): string[] {
  const at = run.index.position.get(layerId) ?? -1;
  const followers: string[] = [];
  for (let i = at + 1; i < run.surface.layers.length && run.surface.layers[i].clip; i++) followers.push(run.surface.layers[i].id);
  return followers;
}

function itemLayers(run: Run, item: TreeItem): string[] {
  return item.kind === "layer" ? [item.id, ...clipFollowers(run, item.id)] : [...(run.index.members.get(item.id) ?? [])];
}

function moveItem(run: Run, item: TreeItem, dx: number, dy: number) {
  for (const id of itemLayers(run, item)) {
    const box = run.boxes.get(id);
    if (!box) continue;
    box.cx += dx;
    box.cy += dy;
  }
}

function itemBounds(run: Run, item: TreeItem): Bounds {
  if (item.kind === "layer") return boundsOf(run.boxes.get(item.id)!);
  const base = groupOf(run, item.id)?.baseId;
  if (base && run.boxes.has(base)) return boundsOf(run.boxes.get(base)!);
  return unionBounds((run.index.members.get(item.id) ?? []).map((id) => boundsOf(run.boxes.get(id)!)));
}

function hugText(run: Run, layer: Layer, spec: LayoutItem, after: boolean) {
  if (!run.measure || layer.type !== "text" || (spec.width !== "hug" && spec.height !== "hug")) return;
  if (after && spec.width === "hug") return;
  const box = run.boxes.get(layer.id)!;
  const measured = run.measure({ ...layer, transform: { ...layer.transform, w: box.w / run.canvas.width, h: box.h / run.canvas.height } }, spec.width === "hug" ? null : box.w, run.canvas);
  if (!measured) return;
  if (spec.width === "hug") box.w = measured.width;
  if (spec.height === "hug") box.h = measured.height;
}

function settleInside(run: Run, groupId: string) {
  for (const item of siblingItems(run.surface, groupId)) {
    if (item.kind !== "group") continue;
    if (groupOf(run, item.id)?.layout) layoutGroup(run, item.id, {});
    else settleInside(run, item.id);
  }
}

function setItemSize(run: Run, item: TreeItem, sizes: Partial<Record<Axis, number>>) {
  if (item.kind === "group") {
    if (groupOf(run, item.id)?.layout) layoutGroup(run, item.id, sizes);
    return;
  }
  const box = run.boxes.get(item.id)!;
  if (sizes.x !== undefined) box.w = sizes.x;
  if (sizes.y !== undefined) box.h = sizes.y;
}

function layoutGroup(run: Run, groupId: string, forced: Partial<Record<Axis, number>>): Bounds {
  const group = groupOf(run, groupId)!;
  const layout = group.layout!;
  const baseBox = run.boxes.get(group.baseId!)!;
  const main = mainAxis(layout);
  const cross = other(main);
  const padding = layout.padding ?? ZERO_PADDING;
  const items = flowItems(run, groupId);
  for (const item of items) {
    if (item.kind === "group") {
      if (groupOf(run, item.id)?.layout) layoutGroup(run, item.id, {});
      else settleInside(run, item.id);
    } else hugText(run, layerOf(run, item.id)!, itemSpec(run, item), false);
  }
  const fills = (axis: Axis) => items.filter((item) => itemSpec(run, item)[ITEM_KEY[axis]] === "fill");
  const content = (axis: Axis) => items.filter((item) => itemSpec(run, item)[ITEM_KEY[axis]] !== "fill").map((item) => sizeOf(itemBounds(run, item), axis));
  const gapTotal = layout.autoGap ? 0 : (layout.gap ?? 0) * Math.max(items.length - 1, 0);
  const sizing: Record<Axis, LayoutSizing> = { x: layout.width, y: layout.height };
  const size = {} as Record<Axis, number>;
  for (const axis of ["x", "y"] as const) {
    const pads = padStart(padding, axis) + padEnd(padding, axis);
    const natural = axis === main ? pads + content(axis).reduce((sum, value) => sum + value, 0) + gapTotal : pads + Math.max(0, ...content(axis));
    const wanted = forced[axis] ?? (sizing[axis] === "hug" ? natural : baseBox[SIZE_KEY[axis]]);
    size[axis] = Math.max(wanted, pads, 1);
  }
  const inner = (axis: Axis) => size[axis] - padStart(padding, axis) - padEnd(padding, axis);
  const mainFills = fills(main);
  const remaining = inner(main) - content(main).reduce((sum, value) => sum + value, 0) - gapTotal;
  const mainFill = mainFills.length > 0 ? Math.max(remaining / mainFills.length, 1) : 0;
  for (const item of items) {
    const spec = itemSpec(run, item);
    const sizes: Partial<Record<Axis, number>> = {};
    if (spec[ITEM_KEY[main]] === "fill") sizes[main] = mainFill;
    if (spec[ITEM_KEY[cross]] === "fill") sizes[cross] = Math.max(inner(cross), 1);
    if (sizes.x !== undefined || sizes.y !== undefined) setItemSize(run, item, sizes);
    if (item.kind === "layer") hugText(run, layerOf(run, item.id)!, spec, true);
  }
  const left = baseBox.cx - baseBox.w / 2;
  const top = baseBox.cy - baseBox.h / 2;
  baseBox.w = size.x;
  baseBox.h = size.y;
  baseBox.cx = left + size.x / 2;
  baseBox.cy = top + size.y / 2;
  const origin: Record<Axis, number> = { x: left, y: top };
  const sizes = items.map((item) => itemBounds(run, item));
  const total = sizes.reduce((sum, b) => sum + sizeOf(b, main), 0);
  const count = items.length;
  let gap = layout.gap ?? 0;
  let cursor = origin[main] + padStart(padding, main);
  if (layout.autoGap) gap = count > 1 ? Math.max((inner(main) - total) / (count - 1), 0) : 0;
  else {
    const free = inner(main) - total - gap * Math.max(count - 1, 0);
    cursor += layout.alignMain === "center" ? free / 2 : layout.alignMain === "end" ? free : 0;
  }
  items.forEach((item, i) => {
    const b = sizes[i];
    const crossFree = inner(cross) - sizeOf(b, cross);
    const crossAt = origin[cross] + padStart(padding, cross) + (layout.alignCross === "center" ? crossFree / 2 : layout.alignCross === "end" ? crossFree : 0);
    const target: Record<Axis, number> = { [main]: cursor, [cross]: crossAt } as Record<Axis, number>;
    moveItem(run, item, target.x - startOf(b, "x"), target.y - startOf(b, "y"));
    cursor += sizeOf(b, main) + gap;
  });
  return boundsOf(baseBox);
}

function layoutRoots(surface: ImageSurface, index: LayerIndex): string[] {
  return (surface.groups ?? [])
    .filter((group) => group.layout && group.baseId)
    .filter((group) => {
      for (let at = group.parentId; at; at = index.groups.get(at)?.parentId) if (index.groups.get(at)?.layout) return false;
      return true;
    })
    .map((group) => group.id);
}

function inRange(t: Transform): boolean {
  return within(t.x, LAYER_RANGES.position) && within(t.y, LAYER_RANGES.position) && within(t.w, LAYER_RANGES.size) && within(t.h, LAYER_RANGES.size);
}

function changedTransform(t: Transform, box: PxBox, canvas: CanvasSize): Transform | null {
  const next = { ...t, x: box.cx / canvas.width, y: box.cy / canvas.height, w: box.w / canvas.width, h: box.h / canvas.height };
  const same = Math.abs(next.x - t.x) < EPSILON && Math.abs(next.y - t.y) < EPSILON && Math.abs(next.w - t.w) < EPSILON && Math.abs(next.h - t.h) < EPSILON;
  return same ? null : next;
}

export function layoutSurface<S extends ImageSurface>(surface: S, measure?: HugMeasure): S | null {
  const index = indexOf(surface);
  const roots = layoutRoots(surface, index);
  if (roots.length === 0) return surface;
  const canvas = surface.canvas;
  const run: Run = { surface, canvas, index, measure, boxes: new Map(surface.layers.map((layer) => [layer.id, toPx(layer.transform, canvas)])) };
  for (const root of roots) layoutGroup(run, root, {});
  const updates = new Map<string, Transform>();
  for (const layer of surface.layers) {
    const next = changedTransform(layer.transform, run.boxes.get(layer.id)!, canvas);
    if (!next) continue;
    if (!inRange(next)) return null;
    updates.set(layer.id, next);
  }
  if (updates.size === 0) return surface;
  return produce(surface, (draft) => {
    for (const layer of draft.layers) {
      const next = updates.get(layer.id);
      if (next) layer.transform = next;
    }
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor((sorted.length - 1) / 2)];
}

export function inferredLayout(surface: ImageSurface, groupId: string): Layout {
  const index = indexOf(surface);
  const run: Run = { surface, canvas: surface.canvas, index, boxes: new Map(surface.layers.map((layer) => [layer.id, toPx(layer.transform, surface.canvas)])) };
  const base = boundsOf(run.boxes.get(index.groups.get(groupId)!.baseId!)!);
  const boxes = flowItems(run, groupId).map((item) => itemBounds(run, item));
  if (boxes.length === 0) return { direction: "vertical", width: "fixed", height: "hug" };
  const spread = (axis: Axis) => {
    const centers = boxes.map((b) => startOf(b, axis) + sizeOf(b, axis) / 2);
    return Math.max(...centers) - Math.min(...centers);
  };
  const direction: LayoutDirection = spread("x") >= spread("y") ? "horizontal" : "vertical";
  const main: Axis = direction === "horizontal" ? "x" : "y";
  const cross = other(main);
  const ordered = [...boxes].sort((a, b) => startOf(a, main) - startOf(b, main));
  const gaps = ordered.slice(1).map((b, i) => startOf(b, main) - (startOf(ordered[i], main) + sizeOf(ordered[i], main)));
  const content = unionBounds(boxes);
  const padding = { top: Math.max(0, Math.round(content.top - base.top)), right: Math.max(0, Math.round(base.right - content.right)), bottom: Math.max(0, Math.round(base.bottom - content.bottom)), left: Math.max(0, Math.round(content.left - base.left)) };
  const same = (pick: (b: Bounds) => number) => boxes.every((b) => Math.abs(pick(b) - pick(boxes[0])) <= 1);
  const alignCross: LayoutAlign | undefined = same((b) => startOf(b, cross) + sizeOf(b, cross) / 2) && boxes.length > 1 ? "center" : same((b) => startOf(b, cross) + sizeOf(b, cross)) && !same((b) => startOf(b, cross)) ? "end" : undefined;
  const gap = Math.max(0, Math.round(median(gaps)));
  return {
    direction,
    ...(gap > 0 ? { gap } : {}),
    ...(padding.top || padding.right || padding.bottom || padding.left ? { padding } : {}),
    ...(alignCross ? { alignCross } : {}),
    width: main === "x" ? "hug" : "fixed",
    height: main === "y" ? "hug" : "fixed",
  };
}

function sizeChanged(a: Transform, b: Transform, key: "w" | "h"): boolean {
  return Math.abs(a[key] - b[key]) > EPSILON;
}

function reordered(surface: ImageSurface, groupId: string, run: Run): ImageSurface {
  const main = mainAxis(run.index.groups.get(groupId)!.layout!);
  const items = flowItems(run, groupId);
  const center = (item: TreeItem) => {
    const b = itemBounds(run, item);
    return startOf(b, main) + sizeOf(b, main) / 2;
  };
  const order = items.map((item, i) => ({ item, i, at: center(item) })).sort((a, b) => a.at - b.at || a.i - b.i);
  if (order.every((entry, i) => entry.i === i)) return surface;
  return order.slice(1).reduce((current, entry, i) => dropItem(current, entry.item, order[i].item, "above"), surface);
}

function adjusted<S extends ImageSurface>(previous: ImageSurface, next: S, measure: HugMeasure | undefined): S | null {
  const groups = (next.groups ?? []).filter((group) => group.layout && group.baseId);
  if (groups.length === 0) return next;
  const relaid = layoutSurface(next, measure);
  if (!relaid) return null;
  const index = indexOf(next);
  const before = indexOf(previous);
  const laid = indexOf(relaid);
  const manual = (id: string, key: "w" | "h") => {
    const now = index.layers.get(id)?.transform;
    const old = before.layers.get(id)?.transform;
    const layout = laid.layers.get(id)?.transform;
    return Boolean(now && old && layout && sizeChanged(now, old, key) && sizeChanged(now, layout, key));
  };
  let surface: S = next;
  const sizing = new Map<string, Partial<Layout>>();
  const items = new Map<string, LayoutItem | undefined>();
  const movedGroups: string[] = [];
  for (const group of groups) {
    const base = index.layers.get(group.baseId!);
    if (!base) continue;
    if (Math.abs(base.transform.rotation) > EPSILON) return null;
    const oldBase = before.layers.get(base.id);
    if (!oldBase) continue;
    const patch: Partial<Layout> = {};
    if (group.layout!.width === "hug" && manual(base.id, "w")) patch.width = "fixed";
    if (group.layout!.height === "hug" && manual(base.id, "h")) patch.height = "fixed";
    if (patch.width || patch.height) sizing.set(group.id, patch);
    const shift = { x: (base.transform.x - oldBase.transform.x) * next.canvas.width, y: (base.transform.y - oldBase.transform.y) * next.canvas.height };
    for (const layer of next.layers) {
      if (layer.groupId !== group.id || layer.id === base.id || layer.layoutItem?.absolute || layer.clip) continue;
      const old = before.layers.get(layer.id);
      if (!old) continue;
      const spec = { ...layer.layoutItem };
      const turned = Math.abs(layer.transform.rotation - old.transform.rotation) > EPSILON;
      if ((turned || manual(layer.id, "w")) && spec.width && spec.width !== "fixed") delete spec.width;
      if ((turned || manual(layer.id, "h")) && spec.height && spec.height !== "fixed") delete spec.height;
      if (spec.width !== layer.layoutItem?.width || spec.height !== layer.layoutItem?.height) items.set(layer.id, spec.width || spec.height || spec.absolute ? spec : undefined);
      const resized = sizeChanged(layer.transform, old.transform, "w") || sizeChanged(layer.transform, old.transform, "h");
      const placed = laid.layers.get(layer.id)!.transform;
      const dx = (layer.transform.x - old.transform.x) * next.canvas.width - shift.x;
      const dy = (layer.transform.y - old.transform.y) * next.canvas.height - shift.y;
      const off = Math.hypot((layer.transform.x - placed.x) * next.canvas.width, (layer.transform.y - placed.y) * next.canvas.height);
      if (!resized && Math.hypot(dx, dy) > MOVE_PX && off > MOVE_PX && !movedGroups.includes(group.id)) movedGroups.push(group.id);
    }
  }
  if (sizing.size > 0 || items.size > 0) {
    surface = produce(surface, (draft) => {
      for (const group of draft.groups ?? []) {
        const patch = sizing.get(group.id);
        if (patch && group.layout) Object.assign(group.layout, patch);
      }
      for (const layer of draft.layers) {
        if (!items.has(layer.id)) continue;
        const spec = items.get(layer.id);
        if (spec) layer.layoutItem = spec as Draft<LayoutItem>;
        else delete layer.layoutItem;
      }
    });
  }
  for (const groupId of movedGroups) {
    const run: Run = { surface, canvas: surface.canvas, index: indexOf(surface), boxes: new Map(surface.layers.map((layer) => [layer.id, toPx(layer.transform, surface.canvas)])) };
    surface = reordered(surface, groupId, run) as S;
  }
  return surface;
}

function withoutOrphanItems<S extends ImageSurface>(surface: S): S {
  const groups = new Map((surface.groups ?? []).map((group) => [group.id, group]));
  const container = (id: string | undefined) => (id ? groups.get(id) : undefined);
  const orphanLayer = (layer: Layer) => layer.layoutItem && (!container(layer.groupId)?.layout || container(layer.groupId)?.baseId === layer.id);
  const orphanGroup = (group: StudioGroup) => group.layoutItem && !container(group.parentId)?.layout;
  if (!surface.layers.some(orphanLayer) && !(surface.groups ?? []).some(orphanGroup)) return surface;
  return produce(surface, (draft) => {
    for (const layer of draft.layers) if (orphanLayer(layer as Layer)) delete layer.layoutItem;
    for (const group of draft.groups ?? []) if (orphanGroup(group as StudioGroup)) delete group.layoutItem;
  });
}

export function settleLayouts(before: ImageDocument, after: ImageDocument, measure?: HugMeasure): ImageDocument {
  if (before === after) return after;
  const unchanged = new Set(before.artboards);
  let changed = false;
  const artboards = [];
  for (const original of after.artboards) {
    const artboard = unchanged.has(original) ? original : withoutOrphanItems(original);
    if (artboard !== original) changed = true;
    if (unchanged.has(artboard) || !(artboard.groups ?? []).some((group) => group.layout)) {
      artboards.push(artboard);
      continue;
    }
    const previous = before.artboards.find((a) => a.id === artboard.id) ?? artboard;
    const adjustedSurface = adjusted(previous, artboard, measure);
    if (!adjustedSurface) return before;
    const laid = layoutSurface(adjustedSurface, measure);
    if (!laid) return before;
    if (laid !== artboard) changed = true;
    artboards.push(laid);
  }
  return changed ? { ...after, artboards } : after;
}

export function relayoutDocument(doc: ImageDocument, measure?: HugMeasure): ImageDocument {
  const artboards = doc.artboards.map((artboard) => layoutSurface(artboard, measure) ?? artboard);
  return artboards.every((artboard, i) => artboard === doc.artboards[i]) ? doc : { ...doc, artboards };
}

export function scaledLayout(layout: Layout, fit: number): Layout {
  const scale = (value: number) => Math.min(Math.max(value * fit, LAYOUT_SPACING_RANGE[0]), LAYOUT_SPACING_RANGE[1]);
  const padding = layout.padding;
  return {
    ...layout,
    ...(layout.gap !== undefined ? { gap: scale(layout.gap) } : {}),
    ...(padding ? { padding: { top: scale(padding.top), right: scale(padding.right), bottom: scale(padding.bottom), left: scale(padding.left) } } : {}),
  };
}

function spacingValid(value: number | undefined): boolean {
  return value === undefined || within(value, LAYOUT_SPACING_RANGE);
}

function layoutValueIssue(layout: Layout): IssueCode | null {
  if (!(LAYOUT_DIRECTIONS as readonly string[]).includes(layout.direction) || !(LAYOUT_SIZINGS as readonly string[]).includes(layout.width) || !(LAYOUT_SIZINGS as readonly string[]).includes(layout.height)) return "unknown";
  if (![layout.alignMain ?? "", layout.alignCross ?? ""].every((value) => value === "" || (LAYOUT_ALIGNS as readonly string[]).includes(value))) return "unknown";
  const padding = layout.padding;
  if (!spacingValid(layout.gap) || (padding && ![padding.top, padding.right, padding.bottom, padding.left].every((value) => spacingValid(value)))) return "out_of_range";
  return layout.autoGap && ((layout.gap ?? 0) !== 0 || (layout.alignMain ?? "") !== "") ? "invalid" : null;
}

function itemValueIssue(spec: LayoutItem): IssueCode | null {
  const width = spec.width ?? "";
  const height = spec.height ?? "";
  if (![width, height].every((value) => value === "" || (ITEM_SIZINGS as readonly string[]).includes(value))) return "unknown";
  if (width === "" && height === "" && !spec.absolute) return "invalid";
  return spec.absolute && [width, height].some((value) => value === "fill" || value === "hug") ? "invalid" : null;
}

function fightsParent(parent: Layout, spec: LayoutItem): boolean {
  return (parent.width === "hug" && spec.width === "fill") || (parent.height === "hug" && spec.height === "fill");
}

export function layoutsIssue(groups: readonly StudioGroup[], layers: readonly Layer[]): IssueCode | null {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  for (const group of groups) {
    if (group.layout) {
      if (!group.baseId || group.repeat) return "invalid";
      const code = layoutValueIssue(group.layout);
      if (code) return code;
      if (Math.abs(layerById.get(group.baseId)?.transform.rotation ?? 0) > EPSILON) return "invalid";
    }
    if (!group.layoutItem) continue;
    const parent = group.parentId ? byId.get(group.parentId)?.layout : undefined;
    const code = itemValueIssue(group.layoutItem);
    if (code) return code;
    const { width, height } = group.layoutItem;
    if (!parent || width === "hug" || height === "hug" || ((width === "fill" || height === "fill") && !group.layout) || fightsParent(parent, group.layoutItem)) return "invalid";
    if (group.layout && ((group.layout.width === "hug" && width === "fill") || (group.layout.height === "hug" && height === "fill"))) return "invalid";
  }
  for (const layer of layers) {
    const spec = layer.layoutItem;
    if (!spec) continue;
    const container = layer.groupId ? byId.get(layer.groupId) : undefined;
    const code = itemValueIssue(spec);
    if (code) return code;
    if (!container?.layout || container.baseId === layer.id || fightsParent(container.layout, spec)) return "invalid";
    const sized = [spec.width, spec.height].filter((value) => value === "fill" || value === "hug");
    if (sized.length > 0 && (Math.abs(layer.transform.rotation) > EPSILON || layer.type === "instance")) return "invalid";
    if ((spec.width === "hug" || spec.height === "hug") && (layer.type !== "text" || (layer.curve ?? 0) !== 0)) return "invalid";
  }
  return null;
}
