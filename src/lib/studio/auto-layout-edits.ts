import { produce, type Draft } from "immer";

import { boxBounds, unionBounds } from "./arrange";
import { inferredLayout, layoutSurface, layoutsIssue, type HugMeasure, type Layout, type LayoutItem } from "./auto-layout";
import { newStudioId, type ImageSurface, type Layer, type StudioGroup } from "./document";
import { groupLayerIds } from "./groups";
import { indexOf } from "./layer-index";
import { addLayers, createScaffold } from "./layers";
import { selectionGroup } from "./repeat-edits";

export type LayoutRefusal = "missing" | "locked" | "base" | "repeat" | "range" | "invalid";

type Refused = { ok: false; reason: LayoutRefusal };

export type LayoutTarget = { groupId: string } | { ids: readonly string[] };

export type SetLayoutOutcome = { ok: true; document: ImageSurface; groupId: string } | Refused;

export type LayoutItemOutcome = { ok: true; document: ImageSurface; fixed: ("width" | "height")[] } | Refused;

const CLEAR = "#00000000";
const TURN_EPSILON = 1e-9;

function refuse(reason: LayoutRefusal): Refused {
  return { ok: false, reason };
}

function turned(layer: Layer): boolean {
  return Math.abs(layer.transform.rotation) > TURN_EPSILON;
}

function contains(outer: Layer, inner: readonly Layer[], surface: ImageSurface): boolean {
  const box = boxBounds(outer.transform, surface.canvas);
  const content = unionBounds(inner.map((layer) => boxBounds(layer.transform, surface.canvas)));
  return box.left <= content.left + 0.5 && box.top <= content.top + 0.5 && box.right >= content.right - 0.5 && box.bottom >= content.bottom - 0.5;
}

function clearBase(surface: ImageSurface, layers: readonly Layer[]): Layer {
  const bounds = unionBounds(layers.map((layer) => boxBounds(layer.transform, surface.canvas)));
  const { width, height } = surface.canvas;
  return {
    id: newStudioId("l"),
    type: "shape",
    shape: "rect",
    fill: CLEAR,
    transform: { x: (bounds.left + bounds.right) / 2 / width, y: (bounds.top + bounds.bottom) / 2 / height, w: (bounds.right - bounds.left) / width, h: (bounds.bottom - bounds.top) / height, rotation: 0, opacity: 1 },
  };
}

function scaffolded(surface: ImageSurface, ids: readonly string[]): { surface: ImageSurface; groupId: string } | Refused {
  const index = indexOf(surface);
  const present = ids.filter((id) => index.layers.has(id));
  if (present.length === 0) return refuse("missing");
  const existing = selectionGroup(surface, present);
  if (existing) return { surface, groupId: existing };
  const layers = surface.layers.filter((layer) => present.includes(layer.id));
  if (layers.some((layer) => layer.locked)) return refuse("locked");
  const [bottom, ...rest] = layers;
  const usable = rest.length > 0 && (bottom.type === "shape" || bottom.type === "image") && contains(bottom, rest, surface);
  if (usable && turned(bottom)) return refuse("base");
  if (usable) {
    const made = createScaffold(surface, present);
    return made.scaffoldId ? { surface: made.document, groupId: made.scaffoldId } : refuse("invalid");
  }
  const base = clearBase(surface, layers);
  const withBase = addLayers(surface, [{ ...base, ...(bottom.groupId ? { groupId: bottom.groupId } : {}) }], surface.layers.indexOf(bottom));
  const made = createScaffold(withBase, [base.id, ...present]);
  return made.scaffoldId ? { surface: made.document, groupId: made.scaffoldId } : refuse("invalid");
}

function withBase(surface: ImageSurface, groupId: string): { surface: ImageSurface; groupId: string } | Refused {
  const group = surface.groups?.find((g) => g.id === groupId);
  if (!group) return refuse("missing");
  if (group.baseId) return { surface, groupId };
  const ids = groupLayerIds(surface, groupId);
  if (ids.length === 0) return refuse("missing");
  const layers = surface.layers.filter((layer) => ids.includes(layer.id));
  const base: Layer = { ...clearBase(surface, layers), groupId };
  const added = addLayers(surface, [base], surface.layers.indexOf(layers[0]));
  return {
    surface: produce(added, (draft) => {
      const target = draft.groups!.find((g) => g.id === groupId)!;
      target.baseId = base.id;
    }),
    groupId,
  };
}

export function scaffoldFor(surface: ImageSurface, ids: readonly string[]): StudioGroup | undefined {
  const grouped = ids.length > 0 ? selectionGroup(surface, ids) : null;
  const group = grouped ? surface.groups?.find((g) => g.id === grouped) : undefined;
  if (group?.baseId) return group;
  return ids.length === 1 ? surface.groups?.find((g) => g.baseId === ids[0]) : undefined;
}

export function cleanLayout(layout: Layout): Layout {
  const padding = layout.padding;
  const auto = Boolean(layout.autoGap);
  return {
    direction: layout.direction,
    ...(!auto && layout.gap ? { gap: layout.gap } : {}),
    ...(auto ? { autoGap: true } : {}),
    ...(padding && (padding.top || padding.right || padding.bottom || padding.left) ? { padding } : {}),
    ...(!auto && layout.alignMain && layout.alignMain !== "start" ? { alignMain: layout.alignMain } : {}),
    ...(layout.alignCross && layout.alignCross !== "start" ? { alignCross: layout.alignCross } : {}),
    width: layout.width,
    height: layout.height,
  };
}

function laidOut(surface: ImageSurface, measure: HugMeasure | undefined): ImageSurface | Refused {
  if (layoutsIssue(surface.groups ?? [], surface.layers)) return refuse("invalid");
  return layoutSurface(surface, measure) ?? refuse("range");
}

export function setLayout(surface: ImageSurface, target: LayoutTarget, patch: Partial<Layout>, measure?: HugMeasure): SetLayoutOutcome {
  const found = "groupId" in target ? withBase(surface, target.groupId) : scaffolded(surface, target.ids);
  if ("reason" in found) return found;
  const group = found.surface.groups!.find((g) => g.id === found.groupId)!;
  if (group.repeat) return refuse("repeat");
  const base = found.surface.layers.find((layer) => layer.id === group.baseId);
  if (!base) return refuse("missing");
  if (turned(base)) return refuse("base");
  const layout = cleanLayout({ ...(group.layout ?? inferredLayout(found.surface, group.id)), ...patch });
  const next = produce(found.surface, (draft) => {
    const entry = draft.groups!.find((g) => g.id === group.id)!;
    entry.layout = layout as Draft<Layout>;
  });
  const result = laidOut(next, measure);
  return "reason" in result ? result : { ok: true, document: result, groupId: group.id };
}

export function removeLayout(surface: ImageSurface, groupId: string): ImageSurface {
  const group = surface.groups?.find((g) => g.id === groupId);
  if (!group?.layout) return surface;
  return produce(surface, (draft) => {
    const entry = draft.groups!.find((g) => g.id === groupId)!;
    delete entry.layout;
    for (const layer of draft.layers) if (layer.groupId === groupId) delete layer.layoutItem;
    for (const child of draft.groups!) if (child.parentId === groupId) delete child.layoutItem;
  });
}

function containerOfItem(surface: ImageSurface, id: string): { group: StudioGroup | undefined; isGroup: boolean } | null {
  const index = indexOf(surface);
  const layer = index.layers.get(id);
  if (layer) return { group: layer.groupId ? index.groups.get(layer.groupId) : undefined, isGroup: false };
  const group = index.groups.get(id);
  return group ? { group: group.parentId ? index.groups.get(group.parentId) : undefined, isGroup: true } : null;
}

export function setLayoutItem(surface: ImageSurface, id: string, patch: Partial<LayoutItem>, measure?: HugMeasure): LayoutItemOutcome {
  const found = containerOfItem(surface, id);
  if (!found) return refuse("missing");
  const parent = found.group;
  if (!parent?.layout || parent.baseId === id) return refuse("invalid");
  const current = (found.isGroup ? surface.groups?.find((g) => g.id === id)?.layoutItem : surface.layers.find((l) => l.id === id)?.layoutItem) ?? {};
  const merged: LayoutItem = { ...current, ...patch };
  const spec: LayoutItem = {
    ...(merged.width && merged.width !== "fixed" ? { width: merged.width } : {}),
    ...(merged.height && merged.height !== "fixed" ? { height: merged.height } : {}),
    ...(merged.absolute ? { absolute: true } : {}),
  };
  const fixed = (["width", "height"] as const).filter((axis) => spec[axis] === "fill" && parent.layout![axis] === "hug");
  const next = produce(surface, (draft) => {
    const owner = found.isGroup ? draft.groups!.find((g) => g.id === id)! : draft.layers.find((l) => l.id === id)!;
    if (Object.keys(spec).length > 0) owner.layoutItem = spec as Draft<LayoutItem>;
    else delete owner.layoutItem;
    const container = draft.groups!.find((g) => g.id === parent.id)!;
    for (const axis of fixed) container.layout![axis] = "fixed";
  });
  const result = laidOut(next, measure);
  return "reason" in result ? result : { ok: true, document: result, fixed };
}
