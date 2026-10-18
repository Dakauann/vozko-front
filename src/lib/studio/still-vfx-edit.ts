import { insertItem, moveItem, removeItem } from "./clip-items";
import type { ImageSurface } from "./document";
import { stillVfxIssue } from "./still-vfx";
import type { Vfx } from "./vfx";
import { patchVfx, type VfxPatch } from "./vfx-edit";

export type StillVfxRefusal = "vfxMissing" | "invalid";

export type StillVfxChange = (list: Vfx[]) => Vfx[] | StillVfxRefusal;

export type StillVfxTarget = { kind: "layer"; layerId: string } | { kind: "canvas" };

export type SurfaceVfxRefusal = StillVfxRefusal | "missing" | "locked" | "notImage";

type SurfaceVfxEdit<S extends ImageSurface> = { ok: true; surface: S } | { ok: false; reason: SurfaceVfxRefusal };

export function addingVfx(vfx: Vfx, index?: number): StillVfxChange {
  return (list) => insertItem(list, vfx, index);
}

export function removingVfx(vfxId: string): StillVfxChange {
  return (list) => removeItem(list, vfxId) ?? "vfxMissing";
}

export function movingVfx(vfxId: string, toIndex: number): StillVfxChange {
  return (list) => moveItem(list, vfxId, toIndex) ?? "vfxMissing";
}

export function patchingVfx(vfxId: string, patch: VfxPatch): StillVfxChange {
  return (list) => {
    const index = list.findIndex((vfx) => vfx.id === vfxId);
    if (index < 0) return "vfxMissing";
    const next = patchVfx(list[index], patch, null);
    if (typeof next === "string") return "invalid";
    return list.map((vfx, i) => (i === index ? next : vfx));
  };
}

function holding<T extends { vfx?: Vfx[] }>(holder: T, list: Vfx[]): T {
  if (list.length > 0) return { ...holder, vfx: list };
  return Object.fromEntries(Object.entries(holder).filter(([key]) => key !== "vfx")) as T;
}

function changed(list: readonly Vfx[] | undefined, change: StillVfxChange): Vfx[] | StillVfxRefusal {
  const next = change([...(list ?? [])]);
  if (typeof next === "string") return next;
  return stillVfxIssue(next) ? "invalid" : next;
}

export function targetVfx(surface: ImageSurface, target: StillVfxTarget): readonly Vfx[] | undefined {
  if (target.kind === "canvas") return surface.canvas.vfx;
  return surface.layers.find((layer) => layer.id === target.layerId)?.vfx;
}

export function editSurfaceVfx<S extends ImageSurface>(surface: S, target: StillVfxTarget, change: StillVfxChange): SurfaceVfxEdit<S> {
  if (target.kind === "canvas") {
    const next = changed(surface.canvas.vfx, change);
    return typeof next === "string" ? { ok: false, reason: next } : { ok: true, surface: { ...surface, canvas: holding(surface.canvas, next) } };
  }
  const layer = surface.layers.find((entry) => entry.id === target.layerId);
  if (!layer) return { ok: false, reason: "missing" };
  if (layer.type !== "image") return { ok: false, reason: "notImage" };
  if (layer.locked) return { ok: false, reason: "locked" };
  const next = changed(layer.vfx, change);
  if (typeof next === "string") return { ok: false, reason: next };
  return { ok: true, surface: { ...surface, layers: surface.layers.map((entry) => (entry === layer ? holding(entry, next) : entry)) } };
}
