import { produce } from "immer";

import { newStudioId, type CanvasSize, type ImageSurface, type Layer, type StudioGroup } from "./document";
import { cleanupGroups, cloneWithGroups, groupLayerIds, groupParents, isGroupWithin } from "./groups";
import { LAYER_RANGES, normalizedRotation } from "./layer-ranges";
import { groupLayers, layerBounds } from "./layers";
import { placeBy, repeatInstances, type Affine, type Repeat, type RepeatBox } from "./repeat";

const INSTANCE_MARK = "#r";

export function sourceBox(members: readonly Layer[], canvas: CanvasSize): RepeatBox {
  const bounds = members.map((layer) => layerBounds(layer.transform, canvas));
  return {
    left: Math.min(...bounds.map((b) => b.left)),
    top: Math.min(...bounds.map((b) => b.top)),
    right: Math.max(...bounds.map((b) => b.right)),
    bottom: Math.max(...bounds.map((b) => b.bottom)),
  };
}

function placed(layer: Layer, m: Affine, canvas: CanvasSize): Layer {
  const pose = placeBy(m, { x: layer.transform.x * canvas.width, y: layer.transform.y * canvas.height, rotation: layer.transform.rotation, flipX: Boolean(layer.flipX) });
  return { ...layer, flipX: pose.flipX ? true : undefined, transform: { ...layer.transform, x: pose.x / canvas.width, y: pose.y / canvas.height, rotation: normalizedRotation(pose.rotation) } };
}

export function repeatCopyId(id: string, index: number): string {
  return `${id}${INSTANCE_MARK}${index}`;
}

function membersOf(surface: ImageSurface, groupId: string): Layer[] {
  const ids = new Set(groupLayerIds(surface, groupId));
  return surface.layers.filter((layer) => ids.has(layer.id));
}

function instancePlaces(repeat: Repeat, members: readonly Layer[], canvas: CanvasSize): { place: Affine; index: number }[] {
  const box = sourceBox(members, canvas);
  if (box.right - box.left <= 0 || box.bottom - box.top <= 0) return [];
  const places = repeatInstances(repeat, box)
    .map((place, index) => ({ place, index }))
    .slice(1);
  return repeat.reverseOverlap ? places.reverse() : places;
}

const expansions = new WeakMap<ImageSurface, Layer[]>();

export function repeatedLayers(surface: ImageSurface): Layer[] {
  const known = expansions.get(surface);
  if (known) return known;
  const repeating = (surface.groups ?? []).filter((group) => group.repeat);
  if (repeating.length === 0) return surface.layers;
  const extras = new Map<string, Layer[]>();
  for (const group of repeating) {
    const members = membersOf(surface, group.id);
    if (members.length === 0) continue;
    const copies = instancePlaces(group.repeat!, members, surface.canvas).flatMap(({ place, index }) =>
      members.map((member) => ({ ...placed(member, place, surface.canvas), id: repeatCopyId(member.id, index), locked: true })),
    );
    extras.set(members[members.length - 1].id, copies);
  }
  const expanded = surface.layers.flatMap((layer) => [layer, ...(extras.get(layer.id) ?? [])]);
  expansions.set(surface, expanded);
  return expanded;
}

export function repeatSourceId(id: string): string {
  return id.split(INSTANCE_MARK)[0];
}

export function selectionGroup(surface: ImageSurface, ids: readonly string[]): string | null {
  const wanted = new Set(ids);
  const matches = (surface.groups ?? []).filter((group) => {
    const members = groupLayerIds(surface, group.id);
    return members.length === wanted.size && members.every((id) => wanted.has(id));
  });
  const parents = groupParents(surface);
  const outer = matches.find((group) => !matches.some((other) => other.id === parents.get(group.id)));
  return outer?.id ?? null;
}

export function repeatConflict(surface: ImageSurface, groupId: string): boolean {
  return (surface.groups ?? []).some((group) => group.id !== groupId && group.repeat && (isGroupWithin(surface, groupId, group.id) || isGroupWithin(surface, group.id, groupId)));
}

function withRepeat(surface: ImageSurface, groupId: string, repeat: Repeat): ImageSurface {
  return produce(surface, (draft) => {
    const group = draft.groups?.find((g) => g.id === groupId);
    if (group) group.repeat = repeat;
  });
}

function wrapSingle(surface: ImageSurface, layerId: string, repeat: Repeat): { document: ImageSurface; groupId: string } {
  const groupId = newStudioId("g");
  const layer = surface.layers.find((l) => l.id === layerId)!;
  const group: StudioGroup = { id: groupId, ...(layer.groupId ? { parentId: layer.groupId } : {}), repeat };
  const document = produce(surface, (draft) => {
    draft.groups = [...(draft.groups ?? []), group];
    const target = draft.layers.find((l) => l.id === layerId)!;
    target.groupId = groupId;
  });
  return { document, groupId };
}

interface RepeatOutcome {
  document: ImageSurface;
  groupId: string | null;
}

export function repeatLayers(surface: ImageSurface, ids: readonly string[], repeat: Repeat): RepeatOutcome {
  const present = ids.filter((id) => surface.layers.some((l) => l.id === id));
  if (present.length === 0) return { document: surface, groupId: null };
  const existing = selectionGroup(surface, present);
  if (existing) return repeatConflict(surface, existing) ? { document: surface, groupId: null } : { document: withRepeat(surface, existing, repeat), groupId: existing };
  const layer = surface.layers.find((l) => l.id === present[0])!;
  if (present.length === 1) {
    if ((surface.groups ?? []).some((group) => group.repeat && layer.groupId && (group.id === layer.groupId || isGroupWithin(surface, layer.groupId, group.id)))) return { document: surface, groupId: null };
    return wrapSingle(surface, layer.id, repeat);
  }
  const grouped = groupLayers(surface, present);
  if (!grouped.groupId || repeatConflict(grouped.document, grouped.groupId)) return { document: surface, groupId: null };
  return { document: withRepeat(grouped.document, grouped.groupId, repeat), groupId: grouped.groupId };
}

export function setRepeat(surface: ImageSurface, groupId: string, repeat: Repeat | undefined): ImageSurface {
  if (!(surface.groups ?? []).some((g) => g.id === groupId)) return surface;
  if (repeat) return withRepeat(surface, groupId, repeat);
  return produce(surface, (draft) => {
    const group = draft.groups?.find((g) => g.id === groupId);
    if (group) delete group.repeat;
    cleanupGroups(draft);
  });
}

type ExpandOutcome = { ok: true; document: ImageSurface; created: string[] } | { ok: false; reason: "missing" | "out_of_range" };

function inRange(layer: Layer): boolean {
  const [lo, hi] = LAYER_RANGES.position;
  return layer.transform.x >= lo && layer.transform.x <= hi && layer.transform.y >= lo && layer.transform.y <= hi;
}

export function expandRepeat(surface: ImageSurface, groupId: string): ExpandOutcome {
  const group = (surface.groups ?? []).find((g) => g.id === groupId);
  const members = group?.repeat ? membersOf(surface, groupId) : [];
  if (!group?.repeat || members.length === 0) return { ok: false, reason: "missing" };
  const keep = (id: string) => id === groupId || !isGroupWithin(surface, id, groupId);
  const copies: Layer[] = [];
  const groups: StudioGroup[] = [];
  for (const { place } of instancePlaces(group.repeat, members, surface.canvas)) {
    const cloned = cloneWithGroups(members, surface.groups ?? [], 0, keep, (value) => value);
    const instance = newStudioId("g");
    groups.push({ id: instance, parentId: groupId }, ...cloned.groups.map((g) => (g.parentId === groupId ? { ...g, parentId: instance } : g)));
    cloned.layers.forEach((copy, i) => copies.push({ ...placed({ ...copy, transform: members[i].transform, flipX: members[i].flipX }, place, surface.canvas), groupId: copy.groupId === groupId ? instance : copy.groupId }));
  }
  if (!copies.every(inRange)) return { ok: false, reason: "out_of_range" };
  const top = surface.layers.findIndex((l) => l.id === members[members.length - 1].id);
  const document = produce(surface, (draft) => {
    draft.layers.splice(top + 1, 0, ...copies);
    draft.groups = [...(draft.groups ?? []), ...groups];
    const target = draft.groups.find((g) => g.id === groupId);
    if (target) delete target.repeat;
    cleanupGroups(draft);
  });
  return { ok: true, document, created: copies.map((copy) => copy.id) };
}
