import type { BlendMode, Layer } from "./document";
import { fillPaints, strokePaints, tracesOutline, type Paint, type StrokePaint } from "./layer-paint";

export type PartComposite = "source-over" | "destination-in" | "destination-out";

export interface MaskShape {
  layer: Layer;
  composite: PartComposite;
}

export type PaintPart =
  | { kind: "content"; key: string; layer: Layer; opacity: number; blend: BlendMode | "" }
  | { kind: "masked"; key: string; mask: MaskShape[]; paint: Paint; opacity: number; blend: BlendMode | ""; reach: number };

const INK = "#000000";

const UNPAINTED: Partial<Layer> = {
  fill: undefined,
  gradient: undefined,
  pattern: undefined,
  stroke: undefined,
  strokeWidth: 0,
  dash: undefined,
  dashArray: undefined,
  dashOffset: undefined,
  lineCap: undefined,
  lineJoin: undefined,
  miterLimit: undefined,
  shadow: undefined,
  highlight: undefined,
  fills: undefined,
  strokes: undefined,
  effects: undefined,
  filters: undefined,
  color: undefined,
  gradientMap: undefined,
  blendMode: undefined,
  clip: undefined,
};

function silhouette(layer: Layer): Layer {
  return { ...layer, ...UNPAINTED };
}

function picture(layer: Layer): Layer {
  return { ...layer, shadow: undefined, strokes: undefined, effects: undefined, filters: undefined, color: undefined, gradientMap: undefined, blendMode: undefined, clip: undefined };
}

function outlineShape(base: Layer, stroke: StrokePaint, scale: number): Layer {
  return {
    ...base,
    stroke: INK,
    strokeWidth: stroke.width * scale,
    ...(stroke.dashArray && stroke.dashArray.length > 0 ? { dashArray: stroke.dashArray.map((v) => v / scale) } : {}),
    ...(stroke.dashOffset ? { dashOffset: stroke.dashOffset / scale } : {}),
    ...(stroke.lineCap ? { lineCap: stroke.lineCap } : {}),
    ...(stroke.lineJoin ? { lineJoin: stroke.lineJoin } : {}),
    ...(stroke.miterLimit ? { miterLimit: stroke.miterLimit } : {}),
  };
}

function strokeMask(base: Layer, stroke: StrokePaint): MaskShape[] {
  const filled = { ...base, fill: INK };
  if (stroke.align === "center") return [{ layer: outlineShape(base, stroke, 1), composite: "source-over" }];
  return [
    { layer: outlineShape(base, stroke, 2), composite: "source-over" },
    { layer: filled, composite: stroke.align === "inside" ? "destination-in" : "destination-out" },
  ];
}

function strokeReach(stroke: StrokePaint): number {
  if (stroke.align === "outside") return stroke.width;
  return stroke.align === "center" ? stroke.width / 2 : 0;
}

function direct(layer: Layer, paint: Paint): boolean {
  if (paint.type === "pattern") return false;
  return layer.type !== "icon" || paint.type === "solid";
}

function fillPart(layer: Layer, base: Layer, paint: Paint, index: number): PaintPart {
  const key = `fill-${index}`;
  const blend = paint.blendMode ?? "";
  if (!direct(layer, paint)) return { kind: "masked", key, mask: [{ layer: { ...base, fill: INK }, composite: "source-over" }], paint, opacity: paint.opacity, blend, reach: 0 };
  const painted = paint.type === "gradient" ? { ...base, gradient: paint.gradient } : { ...base, fill: paint.color };
  return { kind: "content", key, layer: painted, opacity: paint.opacity, blend };
}

export function paintParts(layer: Layer): PaintPart[] {
  if (layer.type === "image") return [{ kind: "content", key: "picture", layer: picture(layer), opacity: 1, blend: "" }];
  const base = silhouette(layer);
  const parts: PaintPart[] = [];
  if (layer.type === "text" && layer.highlight) parts.push({ kind: "content", key: "highlight", layer: { ...base, highlight: layer.highlight }, opacity: 1, blend: "" });
  fillPaints(layer).forEach((paint, i) => parts.push(fillPart(layer, base, paint, i)));
  if (tracesOutline(layer)) return parts;
  strokePaints(layer).forEach((stroke, i) =>
    parts.push({ kind: "masked", key: `stroke-${i}`, mask: strokeMask(base, stroke), paint: stroke, opacity: stroke.opacity, blend: stroke.blendMode ?? "", reach: strokeReach(stroke) }),
  );
  return parts;
}
