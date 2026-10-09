import type { ImageSurface, Layer } from "./document";
import { ancestry, baseOf, groupLayerIds, groupParents, scaffoldOf } from "./groups";

export interface GroupRow {
  kind: "group";
  groupId: string;
  depth: number;
  ids: string[];
  name: string | null;
}

export interface FamilyInfo {
  scaffoldId: string;
  ids: string[];
}

export interface LayerRowEntry {
  kind: "layer";
  id: string;
  index: number;
  depth: number;
  groupId: string | null;
  family?: FamilyInfo;
}

export type LayerRow = LayerRowEntry | GroupRow;

export const CAPTION_RUNES = 32;

export function layerRows(doc: ImageSurface, collapsed: ReadonlySet<string> = new Set()): LayerRow[] {
  const rows: LayerRow[] = [];
  const names = new Map((doc.groups ?? []).map((g) => [g.id, g.name ?? null]));
  const indexOf = new Map(doc.layers.map((l, i) => [l.id, i]));
  const parents = groupParents(doc);
  let open: string[] = [];
  for (let index = doc.layers.length - 1; index >= 0; index--) {
    const layer = doc.layers[index];
    const chain = ancestry(parents, layer.groupId).reverse();
    let shared = 0;
    while (shared < open.length && shared < chain.length && open[shared] === chain[shared]) shared++;
    open = open.slice(0, shared);
    for (let depth = shared; depth < chain.length; depth++) {
      const groupId = chain[depth];
      open.push(groupId);
      if (chain.slice(0, depth).some((g) => collapsed.has(g))) continue;
      const ids = groupLayerIds(doc, groupId).reverse();
      const base = baseOf(doc, groupId);
      if (base) rows.push({ kind: "layer", id: base, index: indexOf.get(base)!, depth, groupId, family: { scaffoldId: groupId, ids } });
      else rows.push({ kind: "group", groupId, depth, ids, name: names.get(groupId) ?? null });
    }
    if (scaffoldOf(doc, layer.id) || chain.some((g) => collapsed.has(g))) continue;
    rows.push({ kind: "layer", id: layer.id, index, depth: chain.length, groupId: layer.groupId ?? null });
  }
  return rows;
}

export function rangeBetween(order: readonly string[], anchor: string | null, target: string): string[] {
  const to = order.indexOf(target);
  const from = anchor ? order.indexOf(anchor) : -1;
  if (to < 0) return [];
  if (from < 0) return [target];
  return order.slice(Math.min(from, to), Math.max(from, to) + 1);
}

export function toggleIn(current: readonly string[], ids: readonly string[]): string[] {
  const all = ids.every((id) => current.includes(id));
  return all ? current.filter((id) => !ids.includes(id)) : [...current, ...ids.filter((id) => !current.includes(id))];
}

export type LayerCaption = { name: string } | { kind: string };

export function layerCaption(layer: Layer): LayerCaption {
  if (layer.name) return { name: layer.name };
  if (layer.type === "text") {
    const clean = (layer.text ?? "").split(/\s+/).filter(Boolean).join(" ");
    const runes = [...clean];
    if (runes.length > 0) return { name: runes.length > CAPTION_RUNES ? `${runes.slice(0, CAPTION_RUNES - 1).join("").trimEnd()}…` : clean };
  }
  if (layer.type === "shape" && layer.shape) return { kind: `shape.${layer.shape}` };
  return { kind: layer.type };
}
