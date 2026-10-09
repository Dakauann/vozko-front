import { produce, type Draft } from "immer";

import { newStudioId, type ImageSurface, type Layer, type StudioGroup } from "./document";
import { indexOf } from "./layer-index";

export type TreeItem = { kind: "layer"; id: string } | { kind: "group"; id: string };

export type DropPosition = "above" | "below" | "into";

export interface Placement {
  toIndex: number;
  parent: string | null;
}

type GroupSource = Pick<ImageSurface, "layers" | "groups">;

export function groupParents(doc: GroupSource): ReadonlyMap<string, string | null> {
  return indexOf(doc).parents;
}

export function ancestry(parents: ReadonlyMap<string, string | null>, groupId: string | null | undefined): string[] {
  const chain: string[] = [];
  for (let at = groupId ?? null; at !== null && parents.has(at) && !chain.includes(at); at = parents.get(at) ?? null) chain.push(at);
  return chain;
}

export function groupAncestry(doc: GroupSource, groupId: string | null | undefined): string[] {
  return ancestry(groupParents(doc), groupId);
}

export function layerChain(doc: GroupSource, layerId: string): string[] {
  const index = indexOf(doc);
  return ancestry(index.parents, index.layers.get(layerId)?.groupId);
}

export function groupLayerIds(doc: GroupSource, groupId: string): string[] {
  return [...(indexOf(doc).members.get(groupId) ?? [])];
}

export function isGroupWithin(doc: GroupSource, groupId: string, ancestorId: string): boolean {
  return groupAncestry(doc, groupId).includes(ancestorId);
}

export function baseOf(doc: GroupSource, groupId: string): string | null {
  return indexOf(doc).bases.get(groupId) ?? null;
}

export function scaffoldOf(doc: GroupSource, layerId: string): string | null {
  const index = indexOf(doc);
  const groupId = index.layers.get(layerId)?.groupId;
  return groupId && index.bases.get(groupId) === layerId ? groupId : null;
}

export function familyOf(doc: GroupSource, ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  for (const id of ids) {
    const scaffold = scaffoldOf(doc, id);
    if (scaffold) for (const member of groupLayerIds(doc, scaffold)) wanted.add(member);
  }
  return doc.layers.filter((l) => wanted.has(l.id)).map((l) => l.id);
}

export function captureGroup(doc: GroupSource, layerId: string): string | null {
  const plain = layerChain(doc, layerId).filter((groupId) => !baseOf(doc, groupId));
  return plain.length > 0 ? plain[plain.length - 1] : null;
}

export function itemOf(doc: GroupSource, layerId: string): TreeItem {
  const scaffold = scaffoldOf(doc, layerId);
  return scaffold ? { kind: "group", id: scaffold } : { kind: "layer", id: layerId };
}

export function itemLayerIds(doc: GroupSource, item: TreeItem): string[] {
  return item.kind === "layer" ? (indexOf(doc).layers.has(item.id) ? [item.id] : []) : groupLayerIds(doc, item.id);
}

export function containerOf(doc: GroupSource, item: TreeItem): string | null {
  const index = indexOf(doc);
  if (item.kind === "group") return index.parents.get(item.id) ?? null;
  return index.layers.get(item.id)?.groupId ?? null;
}

function itemKey(item: TreeItem): string {
  return `${item.kind}:${item.id}`;
}

function itemWithin(doc: GroupSource, item: TreeItem, groupId: string): boolean {
  return item.kind === "layer" ? layerChain(doc, item.id).includes(groupId) : isGroupWithin(doc, item.id, groupId);
}

export function selectionItems(doc: GroupSource, ids: readonly string[]): TreeItem[] {
  const wanted = new Set(familyOf(doc, ids));
  const parents = groupParents(doc);
  const found = new Map<string, TreeItem>();
  const members = indexOf(doc).members;
  for (const id of ids) {
    if (!indexOf(doc).layers.has(id)) continue;
    let item = itemOf(doc, id);
    for (let up = containerOf(doc, item); up !== null && (members.get(up) ?? []).every((m) => wanted.has(m)); up = parents.get(up) ?? null) item = { kind: "group", id: up };
    found.set(itemKey(item), item);
  }
  const items = [...found.values()];
  return items.filter((item) => !items.some((other) => other !== item && other.kind === "group" && itemWithin(doc, item, other.id)));
}

export function bottomIndex(doc: GroupSource, item: TreeItem): number {
  const index = indexOf(doc);
  return (item.kind === "layer" ? index.position.get(item.id) : index.bottom.get(item.id)) ?? -1;
}

export function siblingItems(doc: GroupSource, container: string | null): TreeItem[] {
  const base = container ? baseOf(doc, container) : null;
  const items: TreeItem[] = [];
  for (const l of doc.layers) if ((l.groupId ?? null) === container && l.id !== base) items.push({ kind: "layer", id: l.id });
  for (const [id, parent] of groupParents(doc)) if (parent === container) items.push({ kind: "group", id });
  return items
    .map((item) => ({ item, bottom: bottomIndex(doc, item) }))
    .filter((entry) => entry.bottom >= 0)
    .sort((a, b) => a.bottom - b.bottom)
    .map((entry) => entry.item);
}

export function treeLayerOrder(doc: GroupSource, orderOf: (container: string | null) => TreeItem[]): string[] | null {
  const visited = new Set<string>();
  const visit = (container: string | null): string[] => {
    if (container !== null && visited.has(container)) return [];
    if (container !== null) visited.add(container);
    const base = container ? baseOf(doc, container) : null;
    return [...(base ? [base] : []), ...orderOf(container).flatMap((item) => (item.kind === "layer" ? [item.id] : visit(item.id)))];
  };
  const ids = visit(null);
  return ids.length === doc.layers.length && new Set(ids).size === ids.length ? ids : null;
}

function materialize(draft: Draft<ImageSurface>, groupId: string): Draft<StudioGroup> {
  draft.groups ??= [];
  let entry = draft.groups.find((g) => g.id === groupId);
  if (!entry) {
    entry = { id: groupId };
    draft.groups.push(entry);
  }
  return entry;
}

function setParent(draft: Draft<ImageSurface>, groupId: string, parent: string | null) {
  const entry = materialize(draft, groupId);
  if (parent) entry.parentId = parent;
  else delete entry.parentId;
}

function orphanedScaffold(draft: Draft<ImageSurface>): string | null {
  const homes = new Map(draft.layers.map((l) => [l.id, l.groupId ?? null]));
  return draft.groups?.find((g) => g.baseId && homes.get(g.baseId) !== g.id)?.id ?? null;
}

function keepBasesAtTheBottom(draft: Draft<ImageSurface>) {
  for (const g of draft.groups ?? []) {
    const base = baseOf(draft as ImageSurface, g.id);
    if (!base) continue;
    const members = new Set(groupLayerIds(draft as ImageSurface, g.id));
    const bottom = draft.layers.findIndex((l) => members.has(l.id));
    const at = draft.layers.findIndex((l) => l.id === base);
    if (at <= bottom) continue;
    const [layer] = draft.layers.splice(at, 1);
    draft.layers.splice(bottom, 0, layer);
  }
}

export function cleanupGroups(draft: Draft<ImageSurface>) {
  for (let changed = true; changed; ) {
    changed = false;
    const orphan = orphanedScaffold(draft);
    if (orphan) {
      dissolveInDraft(draft, orphan);
      changed = true;
      continue;
    }
    const parents = groupParents(draft as ImageSurface);
    const children = new Map<string, number>();
    for (const l of draft.layers) if (l.groupId) children.set(l.groupId, (children.get(l.groupId) ?? 0) + 1);
    const live = new Set<string>();
    for (const l of draft.layers) for (const g of ancestry(parents, l.groupId)) live.add(g);
    for (const [id, parent] of parents) if (parent && live.has(id)) children.set(parent, (children.get(parent) ?? 0) + 1);
    for (const id of parents.keys()) {
      if (!live.has(id) || (children.get(id) ?? 0) >= 2) continue;
      dissolveInDraft(draft, id);
      changed = true;
      break;
    }
    if (draft.groups) {
      const before = draft.groups.length;
      draft.groups = draft.groups.filter((g) => live.has(g.id));
      if (draft.groups.length !== before) changed = true;
    }
  }
  if (draft.groups && draft.groups.length === 0) delete draft.groups;
  keepBasesAtTheBottom(draft);
}

function dissolveInDraft(draft: Draft<ImageSurface>, groupId: string) {
  const parent = groupParents(draft as ImageSurface).get(groupId) ?? null;
  for (const l of draft.layers) {
    if (l.groupId !== groupId) continue;
    if (parent) l.groupId = parent;
    else delete l.groupId;
  }
  for (const g of draft.groups ?? []) {
    if (g.parentId !== groupId) continue;
    if (parent) g.parentId = parent;
    else delete g.parentId;
  }
  if (draft.groups) draft.groups = draft.groups.filter((g) => g.id !== groupId);
}

export function dissolveGroup(doc: ImageSurface, groupId: string): ImageSurface {
  if (!groupParents(doc).has(groupId)) return doc;
  return produce(doc, (draft) => {
    dissolveInDraft(draft, groupId);
    cleanupGroups(draft);
  });
}

export function renameGroup(doc: ImageSurface, groupId: string, name: string): ImageSurface {
  if (!groupParents(doc).has(groupId)) return doc;
  const clean = name.trim();
  return produce(doc, (draft) => {
    const entry = materialize(draft, groupId);
    if (clean) entry.name = clean;
    else delete entry.name;
  });
}

export function nestGroup(doc: ImageSurface, groupId: string, parent: string | null): ImageSurface {
  const parents = groupParents(doc);
  if (!parents.has(groupId) || (parent !== null && (!parents.has(parent) || isGroupWithin(doc, parent, groupId)))) return doc;
  return produce(doc, (draft) => {
    setParent(draft, groupId, parent);
    cleanupGroups(draft);
  });
}

export function moveItem(doc: ImageSurface, item: TreeItem, toIndex: number, parent: string | null): ImageSurface {
  const block = new Set(itemLayerIds(doc, item));
  if (block.size === 0) return doc;
  if (parent !== null && !groupParents(doc).has(parent)) return doc;
  if (item.kind === "group" && parent !== null && (parent === item.id || isGroupWithin(doc, parent, item.id))) return doc;
  return produce(doc, (draft) => {
    const moving = draft.layers.filter((l) => block.has(l.id));
    const rest = draft.layers.filter((l) => !block.has(l.id));
    const at = Math.max(0, Math.min(Math.round(toIndex), rest.length));
    draft.layers = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
    if (item.kind === "layer") {
      const layer = draft.layers.find((l) => l.id === item.id);
      if (layer && parent) layer.groupId = parent;
      else if (layer) delete layer.groupId;
    } else {
      setParent(draft, item.id, parent);
    }
    cleanupGroups(draft);
  });
}

function placementIndex(doc: ImageSurface, block: Set<string>, insertAt: number): number {
  return insertAt - doc.layers.slice(0, insertAt).filter((l) => block.has(l.id)).length;
}

export function dropPlacement(doc: ImageSurface, item: TreeItem, target: TreeItem, position: DropPosition): Placement | null {
  const block = new Set(itemLayerIds(doc, item));
  if (target.kind === "layer") {
    const index = doc.layers.findIndex((l) => l.id === target.id);
    if (index < 0 || block.has(target.id)) return null;
    const insertAt = position === "below" ? index : index + 1;
    return { toIndex: placementIndex(doc, block, insertAt), parent: doc.layers[index].groupId ?? null };
  }
  const members = groupLayerIds(doc, target.id);
  if (members.length === 0 || (item.kind === "group" && (item.id === target.id || isGroupWithin(doc, target.id, item.id)))) return null;
  const indices = members.map((id) => doc.layers.findIndex((l) => l.id === id));
  const top = Math.max(...indices);
  const bottom = Math.min(...indices);
  const parent = groupParents(doc).get(target.id) ?? null;
  if (position === "into") return { toIndex: placementIndex(doc, block, top + 1), parent: target.id };
  if (position === "above") return { toIndex: placementIndex(doc, block, top + 1), parent };
  return { toIndex: placementIndex(doc, block, bottom), parent };
}

export function adoptItem(doc: ImageSurface, item: TreeItem, parentLayerId: string): ImageSurface {
  const parent = doc.layers.find((l) => l.id === parentLayerId);
  const moving = itemLayerIds(doc, item);
  if (!parent || moving.length === 0 || moving.includes(parentLayerId)) return doc;
  const existing = scaffoldOf(doc, parentLayerId);
  const scaffold = existing ?? newStudioId("g");
  const prepared = existing
    ? doc
    : produce(doc, (draft) => {
        draft.groups = [...(draft.groups ?? []), { id: scaffold, ...(parent.groupId ? { parentId: parent.groupId } : {}), baseId: parentLayerId }];
        const layer = draft.layers.find((l) => l.id === parentLayerId);
        if (layer) layer.groupId = scaffold;
      });
  const placement = dropPlacement(prepared, item, { kind: "group", id: scaffold }, "into");
  const next = placement ? moveItem(prepared, item, placement.toIndex, placement.parent) : prepared;
  return next === prepared ? doc : next;
}

export function dropItem(doc: ImageSurface, item: TreeItem, target: TreeItem, position: DropPosition): ImageSurface {
  if (position === "into" && target.kind === "layer") return adoptItem(doc, item, target.id);
  const placement = dropPlacement(doc, item, target, position);
  return placement ? moveItem(doc, item, placement.toIndex, placement.parent) : doc;
}

export interface ClonedLayers {
  layers: Layer[];
  groups: StudioGroup[];
}

export function cloneWithGroups(
  sources: readonly Layer[],
  meta: readonly StudioGroup[],
  offset: number,
  keep: (groupId: string) => boolean,
  clamp: (value: number) => number,
): ClonedLayers {
  const source: GroupSource = { layers: [...sources], groups: [...meta] };
  const parents = groupParents(source);
  const copied = new Map(sources.map((l) => [l.id, newStudioId("l")]));
  const baseIds = new Map(meta.map((g) => [g.id, g.baseId]));
  const cloneable = (groupId: string) => {
    const base = baseIds.get(groupId);
    return !keep(groupId) && (!base || copied.has(base));
  };
  const mapped = new Map<string, string>();
  for (const l of sources) for (const g of ancestry(parents, l.groupId)) if (cloneable(g) && !mapped.has(g)) mapped.set(g, newStudioId("g"));
  const resolve = (groupId: string | null | undefined): string | undefined => {
    for (let at = groupId ?? null; at !== null; at = parents.get(at) ?? null) {
      if (mapped.has(at)) return mapped.get(at);
      if (keep(at)) return at;
    }
    return undefined;
  };
  const groups = [...mapped].map(([original, id]): StudioGroup => {
    const name = meta.find((g) => g.id === original)?.name;
    const parentId = resolve(parents.get(original));
    const baseId = copied.get(baseIds.get(original) ?? "");
    return { id, ...(parentId ? { parentId } : {}), ...(name ? { name } : {}), ...(baseId ? { baseId } : {}) };
  });
  const layers = sources.map((l): Layer => {
    const copy: Layer = { ...l, id: copied.get(l.id)!, locked: undefined, transform: { ...l.transform, x: clamp(l.transform.x + offset), y: clamp(l.transform.y + offset) } };
    const groupId = resolve(l.groupId);
    if (groupId) copy.groupId = groupId;
    else delete copy.groupId;
    return copy;
  });
  return { layers, groups };
}
