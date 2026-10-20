import type { Layer, LayerType } from "./document";
import { isEditableTarget, type KeyStroke } from "@/lib/keyboard/stroke";
import { tracesOutline } from "./layer-paint";
import { withoutEffectKeys } from "./effect-keys";
import type { LayerPatch } from "./layers";

type StyleKey = Exclude<keyof Layer, "id" | "type" | "name" | "transform" | "hidden" | "locked" | "groupId" | "assetId" | "crop" | "text" | "iconId" | "shape" | "clip">;

const COMMON: StyleKey[] = ["shadow", "effects", "blendMode", "effectStyleId"];
export const STROKE_STYLE_KEYS: StyleKey[] = ["stroke", "strokeWidth", "dash", "dashArray", "dashOffset", "lineCap", "lineJoin", "miterLimit", "strokes", "strokeStyleId"];
const PAINT_STYLE_KEYS: StyleKey[] = ["fill", "gradient", "pattern", "fills", "fillStyleId"];

const STYLE_KEYS: Record<LayerType, readonly StyleKey[]> = {
  text: [...COMMON, "fontId", "fontSize", "fontWeight", "italic", "align", "lineHeight", "letterSpacing", "textStyleId", ...PAINT_STYLE_KEYS, ...STROKE_STYLE_KEYS, "highlight", "curve"],
  shape: [...COMMON, ...PAINT_STYLE_KEYS, ...STROKE_STYLE_KEYS, "radius", "arrowStart", "arrowEnd", "arrowStartKind", "arrowEndKind"],
  image: [...COMMON, "filters", "gradientMap", "radius", ...STROKE_STYLE_KEYS, "frame", "flipX", "flipY"],
  icon: [...COMMON, "fill", "pattern", "fills", "strokes", "fillStyleId"],
  instance: [],
  paint: ["blendMode"],
  chart: [],
  table: [],
  qr: [],
};

export interface CopiedStyle {
  type: LayerType;
  values: Partial<Pick<Layer, StyleKey>>;
  opacity: number;
}

export function styleOf(layer: Layer): CopiedStyle {
  const values: Partial<Pick<Layer, StyleKey>> = {};
  for (const key of STYLE_KEYS[layer.type]) (values as Record<string, unknown>)[key] = layer[key];
  if (values.effects) values.effects = withoutEffectKeys(values.effects);
  return { type: layer.type, values, opacity: layer.transform.opacity };
}

export function stylePatch(style: CopiedStyle, target: Layer): LayerPatch {
  const source = new Set(STYLE_KEYS[style.type]);
  if (tracesOutline({ type: style.type }) !== tracesOutline(target)) source.delete("strokes");
  const patch: Record<string, unknown> = {};
  for (const key of STYLE_KEYS[target.type]) if (source.has(key)) patch[key] = style.values[key];
  return { ...(patch as LayerPatch), transform: { ...target.transform, opacity: style.opacity } };
}

type StyleAction = { type: "copyStyle" } | { type: "pasteStyle" };

export function styleActionFor(stroke: KeyStroke): StyleAction | null {
  if (!(stroke.ctrlKey || stroke.metaKey) || !stroke.altKey || stroke.shiftKey || isEditableTarget(stroke.target)) return null;
  if (stroke.code === "KeyC" || stroke.key.toLowerCase() === "c") return { type: "copyStyle" };
  if (stroke.code === "KeyV" || stroke.key.toLowerCase() === "v") return { type: "pasteStyle" };
  return null;
}
