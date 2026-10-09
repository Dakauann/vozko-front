import type { Layer } from "./document";
import type { LayerPatch } from "./layers";
import { LEGACY_DASH } from "./paint";

export const DASH_PRESETS = {
  solid: [] as number[],
  dashed: [...LEGACY_DASH] as number[],
  dotted: [0, 2],
  dashDot: [4, 2, 0, 2],
  long: [8, 3],
} as const;

export type DashPreset = keyof typeof DASH_PRESETS;

export const DASH_PRESET_IDS = Object.keys(DASH_PRESETS) as DashPreset[];

function same(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function dashPresetOf(layer: Pick<Layer, "dash" | "dashArray">): DashPreset | "custom" {
  const pattern = layer.dashArray && layer.dashArray.length > 0 ? layer.dashArray : layer.dash ? DASH_PRESETS.dashed : DASH_PRESETS.solid;
  return DASH_PRESET_IDS.find((id) => same(DASH_PRESETS[id], pattern)) ?? "custom";
}

export function dashPresetPatch(preset: DashPreset): LayerPatch {
  if (preset === "solid") return { dashArray: undefined, dash: undefined, dashOffset: undefined };
  const patch: LayerPatch = { dashArray: [...DASH_PRESETS[preset]], dash: undefined };
  return preset === "dotted" ? { ...patch, lineCap: "round" } : patch;
}
