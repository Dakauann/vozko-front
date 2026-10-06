import { produce, type Draft } from "immer";

import { newStudioId, STUDIO_LIMITS, type CanvasSize, type ImageDocument, type Layer, type StudioGroup, type Transform } from "./document";
import { cleanupGroups, cloneWithGroups, groupAncestry, groupLayerIds, groupParents, outermostGroup } from "./groups";

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

export function layerById(doc: ImageDocument, id: string): Layer | undefined {
  return doc.layers.find((l) => l.id === id);
}

export function canAddLayers(doc: ImageDocument, count: number): boolean {
  return doc.layers.length + count <= STUDIO_LIMITS.maxLayers;
}

export function withGroupMembers(doc: ImageDocument, ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  const tops = new Set(ids.map((id) => outermostGroup(doc, id)).filter((g): g is string => g !== null));
  return doc.layers.filter((l) => wanted.has(l.id) || tops.has(outermostGroup(doc, l.id) ?? "")).map((l) => l.id);
}

function editable(doc: ImageDocument, ids: readonly string[]): Set<string> {
  const wanted = new Set(ids);
  return new Set(doc.layers.filter((l) => wanted.has(l.id) && !l.locked).map((l) => l.id));
}

export function addLayers(doc: ImageDocument, layers: readonly Layer[], atIndex: number = doc.layers.length): ImageDocument {
  if (layers.length === 0 || !canAddLayers(doc, layers.length)) return doc;
  return produce(doc, (draft) => {
    draft.layers.splice(Math.max(0, Math.min(atIndex, draft.layers.length)), 0, ...(layers as Draft<Layer>[]));
  });
}

export function updateLayers(doc: ImageDocument, ids: readonly string[], patch: LayerPatch | ((layer: Layer) => LayerPatch)): ImageDocument {
  const targets = editable(doc, ids);
  if (targets.size === 0) return doc;
  return produce(doc, (draft) => {
    for (const layer of draft.layers) {
      if (!targets.has(layer.id)) continue;
      Object.assign(layer, typeof patch === "function" ? patch(layer as Layer) : patch);
    }
  });
}

export function translateLayers(doc: ImageDocument, ids: readonly string[], dx: number, dy: number): ImageDocument {
  return updateLayers(doc, ids, (layer) => ({ transform: { ...layer.transform, x: clamp(layer.transform.x + dx, -1, 2), y: clamp(layer.transform.y + dy, -1, 2) } }));
}

export function setLayersLocked(doc: ImageDocument, ids: readonly string[], locked: boolean): ImageDocument {
  const wanted = new Set(ids);
  return produce(doc, (draft) => {
    for (const layer of draft.layers) if (wanted.has(layer.id)) layer.locked = locked || undefined;
  });
}

export function setLayersHidden(doc: ImageDocument, ids: readonly string[], hidden: boolean): ImageDocument {
  const wanted = new Set(ids);
  return produce(doc, (draft) => {
    for (const layer of draft.layers) if (wanted.has(layer.id)) layer.hidden = hidden || undefined;
  });
}

export function deleteLayers(doc: ImageDocument, ids: readonly string[]): ImageDocument {
  const targets = editable(doc, ids);
  if (targets.size === 0) return doc;
  return produce(doc, (draft) => {
    draft.layers = draft.layers.filter((l) => !targets.has(l.id));
    cleanupGroups(draft);
  });
}

function insertClones(
  doc: ImageDocument,
  sources: readonly Layer[],
  meta: readonly StudioGroup[],
  offset: number,
  atIndex: number,
  keep: (groupId: string) => boolean,
): { document: ImageDocument; ids: string[] } {
  if (sources.length === 0 || !canAddLayers(doc, sources.length)) return { document: doc, ids: [] };
  const { layers: copies, groups } = cloneWithGroups(sources, meta, offset, keep, (v) => clamp(v, -1, 2));
  const document = produce(addLayers(doc, copies, atIndex), (draft) => {
    if (groups.length > 0) draft.groups = [...(draft.groups ?? []), ...groups];
    cleanupGroups(draft);
  });
  return { document, ids: copies.map((c) => c.id) };
}

export function duplicateLayers(doc: ImageDocument, ids: readonly string[], offset: number = DUPLICATE_OFFSET): { document: ImageDocument; ids: string[] } {
  const wanted = new Set(ids);
  const sources = doc.layers.filter((l) => wanted.has(l.id));
  const top = Math.max(-1, ...sources.map((l) => doc.layers.indexOf(l)));
  const whole = (groupId: string) => groupLayerIds(doc, groupId).every((id) => wanted.has(id));
  return insertClones(doc, sources, doc.groups ?? [], offset, top + 1, (groupId) => !whole(groupId));
}

export function pasteLayers(
  doc: ImageDocument,
  layers: readonly Layer[],
  offset: number = DUPLICATE_OFFSET,
  groups: readonly StudioGroup[] = [],
): { document: ImageDocument; ids: string[] } {
  return insertClones(doc, layers, groups, offset, doc.layers.length, () => false);
}

export function reorderLayers(doc: ImageDocument, ids: readonly string[], direction: OrderDirection): ImageDocument {
  const wanted = new Set(ids);
  if (!doc.layers.some((l) => wanted.has(l.id))) return doc;
  return produce(doc, (draft) => {
    const picked = draft.layers.filter((l) => wanted.has(l.id));
    const rest = draft.layers.filter((l) => !wanted.has(l.id));
    if (direction === "front") {
      draft.layers = [...rest, ...picked];
      return;
    }
    if (direction === "back") {
      draft.layers = [...picked, ...rest];
      return;
    }
    const layers = [...draft.layers];
    const step = direction === "forward" ? 1 : -1;
    const order = step === 1 ? [...layers.keys()].reverse() : [...layers.keys()];
    for (const i of order) {
      const j = i + step;
      if (!wanted.has(layers[i].id) || j < 0 || j >= layers.length || wanted.has(layers[j].id)) continue;
      [layers[i], layers[j]] = [layers[j], layers[i]];
    }
    draft.layers = layers;
  });
}

export function moveLayerTo(doc: ImageDocument, id: string, toIndex: number): ImageDocument {
  const from = doc.layers.findIndex((l) => l.id === id);
  const to = clamp(Math.round(toIndex), 0, doc.layers.length - 1);
  if (from < 0 || from === to) return doc;
  return produce(doc, (draft) => {
    const [layer] = draft.layers.splice(from, 1);
    draft.layers.splice(to, 0, layer);
  });
}

function commonParent(doc: ImageDocument, ids: readonly string[]): string | null {
  const chains = ids.map((id) => groupAncestry(doc, layerById(doc, id)?.groupId).reverse());
  let shared: string | null = null;
  for (let depth = 0; chains.every((c) => depth < c.length && c[depth] === chains[0][depth]); depth++) shared = chains[0][depth];
  const wanted = new Set(ids);
  const parents = groupParents(doc);
  while (shared !== null && groupLayerIds(doc, shared).every((id) => wanted.has(id))) shared = parents.get(shared) ?? null;
  return shared;
}

function childUnder(doc: ImageDocument, layerId: string, parent: string | null): { kind: "layer" | "group"; id: string } {
  const chain = groupAncestry(doc, layerById(doc, layerId)?.groupId);
  const index = parent === null ? chain.length : chain.indexOf(parent);
  return index > 0 ? { kind: "group", id: chain[index - 1] } : { kind: "layer", id: layerId };
}

export function groupLayers(doc: ImageDocument, ids: readonly string[]): { document: ImageDocument; groupId: string | null } {
  const present = ids.filter((id) => layerById(doc, id));
  if (present.length === 0) return { document: doc, groupId: null };
  const parent = commonParent(doc, present);
  const children = new Map(present.map((id) => childUnder(doc, id, parent)).map((c) => [c.kind + ":" + c.id, c]));
  if (children.size < 2) return { document: doc, groupId: null };
  const groupId = newStudioId("g");
  const document = produce(doc, (draft) => {
    const groups = [...(draft.groups ?? []), { id: groupId, ...(parent ? { parentId: parent } : {}) }];
    draft.groups = groups;
    for (const child of children.values()) {
      if (child.kind === "layer") {
        const layer = draft.layers.find((l) => l.id === child.id);
        if (layer) layer.groupId = groupId;
        continue;
      }
      const entry = draft.groups.find((g) => g.id === child.id);
      if (entry) entry.parentId = groupId;
      else draft.groups.push({ id: child.id, parentId: groupId });
    }
    const members = new Set(groupLayerIds(draft as ImageDocument, groupId));
    const top = Math.max(...draft.layers.map((l, i) => (members.has(l.id) ? i : -1)));
    const above = draft.layers.slice(top + 1);
    const below = draft.layers.slice(0, top + 1).filter((l) => !members.has(l.id));
    const picked = draft.layers.filter((l) => members.has(l.id));
    draft.layers = [...below, ...picked, ...above];
    cleanupGroups(draft);
  });
  return { document, groupId };
}

export function ungroupLayers(doc: ImageDocument, ids: readonly string[]): ImageDocument {
  const tops = new Set(ids.map((id) => outermostGroup(doc, id)).filter((g): g is string => g !== null));
  if (tops.size === 0) return doc;
  return produce(doc, (draft) => {
    for (const l of draft.layers) if (l.groupId && tops.has(l.groupId)) delete l.groupId;
    for (const g of draft.groups ?? []) if (g.parentId && tops.has(g.parentId)) delete g.parentId;
    if (draft.groups) draft.groups = draft.groups.filter((g) => !tops.has(g.id));
    cleanupGroups(draft);
  });
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

export function selectionBounds(doc: ImageDocument, ids: readonly string[]): Bounds | null {
  const wanted = new Set(ids);
  const picked = doc.layers.filter((l) => wanted.has(l.id));
  return picked.length === 0 ? null : union(picked.map((l) => layerBounds(l.transform, doc.canvas)));
}

interface Unit {
  ids: string[];
  bounds: Bounds;
}

function units(doc: ImageDocument, ids: readonly string[]): Unit[] {
  const targets = editable(doc, withGroupMembers(doc, ids));
  const byKey = new Map<string, Layer[]>();
  for (const l of doc.layers) {
    if (!targets.has(l.id)) continue;
    const key = outermostGroup(doc, l.id) ?? `layer:${l.id}`;
    byKey.set(key, [...(byKey.get(key) ?? []), l]);
  }
  return [...byKey.values()].map((layers) => ({ ids: layers.map((l) => l.id), bounds: union(layers.map((l) => layerBounds(l.transform, doc.canvas))) }));
}

function shiftUnits(doc: ImageDocument, shifts: Map<string, [number, number]>): ImageDocument {
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

export function alignLayers(doc: ImageDocument, ids: readonly string[], alignment: Alignment): ImageDocument {
  const found = units(doc, ids);
  if (found.length === 0) return doc;
  const frame = found.length === 1 ? { left: 0, top: 0, right: doc.canvas.width, bottom: doc.canvas.height } : union(found.map((u) => u.bounds));
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

export function distributeLayers(doc: ImageDocument, ids: readonly string[], axis: DistributeAxis): ImageDocument {
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

export function resizeCanvas(doc: ImageDocument, size: CanvasSize): ImageDocument {
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
