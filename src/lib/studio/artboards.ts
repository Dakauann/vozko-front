import { produce, type Draft } from "immer";

import {
  DEFAULT_IMAGE_BACKGROUND,
  IMAGE_DOCUMENT_VERSION,
  newStudioId,
  STUDIO_LIMITS,
  type Artboard,
  type CanvasSize,
  type Gradient,
  type ImageDocument,
  type ImageSurface,
  type Layer,
  type LegacyImageDocument,
  type StudioGroup,
} from "./document";
import { ancestry, cleanupGroups, cloneWithGroups, familyOf, groupParents } from "./groups";
import { indexOf } from "./layer-index";
import { clampTo, LAYER_RANGES } from "./layer-ranges";
import { resizeCanvas, type Bounds } from "./layers";
import type { Point } from "./viewport";

export const ARTBOARD_GAP = 100;
export const FIRST_ARTBOARD_ID = "artboard-1";

export type LayerTransfer = "keep-place" | "keep-relative";

export interface NewArtboard {
  name?: string;
  background?: string;
  gradient?: Gradient;
  after?: string;
}

export interface ArtboardCopy {
  document: ImageDocument;
  id: string;
  copies: Record<string, string>;
}

export interface ArtboardPatch {
  name?: string;
  x?: number;
  y?: number;
}

export function upgradeImageDocument(legacy: LegacyImageDocument): ImageDocument {
  const { canvas, layers, groups } = legacy;
  return { schema: legacy.schema, version: IMAGE_DOCUMENT_VERSION, artboards: [{ id: FIRST_ARTBOARD_ID, x: 0, y: 0, canvas, layers, ...(groups ? { groups } : {}) }] };
}

const homes = new WeakMap<readonly Artboard[], Map<string, Artboard>>();

function homeIndex(doc: ImageDocument): Map<string, Artboard> {
  const known = Object.isFrozen(doc.artboards) ? homes.get(doc.artboards) : undefined;
  if (known) return known;
  const built = new Map<string, Artboard>();
  for (const artboard of doc.artboards) for (const layer of artboard.layers) built.set(layer.id, artboard);
  if (Object.isFrozen(doc.artboards)) homes.set(doc.artboards, built);
  return built;
}

export function artboardNames(artboards: readonly Artboard[], untitled: (position: number) => string): Map<string, string> {
  return new Map(artboards.map((a, i) => [a.id, a.name ?? untitled(i + 1)]));
}

export function artboardById(doc: ImageDocument, id: string): Artboard | undefined {
  return doc.artboards.find((a) => a.id === id);
}

export function artboardOfLayer(doc: ImageDocument, layerId: string): Artboard | undefined {
  return homeIndex(doc).get(layerId);
}

export function layerOf(doc: ImageDocument, layerId: string): Layer | undefined {
  return artboardOfLayer(doc, layerId)?.layers.find((l) => l.id === layerId);
}

export function artboardOfItem(doc: ImageDocument, id: string): Artboard | undefined {
  return artboardById(doc, id) ?? artboardOfLayer(doc, id) ?? doc.artboards.find((a) => a.groups?.some((g) => g.id === id));
}

export function selectedArtboards(doc: ImageDocument, selection: readonly string[]): Artboard[] {
  const wanted = new Set(selection);
  return doc.artboards.filter((a) => wanted.has(a.id));
}

export function activeArtboard(doc: ImageDocument, preferredId: string | null): Artboard {
  return (preferredId ? artboardById(doc, preferredId) : undefined) ?? doc.artboards[0];
}

export function artboardBounds(a: Artboard): Bounds {
  return { left: a.x, top: a.y, right: a.x + a.canvas.width, bottom: a.y + a.canvas.height };
}

export function artboardsBounds(doc: ImageDocument): Bounds {
  const all = doc.artboards.map(artboardBounds);
  return {
    left: Math.min(...all.map((b) => b.left)),
    top: Math.min(...all.map((b) => b.top)),
    right: Math.max(...all.map((b) => b.right)),
    bottom: Math.max(...all.map((b) => b.bottom)),
  };
}

export function artboardAt(doc: ImageDocument, point: Point): Artboard | undefined {
  return [...doc.artboards].reverse().find((a) => {
    const b = artboardBounds(a);
    return point.x >= b.left && point.x <= b.right && point.y >= b.top && point.y <= b.bottom;
  });
}

export function readingOrder(doc: ImageDocument): Artboard[] {
  return [...doc.artboards].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function neighborArtboard(doc: ImageDocument, currentId: string, direction: 1 | -1): Artboard {
  const ordered = readingOrder(doc);
  const at = ordered.findIndex((a) => a.id === currentId);
  return ordered[(Math.max(at, 0) + direction + ordered.length) % ordered.length];
}

function withSurface(artboard: Artboard, surface: ImageSurface): Artboard {
  const { groups, ...rest } = { ...artboard, canvas: surface.canvas, layers: surface.layers, groups: surface.groups };
  return groups && groups.length > 0 ? { ...rest, groups } : rest;
}

export function editArtboard(doc: ImageDocument, id: string, op: (surface: ImageSurface) => ImageSurface): ImageDocument {
  const index = doc.artboards.findIndex((a) => a.id === id);
  if (index < 0) return doc;
  const current = doc.artboards[index];
  const next = op(current);
  if (next === current) return doc;
  return produce(doc, (draft) => {
    draft.artboards[index] = withSurface(current, next) as Draft<Artboard>;
  });
}

function overlapsRow(a: Artboard, top: number, height: number): boolean {
  return a.y < top + height && a.y + a.canvas.height > top;
}

export function nextArtboardPlace(doc: ImageDocument, fromId: string | undefined, size: CanvasSize): Point {
  const from = (fromId ? artboardById(doc, fromId) : undefined) ?? doc.artboards[doc.artboards.length - 1];
  if (!from) return { x: 0, y: 0 };
  const row = doc.artboards.filter((a) => overlapsRow(a, from.y, Math.max(size.height, from.canvas.height)));
  const right = Math.max(...row.map((a) => a.x + a.canvas.width));
  return { x: clampCoordinate(right + ARTBOARD_GAP), y: from.y };
}

function clampCoordinate(value: number): number {
  const limit = STUDIO_LIMITS.maxArtboardCoordinate;
  return Math.round(Math.min(Math.max(value, -limit), limit));
}

function cleanName(name: string | undefined): string | undefined {
  const clean = name?.trim();
  return clean ? [...clean].slice(0, STUDIO_LIMITS.maxLayerNameRunes).join("") : undefined;
}

function appended(doc: ImageDocument, artboard: Artboard): ImageDocument {
  return produce(doc, (draft) => {
    draft.artboards.push(artboard as Draft<Artboard>);
  });
}

export function addArtboard(doc: ImageDocument, size: CanvasSize, options: NewArtboard = {}): { document: ImageDocument; id: string } {
  const id = newStudioId("artboard");
  const place = nextArtboardPlace(doc, options.after, size);
  const name = cleanName(options.name);
  const artboard: Artboard = {
    id,
    ...(name ? { name } : {}),
    ...place,
    canvas: { width: size.width, height: size.height, background: options.background ?? DEFAULT_IMAGE_BACKGROUND, ...(options.gradient ? { gradient: options.gradient } : {}) },
    layers: [],
  };
  return { document: appended(doc, artboard), id };
}

function clonedSurface(source: Artboard): { surface: ImageSurface; copies: Record<string, string> } {
  const cloned = cloneWithGroups(source.layers, source.groups ?? [], 0, () => false, (v) => v);
  const layers = cloned.layers.map((layer, i) => (source.layers[i].locked ? { ...layer, locked: true } : layer));
  const copies = Object.fromEntries(source.layers.map((layer, i) => [layer.id, layers[i].id]));
  return { surface: { canvas: source.canvas, layers, ...(cloned.groups.length > 0 ? { groups: cloned.groups } : {}) }, copies };
}

export function duplicateArtboard(doc: ImageDocument, id: string, options: { name?: string; size?: CanvasSize }): ArtboardCopy {
  const source = artboardById(doc, id);
  if (!source) return { document: doc, id: "", copies: {} };
  const { surface, copies } = clonedSurface(source);
  const resized = options.size ? resizeCanvas(surface, options.size) : surface;
  const copyId = newStudioId("artboard");
  const name = cleanName(options.name) ?? source.name;
  const place = nextArtboardPlace(doc, id, resized.canvas);
  const artboard = withSurface({ id: copyId, ...(name ? { name } : {}), ...place, canvas: resized.canvas, layers: [] }, resized);
  return { document: appended(doc, artboard), id: copyId, copies };
}

export function updateArtboard(doc: ImageDocument, id: string, patch: ArtboardPatch): ImageDocument {
  const index = doc.artboards.findIndex((a) => a.id === id);
  if (index < 0) return doc;
  return produce(doc, (draft) => {
    const artboard = draft.artboards[index];
    if (patch.name !== undefined) {
      const name = cleanName(patch.name);
      if (name) artboard.name = name;
      else delete artboard.name;
    }
    if (patch.x !== undefined) artboard.x = clampCoordinate(patch.x);
    if (patch.y !== undefined) artboard.y = clampCoordinate(patch.y);
  });
}

export function resizeArtboard(doc: ImageDocument, id: string, size: CanvasSize): ImageDocument {
  return editArtboard(doc, id, (surface) => resizeCanvas(surface, size));
}

export function deleteArtboards(doc: ImageDocument, ids: readonly string[]): ImageDocument {
  const doomed = new Set(ids);
  const kept = doc.artboards.filter((a) => !doomed.has(a.id));
  if (kept.length === doc.artboards.length || kept.length === 0) return doc;
  return produce(doc, (draft) => {
    draft.artboards = draft.artboards.filter((a) => !doomed.has(a.id));
  });
}

function travellingGroups(source: Artboard, moving: ReadonlySet<string>): Set<string> {
  const index = indexOf(source);
  return new Set(
    (source.groups ?? [])
      .filter((g) => {
        const members = index.members.get(g.id) ?? [];
        return members.length > 0 && members.every((id) => moving.has(id));
      })
      .map((g) => g.id),
  );
}

const NO_OFFSET: Point = { x: 0, y: 0 };

function transferred(layer: Layer, from: Artboard, to: Artboard, mode: LayerTransfer, offset: Point): Layer {
  const t = layer.transform;
  const scaleX = from.canvas.width / to.canvas.width;
  const scaleY = from.canvas.height / to.canvas.height;
  const x = mode === "keep-place" ? (from.x + t.x * from.canvas.width + offset.x - to.x) / to.canvas.width : t.x;
  const y = mode === "keep-place" ? (from.y + t.y * from.canvas.height + offset.y - to.y) / to.canvas.height : t.y;
  return {
    ...layer,
    transform: { ...t, x: clampTo(x, LAYER_RANGES.position), y: clampTo(y, LAYER_RANGES.position), w: clampTo(t.w * scaleX, LAYER_RANGES.size), h: clampTo(t.h * scaleY, LAYER_RANGES.size) },
    ...(layer.fontSize !== undefined ? { fontSize: clampTo(layer.fontSize * scaleY, LAYER_RANGES.fontSize) } : {}),
  };
}

export function moveLayersToArtboard(doc: ImageDocument, ids: readonly string[], targetId: string, mode: LayerTransfer, offset: Point = NO_OFFSET): ImageDocument {
  const target = artboardById(doc, targetId);
  const source = ids.length > 0 ? artboardOfLayer(doc, ids[0]) : undefined;
  if (!target || !source || source.id === target.id || ids.some((id) => artboardOfLayer(doc, id) !== source)) return doc;
  const moving = new Set(familyOf(source, ids));
  const leaving = source.layers.filter((l) => moving.has(l.id));
  if (leaving.length === 0 || leaving.some((l) => l.locked)) return doc;
  const carried = travellingGroups(source, moving);
  const parents = groupParents(source);
  const nearest = (groupId: string | null | undefined) => ancestry(parents, groupId).find((g) => carried.has(g));
  const arriving = leaving.map((layer) => {
    const copy = transferred(layer, source, target, mode, offset);
    const home = nearest(layer.groupId);
    if (home) copy.groupId = home;
    else delete copy.groupId;
    return copy;
  });
  const groups = (source.groups ?? [])
    .filter((g) => carried.has(g.id))
    .map((g): StudioGroup => {
      const copy = { ...g };
      const parentId = nearest(parents.get(g.id));
      if (parentId) copy.parentId = parentId;
      else delete copy.parentId;
      return copy;
    });
  return produce(doc, (draft) => {
    const from = draft.artboards.find((a) => a.id === source.id)!;
    const to = draft.artboards.find((a) => a.id === target.id)!;
    from.layers = from.layers.filter((l) => !moving.has(l.id));
    if (from.groups) from.groups = from.groups.filter((g) => !carried.has(g.id));
    cleanupGroups(from as Draft<ImageSurface>);
    to.layers.push(...(arriving as Draft<Layer>[]));
    if (groups.length > 0) to.groups = [...(to.groups ?? []), ...(groups as Draft<StudioGroup>[])];
  });
}
