import type { Layer, LayerType } from "./document";
import { isEditableTarget, type KeyStroke } from "./keymap";
import type { LayerPatch } from "./layers";

type StyleKey = Exclude<keyof Layer, "id" | "type" | "name" | "transform" | "hidden" | "locked" | "groupId" | "assetId" | "crop" | "text" | "iconId" | "shape" | "clip">;

const COMMON: StyleKey[] = ["shadow", "blendMode"];

export const STYLE_KEYS: Record<LayerType, readonly StyleKey[]> = {
  text: [...COMMON, "fontId", "fontSize", "fontWeight", "italic", "align", "lineHeight", "letterSpacing", "fill", "stroke", "strokeWidth", "gradient", "highlight", "curve"],
  shape: [...COMMON, "fill", "stroke", "strokeWidth", "dash", "radius", "gradient", "arrowStart", "arrowEnd"],
  image: [...COMMON, "filters", "radius", "stroke", "strokeWidth", "frame", "flipX", "flipY"],
  icon: [...COMMON, "fill"],
};

export interface CopiedStyle {
  type: LayerType;
  values: Partial<Pick<Layer, StyleKey>>;
  opacity: number;
}

export function styleOf(layer: Layer): CopiedStyle {
  const values: Partial<Pick<Layer, StyleKey>> = {};
  for (const key of STYLE_KEYS[layer.type]) (values as Record<string, unknown>)[key] = layer[key];
  return { type: layer.type, values, opacity: layer.transform.opacity };
}

export function stylePatch(style: CopiedStyle, target: Layer): LayerPatch {
  const source = new Set(STYLE_KEYS[style.type]);
  const patch: Record<string, unknown> = {};
  for (const key of STYLE_KEYS[target.type]) if (source.has(key)) patch[key] = style.values[key];
  return { ...(patch as LayerPatch), transform: { ...target.transform, opacity: style.opacity } };
}

export type StyleAction = { type: "copyStyle" } | { type: "pasteStyle" };

export function styleActionFor(stroke: KeyStroke): StyleAction | null {
  if (!(stroke.ctrlKey || stroke.metaKey) || !stroke.altKey || stroke.shiftKey || isEditableTarget(stroke.target)) return null;
  if (stroke.code === "KeyC" || stroke.key.toLowerCase() === "c") return { type: "copyStyle" };
  if (stroke.code === "KeyV" || stroke.key.toLowerCase() === "v") return { type: "pasteStyle" };
  return null;
}
