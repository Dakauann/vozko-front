import type { Layer } from "../document";
import type { RasterSource } from "./scene";

const SHADOW_REACH = 1.5;
const SAFETY_PX = 2;
const CURVE_REACH = 0.5;

export interface RasterPlan {
  source: RasterSource;
  padPx: number;
}

export function paintedContent(layer: Layer): Layer {
  return { ...layer, filters: undefined, blendMode: undefined, clip: undefined, hidden: undefined, locked: undefined, groupId: undefined, name: undefined };
}

function reach(layer: Layer, fontBasePx: number): number {
  const shadow = layer.shadow ? SHADOW_REACH * layer.shadow.blur + Math.max(Math.abs(layer.shadow.x), Math.abs(layer.shadow.y)) : 0;
  const stroke = (layer.strokeWidth ?? 0) / 2;
  const curve = Math.abs(layer.curve ?? 0) > 0 ? CURVE_REACH * (layer.fontSize ?? 0) * fontBasePx : 0;
  return Math.ceil(shadow + stroke + curve + SAFETY_PX);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    return `{${entries.sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function rasterPlan(layer: Layer, boxWidthPx: number, boxHeightPx: number, fontBasePx: number): RasterPlan {
  const padPx = reach(layer, fontBasePx);
  const widthPx = Math.max(1, Math.round(boxWidthPx + 2 * padPx));
  const heightPx = Math.max(1, Math.round(boxHeightPx + 2 * padPx));
  const t = layer.transform;
  const placed: Layer = {
    ...layer,
    transform: {
      ...t,
      x: (padPx + t.x * boxWidthPx) / widthPx,
      y: (padPx + t.y * boxHeightPx) / heightPx,
      w: (t.w * boxWidthPx) / widthPx,
      h: (t.h * boxHeightPx) / heightPx,
    },
  };
  const key = stable({ content: { ...layer, id: undefined }, boxWidthPx: Math.round(boxWidthPx), boxHeightPx: Math.round(boxHeightPx), fontBasePx });
  return { source: { kind: "raster", key, layer: placed, widthPx, heightPx, fontBasePx }, padPx };
}
