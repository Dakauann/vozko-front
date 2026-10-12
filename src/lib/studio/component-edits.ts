import { produce, type Draft } from "immer";

import { addArtboard, artboardById, artboardOfLayer, editArtboard, moveLayersToArtboard } from "./artboards";
import type { ClipboardContent } from "./clipboard";
import {
  componentOf,
  instanceParts,
  mainLayerOf,
  OVERRIDE_FIELDS,
  overridableFields,
  overriddenLayer,
  partSource,
  setFields,
  type InstanceOverride,
  type OverrideField,
  type OverrideValues,
} from "./components";
import { newStudioId, STUDIO_LIMITS, type Artboard, type CanvasSize, type ImageDocument, type ImageSurface, type Layer, type StudioGroup, type Transform } from "./document";
import { ancestry, cleanupGroups, familyOf } from "./groups";
import { indexOf } from "./layer-index";
import { clampTo, LAYER_RANGES } from "./layer-ranges";
import { addLayers, selectionBounds } from "./layers";
import { layerIssue } from "./validate";

export type ComponentRefusal = "missing" | "locked" | "instance" | "component" | "too_large" | "field" | "invalid";

type Refused = { ok: false; reason: ComponentRefusal };

export type EditOutcome = { ok: true; document: ImageDocument } | Refused;

export type CreatedComponent = { ok: true; document: ImageDocument; componentId: string; instanceId: string } | Refused;

export type AddedInstance = { ok: true; document: ImageDocument; instanceId: string } | Refused;

export type DetachedInstance = { ok: true; document: ImageDocument; groupId: string; ids: string[] } | Refused;

export type SwappedComponent = { ok: true; document: ImageDocument; dropped: string[] } | Refused;

export type InstanceBox = Partial<Pick<Transform, "x" | "y" | "w" | "h">>;

interface FoundInstance {
  ok: true;
  artboard: Artboard;
  layer: Layer;
  component: Artboard;
}

function refuse(reason: ComponentRefusal): Refused {
  return { ok: false, reason };
}

function withinTransform(t: Transform): boolean {
  const inside = (value: number, [lo, hi]: readonly [number, number]) => Number.isFinite(value) && value >= lo && value <= hi;
  return inside(t.x, LAYER_RANGES.position) && inside(t.y, LAYER_RANGES.position) && inside(t.w, LAYER_RANGES.size) && inside(t.h, LAYER_RANGES.size);
}

function instanceAt(doc: ImageDocument, instanceId: string): FoundInstance | Refused {
  const artboard = artboardOfLayer(doc, instanceId);
  const layer = artboard?.layers.find((l) => l.id === instanceId);
  const component = layer?.type === "instance" ? componentOf(doc, layer.componentId) : undefined;
  return artboard && layer && component ? { ok: true, artboard, layer, component } : refuse("missing");
}

function containerOutside(surface: ImageSurface, top: Layer, moving: ReadonlySet<string>): string | undefined {
  const index = indexOf(surface);
  return ancestry(index.parents, top.groupId).find((groupId) => !(index.members.get(groupId) ?? []).every((id) => moving.has(id)));
}

export function createComponent(doc: ImageDocument, ids: readonly string[], name?: string): CreatedComponent {
  const home = ids.length > 0 ? artboardOfLayer(doc, ids[0]) : undefined;
  if (!home || ids.some((id) => artboardOfLayer(doc, id) !== home)) return refuse("missing");
  if (home.component) return refuse("component");
  const moving = familyOf(home, ids);
  const movingSet = new Set(moving);
  const layers = home.layers.filter((l) => movingSet.has(l.id));
  if (layers.some((l) => l.type === "instance")) return refuse("instance");
  if (layers.some((l) => l.locked)) return refuse("locked");
  const bounds = selectionBounds(home, moving);
  if (!bounds) return refuse("missing");
  const { width: hostW, height: hostH } = home.canvas;
  const contentW = bounds.right - bounds.left;
  const contentH = bounds.bottom - bounds.top;
  const size = { width: Math.max(STUDIO_LIMITS.minCanvasSide, Math.ceil(contentW - 1e-6)), height: Math.max(STUDIO_LIMITS.minCanvasSide, Math.ceil(contentH - 1e-6)) };
  if (size.width > STUDIO_LIMITS.maxCanvasSide || size.height > STUDIO_LIMITS.maxCanvasSide) return refuse("too_large");
  const left = bounds.left - (size.width - contentW) / 2;
  const top = bounds.top - (size.height - contentH) / 2;
  const transform: Transform = { x: (left + size.width / 2) / hostW, y: (top + size.height / 2) / hostH, w: size.width / hostW, h: size.height / hostH, rotation: 0, opacity: 1 };
  if (!withinTransform(transform)) return refuse("too_large");
  const added = addArtboard(doc, size, { name, background: "", after: home.id });
  const componentId = added.id;
  const flagged = produce(added.document, (draft) => {
    const artboard = draft.artboards.find((a) => a.id === componentId);
    if (artboard) artboard.component = true;
  });
  const topIndex = Math.max(...layers.map((l) => home.layers.indexOf(l)));
  const container = containerOutside(home, home.layers[topIndex], movingSet);
  const label = artboardById(flagged, componentId)?.name;
  const instance: Layer = { id: newStudioId("l"), type: "instance", ...(label ? { name: label } : {}), componentId, transform, ...(container ? { groupId: container } : {}) };
  const placed = editArtboard(flagged, home.id, (surface) => addLayers(surface, [instance], topIndex + 1));
  const target = artboardById(placed, componentId)!;
  const moved = moveLayersToArtboard(placed, moving, componentId, "keep-place", { x: target.x - home.x - left, y: target.y - home.y - top });
  if (moved === placed) return refuse("locked");
  return { ok: true, document: moved, componentId, instanceId: instance.id };
}

export function instanceBox(component: CanvasSize, host: CanvasSize, box: InstanceBox = {}): Transform {
  const aspect = (component.height * host.width) / (component.width * host.height);
  const fit = Math.min(1, host.width / component.width, host.height / component.height);
  const w = box.w ?? (box.h !== undefined ? box.h / aspect : (component.width * fit) / host.width);
  const h = box.h ?? w * aspect;
  return { x: box.x ?? 0.5, y: box.y ?? 0.5, w, h, rotation: 0, opacity: 1 };
}

export function addInstance(doc: ImageDocument, artboardId: string, componentId: string, box: InstanceBox = {}): AddedInstance {
  const host = artboardById(doc, artboardId);
  const component = componentOf(doc, componentId);
  if (!host || !component) return refuse("missing");
  if (host.component) return refuse("component");
  const transform = instanceBox(component.canvas, host.canvas, box);
  if (!withinTransform(transform)) return refuse("too_large");
  const instance: Layer = { id: newStudioId("l"), type: "instance", ...(component.name ? { name: component.name } : {}), componentId, transform };
  return { ok: true, document: editArtboard(doc, artboardId, (surface) => addLayers(surface, [instance])), instanceId: instance.id };
}

export function mainOf(component: Artboard, instanceId: string, layerId: string): Layer | undefined {
  const source = partSource(layerId);
  const id = mainLayerOf(source && source.instanceId === instanceId ? source.layerId : layerId);
  return component.layers.find((l) => l.id === id);
}

function sameValue(field: OverrideField, a: unknown, b: unknown): boolean {
  if (field === "italic" || field === "hidden") return Boolean(a) === Boolean(b);
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function writeOverrides(doc: ImageDocument, found: FoundInstance, overrides: readonly InstanceOverride[]): ImageDocument {
  return editArtboard(doc, found.artboard.id, (surface) =>
    produce(surface, (draft) => {
      const layer = draft.layers.find((l) => l.id === found.layer.id);
      if (!layer) return;
      if (overrides.length > 0) layer.overrides = overrides as Draft<InstanceOverride>[];
      else delete layer.overrides;
    }),
  );
}

function withEntry(overrides: readonly InstanceOverride[], entry: InstanceOverride): InstanceOverride[] {
  const empty = setFields(entry).length === 0;
  const at = overrides.findIndex((o) => o.layerId === entry.layerId);
  if (at < 0) return empty ? [...overrides] : [...overrides, entry];
  return empty ? overrides.filter((_, i) => i !== at) : overrides.map((o, i) => (i === at ? entry : o));
}

export function setOverrides(doc: ImageDocument, instanceId: string, layerId: string, values: OverrideValues): EditOutcome {
  const found = instanceAt(doc, instanceId);
  if (!found.ok) return found;
  if (found.layer.locked) return refuse("locked");
  const main = mainOf(found.component, instanceId, layerId);
  if (!main) return refuse("missing");
  const allowed = overridableFields(main);
  const fields = Object.keys(values) as OverrideField[];
  if (fields.some((field) => !allowed.includes(field))) return refuse("field");
  const current = found.layer.overrides ?? [];
  const entry: InstanceOverride = { ...(current.find((o) => o.layerId === main.id) ?? { layerId: main.id }) };
  for (const field of fields) {
    const value = values[field];
    if (value === undefined || value === "" || sameValue(field, main[field], value)) delete entry[field];
    else Object.assign(entry, { [field]: value });
  }
  if (fields.includes("assetId") && !fields.includes("crop")) delete entry.crop;
  if (layerIssue(overriddenLayer(main, entry))) return refuse("invalid");
  return { ok: true, document: writeOverrides(doc, found, withEntry(current, entry)) };
}

export function resetOverrides(doc: ImageDocument, instanceId: string, layerId?: string, fields?: readonly OverrideField[]): ImageDocument {
  const found = instanceAt(doc, instanceId);
  if (!found.ok || !found.layer.overrides) return doc;
  if (layerId === undefined) return writeOverrides(doc, found, []);
  const main = mainOf(found.component, instanceId, layerId);
  const entry = main ? found.layer.overrides.find((o) => o.layerId === main.id) : undefined;
  if (!entry) return doc;
  const kept: InstanceOverride = { ...entry };
  for (const field of fields ?? OVERRIDE_FIELDS) delete kept[field];
  return writeOverrides(doc, found, withEntry(found.layer.overrides, kept));
}

function plainPart(part: Layer, groupId: string): Layer {
  const t = part.transform;
  const plain: Layer = {
    ...part,
    id: newStudioId("l"),
    groupId,
    transform: { ...t, x: clampTo(t.x, LAYER_RANGES.position), y: clampTo(t.y, LAYER_RANGES.position), w: clampTo(t.w, LAYER_RANGES.size), h: clampTo(t.h, LAYER_RANGES.size) },
    ...(part.fontSize !== undefined ? { fontSize: clampTo(part.fontSize, LAYER_RANGES.fontSize) } : {}),
  };
  delete plain.locked;
  return plain;
}

export function detachedParts(component: Artboard, instance: Layer, canvas: CanvasSize): { layers: Layer[]; group: StudioGroup } {
  const group: StudioGroup = { id: newStudioId("g"), ...(instance.groupId ? { parentId: instance.groupId } : {}), ...(component.name ? { name: component.name } : {}) };
  return { layers: instanceParts(component, instance, canvas).map((part) => plainPart(part, group.id)), group };
}

export function replaceInstance(surface: ImageSurface, instanceId: string, layers: readonly Layer[], group: StudioGroup | null): ImageSurface {
  return produce(surface, (draft) => {
    const at = draft.layers.findIndex((l) => l.id === instanceId);
    if (at < 0) return;
    draft.layers.splice(at, 1, ...(layers as Draft<Layer>[]));
    if (group && layers.length > 0) draft.groups = [...(draft.groups ?? []), group as Draft<StudioGroup>];
    cleanupGroups(draft);
  });
}

function detachedWith(doc: ImageDocument, artboard: Artboard, instance: Layer, component: Artboard | undefined): { document: ImageDocument; groupId: string; ids: string[] } {
  const parts = component ? detachedParts(component, instance, artboard.canvas) : { layers: [], group: null };
  const document = editArtboard(doc, artboard.id, (surface) => replaceInstance(surface, instance.id, parts.layers, parts.group));
  return { document, groupId: parts.group?.id ?? "", ids: parts.layers.map((l) => l.id) };
}

export function detachInstance(doc: ImageDocument, instanceId: string): DetachedInstance {
  const found = instanceAt(doc, instanceId);
  if (!found.ok) return found;
  if (found.layer.locked) return refuse("locked");
  return { ok: true, ...detachedWith(doc, found.artboard, found.layer, found.component) };
}

function carriedTarget(from: Layer, to: Artboard): Layer | undefined {
  const same = to.layers.find((l) => l.id === from.id && l.type === from.type);
  if (same) return same;
  const named = from.name ? to.layers.filter((l) => l.type === from.type && l.name === from.name) : [];
  return named.length === 1 ? named[0] : undefined;
}

function carriedEntry(override: InstanceOverride, main: Layer): InstanceOverride | null {
  const allowed = overridableFields(main);
  const entry: InstanceOverride = { layerId: main.id };
  for (const field of setFields(override)) if (allowed.includes(field)) Object.assign(entry, { [field]: override[field] });
  return setFields(entry).length > 0 && !layerIssue(overriddenLayer(main, entry)) ? entry : null;
}

export function swapComponent(doc: ImageDocument, instanceId: string, componentId: string): SwappedComponent {
  const found = instanceAt(doc, instanceId);
  const target = componentOf(doc, componentId);
  if (!found.ok || !target) return refuse("missing");
  if (found.layer.locked) return refuse("locked");
  const { layer, component, artboard } = found;
  const transform = { ...layer.transform, h: clampTo(instanceBox(target.canvas, artboard.canvas, { w: layer.transform.w }).h, LAYER_RANGES.size) };
  const dropped: string[] = [];
  const overrides = (layer.overrides ?? []).flatMap((override) => {
    const from = component.layers.find((l) => l.id === override.layerId);
    const to = from ? carriedTarget(from, target) : undefined;
    const entry = to ? carriedEntry(override, to) : null;
    if (!entry) dropped.push(override.layerId);
    return entry ? [entry] : [];
  });
  const document = editArtboard(doc, artboard.id, (surface) =>
    produce(surface, (draft) => {
      const found = draft.layers.find((l) => l.id === instanceId);
      if (!found) return;
      found.componentId = componentId;
      found.transform = transform;
      if (overrides.length > 0) found.overrides = overrides as Draft<InstanceOverride>[];
      else delete found.overrides;
    }),
  );
  return { ok: true, document, dropped };
}

export function setComponent(doc: ImageDocument, artboardId: string, on: boolean): EditOutcome {
  const artboard = artboardById(doc, artboardId);
  if (!artboard) return refuse("missing");
  if (on && artboard.layers.some((l) => l.type === "instance")) return refuse("instance");
  if (Boolean(artboard.component) === on) return { ok: true, document: doc };
  return {
    ok: true,
    document: produce(doc, (draft) => {
      const target = draft.artboards.find((a) => a.id === artboardId);
      if (!target) return;
      if (on) target.component = true;
      else delete target.component;
    }),
  };
}

function prunedOverrides(overrides: readonly InstanceOverride[], component: Artboard): InstanceOverride[] {
  return overrides.flatMap((override) => {
    const main = component.layers.find((l) => l.id === override.layerId);
    const entry = main ? carriedEntry(override, main) : null;
    return entry ? [entry] : [];
  });
}

function anyArtboard(doc: ImageDocument, id: string | undefined): Artboard | undefined {
  return id ? doc.artboards.find((a) => a.id === id) : undefined;
}

export function settleComponents(before: ImageDocument, after: ImageDocument): ImageDocument {
  if (before === after || before.artboards === after.artboards) return after;
  let doc = after;
  for (const artboard of after.artboards) {
    for (const layer of artboard.layers) {
      if (layer.type !== "instance") continue;
      const host = artboardById(doc, artboard.id)!;
      const component = componentOf(doc, layer.componentId);
      if (!component || host.component) {
        doc = detachedWith(doc, host, layer, anyArtboard(doc, layer.componentId) ?? anyArtboard(before, layer.componentId)).document;
        continue;
      }
      const overrides = layer.overrides ?? [];
      const kept = prunedOverrides(overrides, component);
      if (JSON.stringify(kept) === JSON.stringify(overrides)) continue;
      doc = writeOverrides(doc, { ok: true, artboard: host, layer, component }, kept);
    }
  }
  return doc;
}

export function clipboardComponents(doc: ImageDocument, layers: readonly Layer[]): Artboard[] {
  const ids = new Set(layers.filter((l) => l.type === "instance").map((l) => l.componentId));
  return doc.artboards.filter((a) => a.component && ids.has(a.id));
}

export function pastedContent(doc: ImageDocument, artboardId: string, content: ClipboardContent): ClipboardContent {
  const target = artboardById(doc, artboardId);
  if (!target || !content.layers.some((l) => l.type === "instance")) return content;
  const layers: Layer[] = [];
  const groups = [...content.groups];
  for (const layer of content.layers) {
    const local = layer.type === "instance" ? componentOf(doc, layer.componentId) : undefined;
    if (layer.type !== "instance" || (local && !target.component)) {
      layers.push(layer);
      continue;
    }
    const source = local ?? content.components?.find((c) => c.id === layer.componentId);
    if (!source) continue;
    const parts = detachedParts(source, layer, target.canvas);
    layers.push(...parts.layers);
    groups.push(parts.group);
  }
  return { ...content, layers, groups };
}
