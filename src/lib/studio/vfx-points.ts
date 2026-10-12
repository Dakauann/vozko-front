import { fullFrame, type Clip, type Transform } from "./document";
import type { PathPoint } from "./position-path";
import { paramSpec, vfxValue, type Vfx, type VfxKind } from "./vfx";
import type { VfxPatch } from "./vfx-edit";

const POINT_DECIMALS = 1e4;

export interface VfxPoint {
  id: string;
  kind: VfxKind;
  x: number;
  y: number;
}

export function placesPoint(kind: VfxKind): boolean {
  return paramSpec(kind, "x") !== null && paramSpec(kind, "y") !== null;
}

export function vfxPoints(list: readonly Vfx[], localMs: number): VfxPoint[] {
  return list.filter((vfx) => !vfx.hidden && placesPoint(vfx.kind)).map((vfx) => ({ id: vfx.id, kind: vfx.kind, x: vfxValue(vfx, "x", localMs), y: vfxValue(vfx, "y", localMs) }));
}

export function vfxFrame(clip: Pick<Clip, "type">, placed: Transform): Transform {
  return clip.type === "effect" ? fullFrame() : placed;
}

function inRange(kind: VfxKind, name: "x" | "y", value: number): number {
  const [low, high] = paramSpec(kind, name)!.range;
  return Math.min(high, Math.max(low, Math.round(value * POINT_DECIMALS) / POINT_DECIMALS));
}

export function pointPatch(kind: VfxKind, at: PathPoint): VfxPatch {
  return { params: { x: inRange(kind, "x", at.x), y: inRange(kind, "y", at.y) } };
}
