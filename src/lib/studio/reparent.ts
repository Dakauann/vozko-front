import type { ImageSurface } from "./document";
import { containsPoint } from "./geometry";
import { baseOf, containerOf, dropItem, itemLayerIds, scaffoldOf, selectionItems, type TreeItem } from "./groups";
import { isPickable, layerBounds, layerById, selectionBounds } from "./layers";

export interface CanvasPoint {
  x: number;
  y: number;
}

interface DropPlan {
  item: TreeItem;
  current: string | null;
  target: string | null;
}

function fitsInside(doc: ImageSurface, movingIds: readonly string[], baseId: string): boolean {
  const moving = selectionBounds(doc, movingIds);
  const base = layerBounds(layerById(doc, baseId)!.transform, doc.canvas);
  return moving !== null && moving.right - moving.left < base.right - base.left && moving.bottom - moving.top < base.bottom - base.top;
}

function plan(doc: ImageSurface, ids: readonly string[], point: CanvasPoint): DropPlan | null {
  const items = selectionItems(doc, ids);
  if (items.length !== 1) return null;
  const [item] = items;
  const current = containerOf(doc, item);
  if (current !== null && baseOf(doc, current) === null) return null;
  const moving = new Set(itemLayerIds(doc, item));
  const host = [...doc.layers]
    .reverse()
    .find((l) => !moving.has(l.id) && isPickable(l) && scaffoldOf(doc, l.id) !== null && containsPoint(l.transform, doc.canvas, point) && fitsInside(doc, [...moving], l.id));
  return { item, current, target: host ? scaffoldOf(doc, host.id) : null };
}

export function dropParent(doc: ImageSurface, ids: readonly string[], point: CanvasPoint): string | null {
  const found = plan(doc, ids, point);
  return found?.target ? baseOf(doc, found.target) : null;
}

export function reparentOnDrop(doc: ImageSurface, ids: readonly string[], point: CanvasPoint): ImageSurface {
  const found = plan(doc, ids, point);
  if (!found || found.target === found.current) return doc;
  if (found.target) return dropItem(doc, found.item, { kind: "group", id: found.target }, "into");
  const base = found.current ? layerById(doc, baseOf(doc, found.current) ?? "") : undefined;
  if (!found.current || !base || containsPoint(base.transform, doc.canvas, point)) return doc;
  return dropItem(doc, found.item, { kind: "group", id: found.current }, "above");
}
