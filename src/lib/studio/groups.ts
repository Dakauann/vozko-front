import { produce, type Draft } from "immer";

import { newStudioId, type ImageDocument, type Layer, type StudioGroup } from "./document";

export type TreeItem = { kind: "layer"; id: string } | { kind: "group"; id: string };

export type DropPosition = "above" | "below" | "into";

export interface Placement {
  toIndex: number;
  parent: string | null;
}

type GroupSource = Pick<ImageDocument, "layers" | "groups">;

export function groupParents(doc: GroupSource): Map<string, string | null> {
  const parents = new Map<string, string | null>();
  for (const g of doc.groups ?? []) parents.set(g.id, g.parentId || null);
  for (const l of doc.layers) if (l.groupId && !parents.has(l.groupId)) parents.set(l.groupId, null);
  return parents;
}

export function groupAncestry(doc: GroupSource, groupId: string | null | undefined): string[] {
  const parents = groupParents(doc);
  const chain: string[] = [];
  for (let at = groupId ?? null; at !== null && parents.has(at) && !chain.includes(at); at = parents.get(at) ?? null) chain.push(at);
  return chain;
}

export function layerChain(doc: GroupSource, layerId: string): string[] {
  return groupAncestry(doc, doc.layers.find((l) => l.id === layerId)?.groupId);
}

export function outermostGroup(doc: GroupSource, layerId: string): string | null {
  const chain = layerChain(doc, layerId);
  return chain.length > 0 ? chain[chain.length - 1] : null;
}

export function groupLayerIds(doc: GroupSource, groupId: string): string[] {
  return doc.layers.filter((l) => groupAncestry(doc, l.groupId).includes(groupId)).map((l) => l.id);
}

export function isGroupWithin(doc: GroupSource, groupId: string, ancestorId: string): boolean {
  return groupAncestry(doc, groupId).includes(ancestorId);
}

function materialize(draft: Draft<ImageDocument>, groupId: string): Draft<StudioGroup> {
  draft.groups ??= [];
  let entry = draft.groups.find((g) => g.id === groupId);
  if (!entry) {
    entry = { id: groupId };
    draft.groups.push(entry);
  }
  return entry;
}

function setParent(draft: Draft<ImageDocument>, groupId: string, parent: string | null) {
  const entry = materialize(draft, groupId);
  if (parent) entry.parentId = parent;
  else delete entry.parentId;
}

export function cleanupGroups(draft: Draft<ImageDocument>) {
  for (let changed = true; changed; ) {
    changed = false;
    const parents = groupParents(draft as ImageDocument);
    const children = new Map<string, number>();
    for (const l of draft.layers) if (l.groupId) children.set(l.groupId, (children.get(l.groupId) ?? 0) + 1);
    const live = new Set<string>();
    for (const l of draft.layers) for (const g of groupAncestry(draft as ImageDocument, l.groupId)) live.add(g);
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
}

function dissolveInDraft(draft: Draft<ImageDocument>, groupId: string) {
  const parent = groupParents(draft as ImageDocument).get(groupId) ?? null;
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

export function dissolveGroup(doc: ImageDocument, groupId: string): ImageDocument {
  if (!groupParents(doc).has(groupId)) return doc;
  return produce(doc, (draft) => {
    dissolveInDraft(draft, groupId);
    cleanupGroups(draft);
  });
}

export function renameGroup(doc: ImageDocument, groupId: string, name: string): ImageDocument {
  if (!groupParents(doc).has(groupId)) return doc;
  const clean = name.trim();
  return produce(doc, (draft) => {
    const entry = materialize(draft, groupId);
    if (clean) entry.name = clean;
    else delete entry.name;
  });
}

export function nestGroup(doc: ImageDocument, groupId: string, parent: string | null): ImageDocument {
  const parents = groupParents(doc);
  if (!parents.has(groupId) || (parent !== null && (!parents.has(parent) || isGroupWithin(doc, parent, groupId)))) return doc;
  return produce(doc, (draft) => {
    setParent(draft, groupId, parent);
    cleanupGroups(draft);
  });
}

function itemLayerIds(doc: ImageDocument, item: TreeItem): string[] {
  return item.kind === "layer" ? (doc.layers.some((l) => l.id === item.id) ? [item.id] : []) : groupLayerIds(doc, item.id);
}

export function moveItem(doc: ImageDocument, item: TreeItem, toIndex: number, parent: string | null): ImageDocument {
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

function placementIndex(doc: ImageDocument, block: Set<string>, insertAt: number): number {
  return insertAt - doc.layers.slice(0, insertAt).filter((l) => block.has(l.id)).length;
}

export function dropPlacement(doc: ImageDocument, item: TreeItem, target: TreeItem, position: DropPosition): Placement | null {
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
  const mapped = new Map<string, string>();
  for (const l of sources) for (const g of groupAncestry(source, l.groupId)) if (!keep(g) && !mapped.has(g)) mapped.set(g, newStudioId("g"));
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
    return { id, ...(parentId ? { parentId } : {}), ...(name ? { name } : {}) };
  });
  const layers = sources.map((l): Layer => {
    const copy: Layer = { ...l, id: newStudioId("l"), locked: undefined, transform: { ...l.transform, x: clamp(l.transform.x + offset), y: clamp(l.transform.y + offset) } };
    const groupId = resolve(l.groupId);
    if (groupId) copy.groupId = groupId;
    else delete copy.groupId;
    return copy;
  });
  return { layers, groups };
}
