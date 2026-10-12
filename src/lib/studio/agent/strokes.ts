import { boxCorners } from "../arrange";
import { parseColor } from "../color";
import { convexArea, convexIntersection, type Point } from "../convex";
import type { CanvasSize, Layer } from "../document";
import { isUpright } from "./look-views";
import { paintOf, type Box, type SceneElement, type SceneGround } from "./scene";
import { inkBox, isText, type TextElement, type TextMeasure } from "./text-ink";

export type StrokeKind = "line" | "arrow" | "bar" | "border";

export interface StrokeCrossing {
  stroke: SceneElement;
  text: TextElement;
  kind: StrokeKind;
  area: Point[];
}

export const STROKE_NOUNS: Record<StrokeKind, string> = { line: "a linha", arrow: "a seta", bar: "a barra", border: "a borda de" };

const INK_INSET = 0.2;
const CROSS_SHARE = 0.5;
const THIN_SHARE = 0.012;
const LONG_RATIO = 6;
const BORDER_SHARE: readonly [number, number] = [0.05, 0.95];
const MIN_STROKE_PX = 1;

interface Stroke {
  el: SceneElement;
  kind: StrokeKind;
  polygon: Point[];
  thickness: number;
}

function visible(color: string | undefined): boolean {
  const parsed = parseColor(color);
  return parsed !== null && parsed.a > 0.01;
}

function filled(layer: Layer): boolean {
  const paint = paintOf(layer);
  return paint !== null && paint.a > 0.01;
}

function strokeOf(el: SceneElement, canvas: CanvasSize): Stroke | null {
  const layer = el.layer;
  if (el.opacity <= 0 || layer?.type !== "shape") return null;
  const t = el.transform;
  const width = layer.strokeWidth ?? 0;
  if ((layer.shape === "line" || layer.shape === "arrow") && width > 0 && visible(layer.stroke)) {
    const thickness = Math.max(MIN_STROKE_PX, width);
    return { el, kind: layer.shape, polygon: boxCorners({ ...t, h: thickness / canvas.height }, canvas), thickness };
  }
  if (layer.shape !== "rect") return null;
  if (filled(layer)) {
    const sides = [t.w * canvas.width, t.h * canvas.height].sort((a, b) => a - b);
    const [short, long] = sides;
    if (short > THIN_SHARE * Math.min(canvas.width, canvas.height) || long < LONG_RATIO * short) return null;
    return { el, kind: "bar", polygon: boxCorners(t, canvas), thickness: Math.max(MIN_STROKE_PX, short) };
  }
  return width > 0 && visible(layer.stroke) ? { el, kind: "border", polygon: boxCorners(t, canvas), thickness: width } : null;
}

function innerInk(ink: Box, canvas: CanvasSize): Point[] {
  const [left, right, top, bottom] = [ink.left * canvas.width, ink.right * canvas.width, ink.top * canvas.height, ink.bottom * canvas.height];
  const inset = (bottom - top) * INK_INSET;
  return [
    [left + inset, top + inset],
    [right - inset, top + inset],
    [right - inset, bottom - inset],
    [left + inset, bottom - inset],
  ];
}

function crossing(stroke: Stroke, inner: Point[]): Point[] | null {
  const [[left, top], , [right, bottom]] = inner;
  if (right <= left || bottom <= top) return null;
  const shared = convexIntersection(stroke.polygon, inner);
  if (stroke.kind === "border") {
    const share = convexArea(shared) / convexArea(inner);
    return share > BORDER_SHARE[0] && share < BORDER_SHARE[1] ? inner : null;
  }
  return convexArea(shared) / stroke.thickness >= CROSS_SHARE * Math.min(right - left, bottom - top) ? shared : null;
}

export function strokeCrossings(scene: SceneGround, measure: TextMeasure): StrokeCrossing[] {
  const { canvas } = scene;
  const strokes = scene.elements.flatMap((el) => strokeOf(el, canvas) ?? []);
  if (strokes.length === 0) return [];
  return scene.elements
    .filter(isText)
    .filter((text) => text.opacity > 0 && isUpright(text.transform))
    .flatMap((text) => {
      const inner = innerInk(inkBox(scene, text, measure), canvas);
      return strokes.flatMap((stroke): StrokeCrossing[] => {
        if (stroke.el === text) return [];
        const area = crossing(stroke, inner);
        return area ? [{ stroke: stroke.el, text, kind: stroke.kind, area }] : [];
      });
    });
}
