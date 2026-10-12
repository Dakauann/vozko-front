import { boxBounds, unionBounds } from "../arrange";
import type { CanvasSize, Clip, Gradient, Layer, Transform } from "../document";
import type { Paint } from "../layer-paint";
import { clampTo, LAYER_RANGES } from "../layer-ranges";
import { scaledUnits } from "../layers";
import { generatedColors, recoloredGenerated } from "../generated-layers";

export interface LibraryBox {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface ColorChange {
  from: string;
  to: string;
}

interface Fit {
  sx: number;
  sy: number;
  uniform: boolean;
  place: (transform: Transform) => Transform;
}

const UNIFORM_TOLERANCE = 1e-6;

function scaleFor(target: number | undefined, side: number, extent: number): number | undefined {
  return target === undefined || extent <= 0 ? undefined : (target * side) / extent;
}

function fitOf(transforms: readonly Transform[], canvas: CanvasSize, box: LibraryBox): Fit {
  const bounds = unionBounds(transforms.map((t) => boxBounds(t, canvas)));
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const byWidth = scaleFor(box.w, canvas.width, bounds.right - bounds.left);
  const byHeight = scaleFor(box.h, canvas.height, bounds.bottom - bounds.top);
  const together = transforms.length > 1 && byWidth !== undefined && byHeight !== undefined;
  const sx = together ? Math.min(byWidth, byHeight) : (byWidth ?? byHeight ?? 1);
  const sy = together ? sx : (byHeight ?? byWidth ?? 1);
  const toX = (box.x ?? centerX / canvas.width) * canvas.width;
  const toY = (box.y ?? centerY / canvas.height) * canvas.height;
  return {
    sx,
    sy,
    uniform: Math.abs(sx - sy) <= UNIFORM_TOLERANCE * Math.max(sx, sy),
    place: (t) => ({
      ...t,
      x: (toX + (t.x * canvas.width - centerX) * sx) / canvas.width,
      y: (toY + (t.y * canvas.height - centerY) * sy) / canvas.height,
      w: t.w * sx,
      h: t.h * sy,
    }),
  };
}

function resized(layer: Layer, fit: Fit, together: boolean): Partial<Layer> {
  const units = together && fit.uniform && fit.sx !== 1 ? scaledUnits(layer, fit.sx) : {};
  const font = layer.fontSize !== undefined && fit.uniform && fit.sy !== 1 ? { fontSize: clampTo(layer.fontSize * fit.sy, LAYER_RANGES.fontSize) } : {};
  return { ...units, ...font };
}

function untouched(box: LibraryBox): boolean {
  return box.x === undefined && box.y === undefined && box.w === undefined && box.h === undefined;
}

export function placeLayers(layers: readonly Layer[], canvas: CanvasSize, box: LibraryBox): Layer[] {
  if (layers.length === 0 || untouched(box)) return [...layers];
  const fit = fitOf(
    layers.map((l) => l.transform),
    canvas,
    box,
  );
  return layers.map((layer) => ({ ...layer, ...resized(layer, fit, layers.length > 1), transform: fit.place(layer.transform) }));
}

export function placeClips(clips: readonly Clip[], canvas: CanvasSize, box: LibraryBox): Clip[] {
  const pictures = clips.filter((clip) => clip.type !== "audio");
  if (pictures.length === 0 || untouched(box)) return [...clips];
  const fit = fitOf(
    pictures.map((c) => c.transform),
    canvas,
    box,
  );
  return clips.map((clip) => (clip.type === "audio" ? clip : { ...clip, transform: fit.place(clip.transform), ...(clip.layer ? { layer: { ...clip.layer, ...resized(clip.layer, fit, pictures.length > 1) } } : {}) }));
}

function gradientColors(gradient: Gradient | undefined): (string | undefined)[] {
  return [gradient?.from, gradient?.via, gradient?.to];
}

function paintColors(paint: Paint): (string | undefined)[] {
  return [paint.color, ...gradientColors(paint.gradient)];
}

function paints(layer: Layer): (string | undefined)[] {
  return [
    layer.fill,
    layer.stroke,
    ...gradientColors(layer.gradient),
    layer.highlight?.color,
    ...(layer.fills ?? []).flatMap(paintColors),
    ...(layer.strokes ?? []).flatMap(paintColors),
    ...(layer.effects ?? []).map((effect) => effect.color),
    ...(layer.runs ?? []).map((run) => run.fill),
    ...generatedColors(layer),
  ];
}

export function layerColors(layers: readonly Layer[]): string[] {
  const colors = layers.flatMap((layer) => paints(layer).filter((color): color is string => typeof color === "string" && color.startsWith("#")));
  return [...new Set(colors.map((color) => color.toLowerCase()))];
}

export function recolorLayer(layer: Layer, changes: readonly ColorChange[]): Layer {
  if (changes.length === 0) return layer;
  const swap = (color: string | undefined) => {
    if (color === undefined) return undefined;
    const change = changes.find((c) => c.from.toLowerCase() === color.toLowerCase());
    return change ? change.to : color;
  };
  const swapGradient = (gradient: Gradient): Gradient => ({ ...gradient, from: swap(gradient.from)!, to: swap(gradient.to)!, ...(gradient.via !== undefined ? { via: swap(gradient.via) } : {}) });
  const swapPaint = <P extends Paint>(paint: P): P => ({ ...paint, ...(paint.color !== undefined ? { color: swap(paint.color) } : {}), ...(paint.gradient ? { gradient: swapGradient(paint.gradient) } : {}) });
  return {
    ...layer,
    ...(layer.fill !== undefined ? { fill: swap(layer.fill) } : {}),
    ...(layer.stroke !== undefined ? { stroke: swap(layer.stroke) } : {}),
    ...(layer.gradient ? { gradient: swapGradient(layer.gradient) } : {}),
    ...(layer.highlight ? { highlight: { ...layer.highlight, color: swap(layer.highlight.color)! } } : {}),
    ...(layer.fills ? { fills: layer.fills.map(swapPaint) } : {}),
    ...(layer.strokes ? { strokes: layer.strokes.map(swapPaint) } : {}),
    ...(layer.effects ? { effects: layer.effects.map((effect) => ({ ...effect, color: swap(effect.color)! })) } : {}),
    ...(layer.runs ? { runs: layer.runs.map((run) => (run.fill !== undefined ? { ...run, fill: swap(run.fill) } : run)) } : {}),
    ...recoloredGenerated(layer, (color) => swap(color)!),
  };
}
