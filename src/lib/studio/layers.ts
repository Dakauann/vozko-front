import { produce, type Draft } from "immer";

import { newStudioId, STUDIO_LIMITS, type CanvasSize, type ImageSurface, type Layer, type StudioGroup, type Transform } from "./document";
import {
  baseOf,
  bottomIndex,
  captureGroup,
  cleanupGroups,
  cloneWithGroups,
  containerOf,
  dissolveGroup,
  dropItem,
  familyOf,
  ancestry,
  groupAncestry,
  groupParents,
  groupLayerIds,
  itemLayerIds,
  layerChain,
  scaffoldOf,
  selectionItems,
  siblingItems,
  treeLayerOrder,
  type TreeItem,
} from "./groups";
import { indexOf } from "./layer-index";
import { clampTo, LAYER_RANGES, normalizedRotation } from "./layer-ranges";

export type LayerPatch = Partial<Omit<Layer, "id" | "type">>;

export type OrderDirection = "forward" | "backward" | "front" | "back";

export type Alignment = "left" | "center" | "right" | "top" | "middle" | "bottom";

export type DistributeAxis = "horizontal" | "vertical";

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const DUPLICATE_OFFSET = 0.02;

const SIZE_EPSILON = 1e-9;

export function layerById(doc: ImageSurface, id: string): Layer | undefined {
  return indexOf(doc).layers.get(id);
}

export function isPickable(layer: Layer): boolean {
  return !layer.hidden && !layer.locked;
}

export function withGroupMembers(doc: ImageSurface, ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  for (const id of ids) {
    const group = captureGroup(doc, id);
    if (group) for (const member of groupLayerIds(doc, group)) wanted.add(member);
  }
  return doc.layers.filter((l) => wanted.has(l.id)).map((l) => l.id);
}

function editable(doc: ImageSurface, ids: readonly string[]): Set<string> {
  const wanted = new Set(ids);
  return new Set(doc.layers.filter((l) => wanted.has(l.id) && !l.locked).map((l) => l.id));
}

export function addLayers(doc: ImageSurface, layers: readonly Layer[], atIndex: number = doc.layers.length): ImageSurface {
  if (layers.length === 0) return doc;
  return produce(doc, (draft) => {
    draft.layers.splice(Math.max(0, Math.min(atIndex, draft.layers.length)), 0, ...(layers as Draft<Layer>[]));
  });
}

export function addLayersAbove(doc: ImageSurface, layers: readonly Layer[], anchorId: string): ImageSurface {
  const index = doc.layers.findIndex((l) => l.id === anchorId);
  if (index < 0) return addLayers(doc, layers);
  const groupId = doc.layers[index].groupId;
  return addLayers(
    doc,
    layers.map((l) => (groupId ? { ...l, groupId } : l)),
    index + 1,
  );
}

interface Motion {
  from: Transform;
  to: Transform;
}

function rigidMotion(from: Transform, to: Transform): Motion | null {
  if (Math.abs(from.w - to.w) > SIZE_EPSILON || Math.abs(from.h - to.h) > SIZE_EPSILON) return null;
  if (from.x === to.x && from.y === to.y && from.rotation === to.rotation) return null;
  return { from, to };
}

function follow(layer: Draft<Layer>, motion: Motion, canvas: CanvasSize) {
  const { from, to } = motion;
  const turn = to.rotation - from.rotation;
  const radians = (turn * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const px = (layer.transform.x - from.x) * canvas.width;
  const py = (layer.transform.y - from.y) * canvas.height;
  layer.transform.x = clampTo(to.x + (px * cos - py * sin) / canvas.width, LAYER_RANGES.position);
  layer.transform.y = clampTo(to.y + (px * sin + py * cos) / canvas.height, LAYER_RANGES.position);
  if (turn !== 0) layer.transform.rotation = normalizedRotation(layer.transform.rotation + turn);
}

function nearestMovedParent(doc: ImageSurface, layerId: string, motions: ReadonlyMap<string, Motion | null>): Motion | null {
  const own = scaffoldOf(doc, layerId);
  for (const groupId of layerChain(doc, layerId)) {
    const base = groupId === own ? null : baseOf(doc, groupId);
    if (base && motions.has(base)) return motions.get(base) ?? null;
  }
  return null;
}

export function updateLayers(doc: ImageSurface, ids: readonly string[], patch: LayerPatch | ((layer: Layer) => LayerPatch)): ImageSurface {
  const targets = editable(doc, ids);
  if (targets.size === 0) return doc;
  return produce(doc, (draft) => {
    const motions = new Map<string, Motion | null>();
    doc.layers.forEach((base, i) => {
      if (!targets.has(base.id)) return;
      const layer = draft.layers[i];
      Object.assign(layer, typeof patch === "function" ? patch(base) : patch);
      if (scaffoldOf(doc, base.id)) motions.set(base.id, rigidMotion(base.transform, { ...layer.transform }));
    });
    if (motions.size === 0) return;
    doc.layers.forEach((base, i) => {
      if (targets.has(base.id)) return;
      const motion = nearestMovedParent(doc, base.id, motions);
      if (motion) follow(draft.layers[i], motion, doc.canvas);
    });
  });
}

export function translateLayers(doc: ImageSurface, ids: readonly string[], dx: number, dy: number): ImageSurface {
  return updateLayers(doc, ids, (layer) => ({ transform: { ...layer.transform, x: clamp(layer.transform.x + dx, -1, 2), y: clamp(layer.transform.y + dy, -1, 2) } }));
}

export function changedTransforms(before: ImageSurface, after: ImageSurface): Map<string, Transform> {
  const previous = new Map(before.layers.map((l) => [l.id, l.transform]));
  return new Map(after.layers.filter((l) => previous.has(l.id) && previous.get(l.id) !== l.transform).map((l) => [l.id, l.transform]));
}

export function setLayersLocked(doc: ImageSurface, ids: readonly string[], locked: boolean): ImageSurface {
  const wanted = new Set(familyOf(doc, ids));
  return produce(doc, (draft) => {
    for (const layer of draft.layers) if (wanted.has(layer.id)) layer.locked = locked || undefined;
  });
}

export function setLayersHidden(doc: ImageSurface, ids: readonly string[], hidden: boolean): ImageSurface {
  const wanted = new Set(familyOf(doc, ids));
  return produce(doc, (draft) => {
    for (const layer of draft.layers) if (wanted.has(layer.id)) layer.hidden = hidden || undefined;
  });
}

export function newlyLocked(before: Pick<ImageSurface, "layers">, after: Pick<ImageSurface, "layers">, selection: readonly string[]): string[] {
  const was = new Set(before.layers.filter((l) => l.locked).map((l) => l.id));
  const now = new Set(after.layers.filter((l) => l.locked && !was.has(l.id)).map((l) => l.id));
  return selection.filter((id) => now.has(id));
}

export function deleteLayers(doc: ImageSurface, ids: readonly string[]): ImageSurface {
  const targets = editable(doc, familyOf(doc, [...editable(doc, ids)]));
  if (targets.size === 0) return doc;
  return produce(doc, (draft) => {
    draft.layers = draft.layers.filter((l) => !targets.has(l.id));
    cleanupGroups(draft);
  });
}

function insertClones(
  doc: ImageSurface,
  sources: readonly Layer[],
  meta: readonly StudioGroup[],
  offset: number,
  atIndex: number,
  keep: (groupId: string) => boolean,
): { document: ImageSurface; ids: string[] } {
  if (sources.length === 0) return { document: doc, ids: [] };
  const { layers: copies, groups } = cloneWithGroups(sources, meta, offset, keep, (v) => clamp(v, -1, 2));
  const document = produce(addLayers(doc, copies, atIndex), (draft) => {
    if (groups.length > 0) draft.groups = [...(draft.groups ?? []), ...groups];
    cleanupGroups(draft);
  });
  return { document, ids: copies.map((c) => c.id) };
}

export function duplicateLayers(doc: ImageSurface, ids: readonly string[], offset: number = DUPLICATE_OFFSET): { document: ImageSurface; ids: string[] } {
  const wanted = new Set(familyOf(doc, ids));
  const sources = doc.layers.filter((l) => wanted.has(l.id));
  const top = Math.max(-1, ...sources.map((l) => doc.layers.indexOf(l)));
  const whole = (groupId: string) => groupLayerIds(doc, groupId).every((id) => wanted.has(id));
  return insertClones(doc, sources, doc.groups ?? [], offset, top + 1, (groupId) => !whole(groupId));
}

export function pasteLayers(
  doc: ImageSurface,
  layers: readonly Layer[],
  offset: number = DUPLICATE_OFFSET,
  groups: readonly StudioGroup[] = [],
  atIndex: number = doc.layers.length,
): { document: ImageSurface; ids: string[] } {
  return insertClones(doc, layers, groups, offset, atIndex, () => false);
}

function itemKey(item: TreeItem): string {
  return `${item.kind}:${item.id}`;
}

function reordered<T>(list: readonly T[], picked: (item: T) => boolean, direction: OrderDirection): T[] {
  if (direction === "front") return [...list.filter((item) => !picked(item)), ...list.filter(picked)];
  if (direction === "back") return [...list.filter(picked), ...list.filter((item) => !picked(item))];
  const items = [...list];
  const step = direction === "forward" ? 1 : -1;
  const order = step === 1 ? [...items.keys()].reverse() : [...items.keys()];
  for (const i of order) {
    const j = i + step;
    if (!picked(items[i]) || j < 0 || j >= items.length || picked(items[j])) continue;
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function reorderLayers(doc: ImageSurface, ids: readonly string[], direction: OrderDirection): ImageSurface {
  const picked = new Map<string | null, Set<string>>();
  for (const item of selectionItems(doc, ids)) {
    const container = containerOf(doc, item);
    picked.set(container, (picked.get(container) ?? new Set()).add(itemKey(item)));
  }
  if (picked.size === 0) return doc;
  const order = treeLayerOrder(doc, (container) => {
    const chosen = picked.get(container);
    const siblings = siblingItems(doc, container);
    return chosen ? reordered(siblings, (item) => chosen.has(itemKey(item)), direction) : siblings;
  });
  if (!order || order.every((id, i) => doc.layers[i].id === id)) return doc;
  const byId = new Map(doc.layers.map((l) => [l.id, l]));
  return produce(doc, (draft) => {
    draft.layers = order.map((id) => byId.get(id)!) as Draft<Layer>[];
  });
}

interface Wrapping {
  parent: string | null;
  units: TreeItem[];
}

function wrapping(doc: ImageSurface, ids: readonly string[]): Wrapping | null {
  const items = selectionItems(doc, ids);
  if (items.length === 0) return null;
  const parents = groupParents(doc);
  const paths = items.map((item) => ancestry(parents, containerOf(doc, item)).reverse());
  let depth = 0;
  while (paths.every((path) => depth < path.length && path[depth] === paths[0][depth])) depth++;
  const found = new Map<string, TreeItem>();
  items.forEach((item, i) => {
    const unit: TreeItem = paths[i].length > depth ? { kind: "group", id: paths[i][depth] } : item;
    found.set(itemKey(unit), unit);
  });
  const units = [...found.values()].sort((a, b) => bottomIndex(doc, a) - bottomIndex(doc, b));
  return { parent: depth > 0 ? paths[0][depth - 1] : null, units };
}

function wrap(doc: ImageSurface, { parent, units }: Wrapping, entry: StudioGroup): ImageSurface {
  return produce(doc, (draft) => {
    const groups = [...(draft.groups ?? []), { ...entry, ...(parent ? { parentId: parent } : {}) }];
    draft.groups = groups;
    for (const unit of units) {
      if (unit.kind === "layer") {
        const layer = draft.layers.find((l) => l.id === unit.id);
        if (layer) layer.groupId = entry.id;
        continue;
      }
      const existing = draft.groups.find((g) => g.id === unit.id);
      if (existing) existing.parentId = entry.id;
      else draft.groups.push({ id: unit.id, parentId: entry.id });
    }
    const members = new Set(groupLayerIds(draft as ImageSurface, entry.id));
    const top = Math.max(...draft.layers.map((l, i) => (members.has(l.id) ? i : -1)));
    const above = draft.layers.slice(top + 1);
    const below = draft.layers.slice(0, top + 1).filter((l) => !members.has(l.id));
    const picked = draft.layers.filter((l) => members.has(l.id));
    draft.layers = [...below, ...picked, ...above];
    cleanupGroups(draft);
  });
}

export function groupLayers(doc: ImageSurface, ids: readonly string[]): { document: ImageSurface; groupId: string | null } {
  const plan = wrapping(doc, ids);
  if (!plan || plan.units.length < 2) return { document: doc, groupId: null };
  const groupId = newStudioId("g");
  return { document: wrap(doc, plan, { id: groupId }), groupId };
}

function scaffoldBase(doc: ImageSurface, plan: Wrapping | null): TreeItem | null {
  if (!plan || plan.units.length < 2) return null;
  const lowest = plan.units[0];
  return lowest.kind === "layer" || baseOf(doc, lowest.id) ? lowest : null;
}

export function canCreateScaffold(doc: ImageSurface, ids: readonly string[]): boolean {
  return scaffoldBase(doc, wrapping(doc, ids)) !== null;
}

export function createScaffold(doc: ImageSurface, ids: readonly string[]): { document: ImageSurface; scaffoldId: string | null } {
  const plan = wrapping(doc, ids);
  const base = scaffoldBase(doc, plan);
  if (!plan || !base) return { document: doc, scaffoldId: null };
  if (base.kind === "layer") {
    const scaffoldId = newStudioId("g");
    return { document: wrap(doc, plan, { id: scaffoldId, baseId: base.id }), scaffoldId };
  }
  const document = plan.units.slice(1).reduce((current, unit) => dropItem(current, unit, base, "into"), doc);
  return { document, scaffoldId: base.id };
}

export function ungroupTargets(doc: ImageSurface, ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => scaffoldOf(doc, id) ?? captureGroup(doc, id)).filter((g): g is string => g !== null))];
}

function scaffoldChildren(doc: ImageSurface, ids: readonly string[]): string[] {
  return ids.filter((id) => {
    const container = layerById(doc, id)?.groupId;
    return container !== undefined && !scaffoldOf(doc, id) && baseOf(doc, container) !== null;
  });
}

function familyLeavers(doc: ImageSurface, ids: readonly string[]): string[] {
  return scaffoldChildren(doc, ids).filter((id) => !captureGroup(doc, id));
}

export function leaveFamily(doc: ImageSurface, ids: readonly string[]): ImageSurface {
  const leavers = new Set(scaffoldChildren(doc, ids));
  return [...doc.layers]
    .reverse()
    .filter((l) => leavers.has(l.id))
    .reduce((current, layer) => {
      const scaffold = layerById(current, layer.id)?.groupId;
      return scaffold ? dropItem(current, { kind: "layer", id: layer.id }, { kind: "group", id: scaffold }, "above") : current;
    }, doc);
}

export type UngroupKind = "ungroup" | "release" | "leave";

export function ungroupKind(doc: ImageSurface, ids: readonly string[]): UngroupKind | null {
  const targets = ungroupTargets(doc, ids);
  if (targets.some((groupId) => baseOf(doc, groupId) === null)) return "ungroup";
  if (targets.length > 0) return "release";
  return familyLeavers(doc, ids).length > 0 ? "leave" : null;
}

export function canUngroup(doc: ImageSurface, ids: readonly string[]): boolean {
  return ungroupKind(doc, ids) !== null;
}

export function ungroupLayers(doc: ImageSurface, ids: readonly string[]): ImageSurface {
  return leaveFamily(ungroupTargets(doc, ids).reduce(dissolveGroup, doc), familyLeavers(doc, ids));
}

export function layerBounds(transform: Transform, canvas: CanvasSize): Bounds {
  const w = transform.w * canvas.width;
  const h = transform.h * canvas.height;
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const halfW = (w * cos + h * sin) / 2;
  const halfH = (w * sin + h * cos) / 2;
  const cx = transform.x * canvas.width;
  const cy = transform.y * canvas.height;
  return { left: cx - halfW, top: cy - halfH, right: cx + halfW, bottom: cy + halfH };
}

function union(bounds: Bounds[]): Bounds {
  return {
    left: Math.min(...bounds.map((b) => b.left)),
    top: Math.min(...bounds.map((b) => b.top)),
    right: Math.max(...bounds.map((b) => b.right)),
    bottom: Math.max(...bounds.map((b) => b.bottom)),
  };
}

export function selectionBounds(doc: ImageSurface, ids: readonly string[]): Bounds | null {
  const wanted = new Set(ids);
  const picked = doc.layers.filter((l) => wanted.has(l.id));
  return picked.length === 0 ? null : union(picked.map((l) => layerBounds(l.transform, doc.canvas)));
}

interface Unit {
  ids: string[];
  bounds: Bounds;
  container: string | null;
}

function units(doc: ImageSurface, ids: readonly string[]): Unit[] {
  return selectionItems(doc, withGroupMembers(doc, ids)).flatMap((item): Unit[] => {
    const members = itemLayerIds(doc, item);
    const base = item.kind === "group" ? baseOf(doc, item.id) : null;
    const free = (base ? [base] : members).filter((id) => !layerById(doc, id)?.locked);
    if (free.length === 0) return [];
    const bounds = union(free.map((id) => layerBounds(layerById(doc, id)!.transform, doc.canvas)));
    return [{ ids: base ? members : free, bounds, container: containerOf(doc, item) }];
  });
}

function parentFrame(doc: ImageSurface, container: string | null): Bounds {
  for (const groupId of groupAncestry(doc, container)) {
    const base = baseOf(doc, groupId);
    if (base) return layerBounds(layerById(doc, base)!.transform, doc.canvas);
  }
  return { left: 0, top: 0, right: doc.canvas.width, bottom: doc.canvas.height };
}

function shiftUnits(doc: ImageSurface, shifts: Map<string, [number, number]>): ImageSurface {
  if (shifts.size === 0) return doc;
  return produce(doc, (draft) => {
    for (const layer of draft.layers) {
      const shift = shifts.get(layer.id);
      if (!shift) continue;
      layer.transform.x = clamp(layer.transform.x + shift[0] / draft.canvas.width, -1, 2);
      layer.transform.y = clamp(layer.transform.y + shift[1] / draft.canvas.height, -1, 2);
    }
  });
}

export function alignLayers(doc: ImageSurface, ids: readonly string[], alignment: Alignment): ImageSurface {
  const found = units(doc, ids);
  if (found.length === 0) return doc;
  const frame = found.length === 1 ? parentFrame(doc, found[0].container) : union(found.map((u) => u.bounds));
  const shifts = new Map<string, [number, number]>();
  for (const unit of found) {
    const b = unit.bounds;
    const dx =
      alignment === "left" ? frame.left - b.left : alignment === "right" ? frame.right - b.right : alignment === "center" ? (frame.left + frame.right - b.left - b.right) / 2 : 0;
    const dy =
      alignment === "top" ? frame.top - b.top : alignment === "bottom" ? frame.bottom - b.bottom : alignment === "middle" ? (frame.top + frame.bottom - b.top - b.bottom) / 2 : 0;
    if (dx !== 0 || dy !== 0) for (const id of unit.ids) shifts.set(id, [dx, dy]);
  }
  return shiftUnits(doc, shifts);
}

export function distributeLayers(doc: ImageSurface, ids: readonly string[], axis: DistributeAxis): ImageSurface {
  const found = units(doc, ids);
  if (found.length < 3) return doc;
  const start = (b: Bounds) => (axis === "horizontal" ? b.left : b.top);
  const size = (b: Bounds) => (axis === "horizontal" ? b.right - b.left : b.bottom - b.top);
  const sorted = [...found].sort((a, b) => start(a.bounds) + size(a.bounds) / 2 - (start(b.bounds) + size(b.bounds) / 2));
  const first = sorted[0].bounds;
  const last = sorted[sorted.length - 1].bounds;
  const span = start(last) + size(last) - start(first);
  const gap = (span - sorted.reduce((sum, u) => sum + size(u.bounds), 0)) / (sorted.length - 1);
  const shifts = new Map<string, [number, number]>();
  let cursor = start(first);
  for (const unit of sorted) {
    const delta = cursor - start(unit.bounds);
    cursor += size(unit.bounds) + gap;
    if (Math.abs(delta) < 1e-9) continue;
    for (const id of unit.ids) shifts.set(id, axis === "horizontal" ? [delta, 0] : [0, delta]);
  }
  return shiftUnits(doc, shifts);
}

function anchored(center: number, oldSide: number, newSide: number, scale: number): number {
  const px = center * oldSide;
  if (center < 1 / 3) return (px * scale) / newSide;
  if (center > 2 / 3) return 1 - ((oldSide - px) * scale) / newSide;
  return 0.5 + ((px - oldSide / 2) * scale) / newSide;
}

function coversCanvas(layer: Layer): boolean {
  return layer.transform.w >= 0.98 && layer.transform.h >= 0.98 && Math.abs(layer.transform.x - 0.5) < 0.02 && Math.abs(layer.transform.y - 0.5) < 0.02;
}

function clampSide(n: number): number {
  return clamp(Math.round(n), STUDIO_LIMITS.minCanvasSide, STUDIO_LIMITS.maxCanvasSide);
}

export function resizeCanvas(doc: ImageSurface, size: CanvasSize): ImageSurface {
  const width = clampSide(size.width);
  const height = clampSide(size.height);
  const { width: oldW, height: oldH } = doc.canvas;
  if (width === oldW && height === oldH) return doc;
  const fit = Math.min(width / oldW, height / oldH);
  const fill = Math.max(width / oldW, height / oldH);
  const unitCenters = new Map<string, [number, number]>();
  for (const unit of units({ ...doc, layers: doc.layers.map((l) => ({ ...l, locked: undefined })) }, doc.layers.map((l) => l.id))) {
    const cx = (unit.bounds.left + unit.bounds.right) / 2 / oldW;
    const cy = (unit.bounds.top + unit.bounds.bottom) / 2 / oldH;
    for (const id of unit.ids) unitCenters.set(id, [cx, cy]);
  }
  return produce(doc, (draft) => {
    draft.canvas.width = width;
    draft.canvas.height = height;
    for (const layer of draft.layers) {
      const t = layer.transform;
      if (coversCanvas(layer as Layer)) {
        t.w = clamp((t.w * oldW * fill) / width, 0.001, 4);
        t.h = clamp((t.h * oldH * fill) / height, 0.001, 4);
        continue;
      }
      const [ucx, ucy] = unitCenters.get(layer.id) ?? [t.x, t.y];
      const nucx = anchored(ucx, oldW, width, fit);
      const nucy = anchored(ucy, oldH, height, fit);
      t.x = clamp(nucx + ((t.x - ucx) * oldW * fit) / width, -1, 2);
      t.y = clamp(nucy + ((t.y - ucy) * oldH * fit) / height, -1, 2);
      t.w = clamp((t.w * oldW * fit) / width, 0.001, 4);
      t.h = clamp((t.h * oldH * fit) / height, 0.001, 4);
      if (layer.fontSize !== undefined) layer.fontSize = clamp((layer.fontSize * oldH * fit) / height, 0.005, 0.5);
      if (layer.strokeWidth !== undefined) layer.strokeWidth = clamp(layer.strokeWidth * fit, 0, 200);
      if (layer.shadow) {
        layer.shadow.blur = clamp(layer.shadow.blur * fit, 0, 200);
        layer.shadow.x = clamp(layer.shadow.x * fit, -500, 500);
        layer.shadow.y = clamp(layer.shadow.y * fit, -500, 500);
      }
    }
  });
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}
