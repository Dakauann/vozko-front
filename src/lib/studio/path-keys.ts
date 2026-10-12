import type { Easing } from "./keyframes";

export const SPATIAL_MODES = ["linear", "auto", "smooth", "free"] as const;

export type SpatialMode = (typeof SPATIAL_MODES)[number];

export const PATH_HANDLE_LIMIT = 2;

export interface Tangent {
  x: number;
  y: number;
}

export interface PositionKeyframe {
  atMs: number;
  x: number;
  y: number;
  easing: Easing;
  spatial?: SpatialMode;
  in?: Tangent;
  out?: Tangent;
}

export function isSpatialMode(value: string): value is SpatialMode {
  return (SPATIAL_MODES as readonly string[]).includes(value);
}

export function spatialOf(key: Pick<PositionKeyframe, "spatial">): SpatialMode {
  return key.spatial || "auto";
}

export function carriesHandles(mode: SpatialMode): boolean {
  return mode === "smooth" || mode === "free";
}

function handleFits(handle: Tangent): boolean {
  return [handle.x, handle.y].every((value) => Number.isFinite(value) && Math.abs(value) <= PATH_HANDLE_LIMIT);
}

export type HandleFault = "missing" | "unexpected" | "range";

export function handleFault(key: PositionKeyframe): HandleFault | null {
  const handled = carriesHandles(spatialOf(key));
  if (handled && (!key.in || !key.out)) return "missing";
  if (!handled && (key.in || key.out)) return "unexpected";
  if ((key.in && !handleFits(key.in)) || (key.out && !handleFits(key.out))) return "range";
  return null;
}
