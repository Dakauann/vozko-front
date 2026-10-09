import { newPathLayer, type CanvasSize, type Layer, type Transform } from "./document";
import { LAYER_RANGES } from "./layer-ranges";
import type { LayerPatch } from "./layers";
import { starPolygon } from "./paint";
import { fitToUnit, mapSubpaths, pathToSubpaths, subpathsToPath, type Subpath } from "./path-nodes";
import type { Point } from "./viewport";

const MIN_SIDE = LAYER_RANGES.size[0];
const MAX_SIDE = LAYER_RANGES.size[1];

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function unitToCanvas(t: Transform, canvas: CanvasSize, unit: Point): Point {
  const width = t.w * canvas.width;
  const height = t.h * canvas.height;
  const lx = (unit.x - 0.5) * width;
  const ly = (unit.y - 0.5) * height;
  const angle = radians(t.rotation);
  return {
    x: t.x * canvas.width + lx * Math.cos(angle) - ly * Math.sin(angle),
    y: t.y * canvas.height + lx * Math.sin(angle) + ly * Math.cos(angle),
  };
}

export function canvasToUnit(t: Transform, canvas: CanvasSize, point: Point): Point {
  const width = t.w * canvas.width;
  const height = t.h * canvas.height;
  const dx = point.x - t.x * canvas.width;
  const dy = point.y - t.y * canvas.height;
  const angle = radians(-t.rotation);
  const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
  return { x: lx / width + 0.5, y: ly / height + 0.5 };
}

export function layerSubpaths(layer: Layer): Subpath[] {
  return pathToSubpaths(layer.path ?? "");
}

function fittingSide(sidePx: number, canvasSide: number): number {
  return Math.max(sidePx / canvasSide, MIN_SIDE);
}

export function canvasSubpaths(layer: Layer, canvas: CanvasSize): Subpath[] {
  return mapSubpaths(layerSubpaths(layer), (p) => unitToCanvas(layer.transform, canvas, p));
}

export function pathGeometryFromCanvas(subpaths: readonly Subpath[], canvas: CanvasSize): { path: string; transform: Transform } {
  const { subpaths: unit, bounds } = fitToUnit(subpaths);
  const transform: Transform = {
    x: (bounds.left + bounds.right) / 2 / canvas.width,
    y: (bounds.top + bounds.bottom) / 2 / canvas.height,
    w: fittingSide(bounds.right - bounds.left, canvas.width),
    h: fittingSide(bounds.bottom - bounds.top, canvas.height),
    rotation: 0,
    opacity: 1,
  };
  return { path: subpathsToPath(unit), transform };
}

export function pathLayerFromCanvas(subpaths: readonly Subpath[], canvas: CanvasSize, open: boolean): Layer {
  const { path, transform } = pathGeometryFromCanvas(subpaths, canvas);
  return newPathLayer(path, transform, open);
}

export function refitPathLayer(layer: Layer, unitSubpaths: readonly Subpath[], canvas: CanvasSize): LayerPatch | null {
  const t = layer.transform;
  const { subpaths, bounds } = fitToUnit(unitSubpaths);
  const width = t.w * canvas.width;
  const height = t.h * canvas.height;
  const offsetX = ((bounds.left + bounds.right) / 2 - 0.5) * width;
  const offsetY = ((bounds.top + bounds.bottom) / 2 - 0.5) * height;
  const angle = radians(t.rotation);
  const w = fittingSide((bounds.right - bounds.left) * width, canvas.width);
  const h = fittingSide((bounds.bottom - bounds.top) * height, canvas.height);
  if (w > MAX_SIDE || h > MAX_SIDE) return null;
  const transform: Transform = {
    ...t,
    x: t.x + (offsetX * Math.cos(angle) - offsetY * Math.sin(angle)) / canvas.width,
    y: t.y + (offsetX * Math.sin(angle) + offsetY * Math.cos(angle)) / canvas.height,
    w,
    h,
  };
  return { transform, path: subpathsToPath(subpaths) };
}

function roundedRectPath(layer: Layer, canvas: CanvasSize): string {
  const width = layer.transform.w * canvas.width;
  const height = layer.transform.h * canvas.height;
  const radius = ((layer.radius ?? 0) * Math.min(width, height)) / 2;
  if (radius <= 0) return "M0 0 L1 0 L1 1 L0 1 Z";
  const rx = radius / width;
  const ry = radius / height;
  return [
    `M${rx} 0 L${1 - rx} 0`,
    `A${rx} ${ry} 0 0 1 1 ${ry} L1 ${1 - ry}`,
    `A${rx} ${ry} 0 0 1 ${1 - rx} 1 L${rx} 1`,
    `A${rx} ${ry} 0 0 1 0 ${1 - ry} L0 ${ry}`,
    `A${rx} ${ry} 0 0 1 ${rx} 0 Z`,
  ].join(" ");
}

function polygonPath(points: readonly number[]): string {
  const pairs: string[] = [];
  for (let i = 0; i < points.length; i += 2) pairs.push(`${i === 0 ? "M" : "L"}${points[i]} ${points[i + 1]}`);
  return `${pairs.join(" ")} Z`;
}

function outlineOf(layer: Layer, canvas: CanvasSize): string | null {
  switch (layer.shape) {
    case "rect":
      return roundedRectPath(layer, canvas);
    case "ellipse":
      return "M0 0.5 A0.5 0.5 0 0 1 1 0.5 A0.5 0.5 0 0 1 0 0.5 Z";
    case "triangle":
      return "M0.5 0 L1 1 L0 1 Z";
    case "star":
      return polygonPath(starPolygon(layer, 1, 1));
    default:
      return null;
  }
}

export function convertToPath(layer: Layer, canvas: CanvasSize): LayerPatch | null {
  if (layer.type !== "shape") return null;
  const outline = outlineOf(layer, canvas);
  if (!outline) return null;
  return { shape: "path", path: subpathsToPath(pathToSubpaths(outline)), radius: undefined, points: undefined, inner: undefined };
}

export function vectorLayerOf(layer: Layer, canvas: CanvasSize): Layer | null {
  if (layer.type !== "shape") return null;
  if (layer.shape === "path") return layer;
  const patch = convertToPath(layer, canvas);
  return patch ? { ...layer, ...patch } : null;
}
