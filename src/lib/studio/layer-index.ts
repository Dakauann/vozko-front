import type { ImageSurface, Layer, StudioGroup } from "./document";

export type IndexSource = Pick<ImageSurface, "layers" | "groups">;

export interface LayerIndex {
  layers: ReadonlyMap<string, Layer>;
  position: ReadonlyMap<string, number>;
  groups: ReadonlyMap<string, StudioGroup>;
  parents: ReadonlyMap<string, string | null>;
  members: ReadonlyMap<string, readonly string[]>;
  bases: ReadonlyMap<string, string | null>;
  bottom: ReadonlyMap<string, number>;
}

const NO_GROUPS: readonly StudioGroup[] = Object.freeze([]);
const cache = new WeakMap<readonly Layer[], WeakMap<readonly StudioGroup[], LayerIndex>>();

function chainOf(parents: ReadonlyMap<string, string | null>, groupId: string | undefined): string[] {
  const chain: string[] = [];
  for (let at = groupId ?? null; at !== null && parents.has(at) && !chain.includes(at); at = parents.get(at) ?? null) chain.push(at);
  return chain;
}

function build(source: IndexSource): LayerIndex {
  const layers = new Map<string, Layer>();
  const position = new Map<string, number>();
  source.layers.forEach((layer, i) => {
    if (layers.has(layer.id)) return;
    layers.set(layer.id, layer);
    position.set(layer.id, i);
  });
  const groups = new Map((source.groups ?? NO_GROUPS).map((g) => [g.id, g]));
  const parents = new Map<string, string | null>();
  for (const g of source.groups ?? NO_GROUPS) parents.set(g.id, g.parentId || null);
  for (const l of source.layers) if (l.groupId && !parents.has(l.groupId)) parents.set(l.groupId, null);
  const members = new Map<string, string[]>();
  const bottom = new Map<string, number>();
  source.layers.forEach((layer, i) => {
    for (const groupId of chainOf(parents, layer.groupId)) {
      const list = members.get(groupId) ?? [];
      list.push(layer.id);
      members.set(groupId, list);
      if (!bottom.has(groupId)) bottom.set(groupId, i);
    }
  });
  const bases = new Map<string, string | null>();
  for (const groupId of parents.keys()) {
    const baseId = groups.get(groupId)?.baseId;
    bases.set(groupId, baseId && layers.get(baseId)?.groupId === groupId ? baseId : null);
  }
  return { layers, position, groups, parents, members, bases, bottom };
}

export function indexOf(source: IndexSource): LayerIndex {
  const groups = source.groups ?? NO_GROUPS;
  if (!Object.isFrozen(source.layers) || !Object.isFrozen(groups)) return build(source);
  const byGroups = cache.get(source.layers) ?? new WeakMap<readonly StudioGroup[], LayerIndex>();
  cache.set(source.layers, byGroups);
  const known = byGroups.get(groups);
  if (known) return known;
  const built = build(source);
  byGroups.set(groups, built);
  return built;
}
