import { pathArrowheads } from "./arrowheads";
import type { CanvasSize, Gradient, ImageSurface, Layer } from "./document";
import { strokeStyle } from "./paint";
import { pathBounds, subpathsToPath, type Subpath } from "./path-nodes";
import { canvasSubpaths, unitToCanvas, vectorLayerOf } from "./vector-layer";

function round(value: number): string {
  return String(Math.round(value * 1000) / 1000 || 0);
}

function color(value: string): { hex: string; opacity: number } {
  if (value.length === 9) return { hex: value.slice(0, 7), opacity: parseInt(value.slice(7), 16) / 255 };
  return { hex: value, opacity: 1 };
}

function paintAttrs(name: "fill" | "stroke", value: string): string {
  const { hex, opacity } = color(value);
  return opacity >= 1 ? `${name}="${hex}"` : `${name}="${hex}" ${name}-opacity="${round(opacity)}"`;
}

function gradientDef(id: string, gradient: Gradient): string {
  const stops = [gradient.from, ...(gradient.via ? [gradient.via] : []), gradient.to].map((value, i, all) => {
    const { hex, opacity } = color(value);
    return `<stop offset="${round(all.length === 1 ? 0 : i / (all.length - 1))}" stop-color="${hex}"${opacity < 1 ? ` stop-opacity="${round(opacity)}"` : ""}/>`;
  });
  if (gradient.kind === "radial") return `<radialGradient id="${id}" cx="${round(gradient.cx ?? 0.5)}" cy="${round(gradient.cy ?? 0.5)}" r="${round((gradient.radius ?? 1) / 2)}">${stops.join("")}</radialGradient>`;
  const radians = (gradient.angle * Math.PI) / 180;
  const dx = Math.cos(radians) / 2;
  const dy = Math.sin(radians) / 2;
  return `<linearGradient id="${id}" x1="${round(0.5 - dx)}" y1="${round(0.5 - dy)}" x2="${round(0.5 + dx)}" y2="${round(0.5 + dy)}">${stops.join("")}</linearGradient>`;
}

function arrowheads(layer: Layer, canvas: CanvasSize): Subpath[] {
  const width = layer.transform.w * canvas.width;
  const height = layer.transform.h * canvas.height;
  return pathArrowheads(layer, width, height).map((points) => ({
    closed: true,
    nodes: [0, 2, 4].map((i) => unitToCanvas(layer.transform, canvas, { x: points[i] / width, y: points[i + 1] / height })),
  }));
}

export function layersToSvg(doc: ImageSurface, ids: readonly string[]): string | null {
  const wanted = new Set(ids);
  const vectors = doc.layers.filter((l) => wanted.has(l.id)).flatMap((l) => {
    const vector = l.hidden ? null : vectorLayerOf(l, doc.canvas);
    return vector ? [vector] : [];
  });
  if (vectors.length === 0) return null;
  const defs: string[] = [];
  const shapes = vectors.map((layer, index) => {
    const subpaths = canvasSubpaths(layer, doc.canvas);
    const attrs = [`d="${subpathsToPath(subpaths)}"`];
    if (layer.gradient) {
      const id = `g${index}`;
      defs.push(gradientDef(id, layer.gradient));
      attrs.push(`fill="url(#${id})"`);
    } else {
      attrs.push(layer.fill ? paintAttrs("fill", layer.fill) : `fill="none"`);
    }
    if (layer.fillRule === "evenodd") attrs.push(`fill-rule="evenodd"`);
    if (layer.stroke && (layer.strokeWidth ?? 0) > 0) {
      const style = strokeStyle(layer);
      attrs.push(paintAttrs("stroke", layer.stroke), `stroke-width="${round(layer.strokeWidth ?? 0)}"`, `stroke-linecap="${style.lineCap}"`, `stroke-linejoin="${style.lineJoin}"`);
      if (style.lineJoin === "miter") attrs.push(`stroke-miterlimit="${round(style.miterLimit)}"`);
      if (style.dash) attrs.push(`stroke-dasharray="${style.dash.map(round).join(" ")}"`);
      if (style.dashOffset !== 0) attrs.push(`stroke-dashoffset="${round(style.dashOffset)}"`);
    }
    const opacity = layer.transform.opacity < 1 ? ` opacity="${round(layer.transform.opacity)}"` : "";
    const ink = layer.stroke || layer.fill;
    const heads = arrowheads(layer, doc.canvas);
    if (!ink || heads.length === 0) return { subpaths, element: `<path ${attrs.join(" ")}${opacity}/>` };
    const triangles = heads.map((head) => `<path d="${subpathsToPath([head])}" ${paintAttrs("fill", ink)}/>`);
    return { subpaths: [...subpaths, ...heads], element: `<g${opacity}><path ${attrs.join(" ")}/>${triangles.join("")}</g>` };
  });
  const bounds = pathBounds(shapes.flatMap((s) => s.subpaths));
  const viewBox = [bounds.left, bounds.top, Math.max(bounds.right - bounds.left, 1), Math.max(bounds.bottom - bounds.top, 1)].map(round).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${defs.length > 0 ? `<defs>${defs.join("")}</defs>` : ""}${shapes.map((s) => s.element).join("")}</svg>`;
}
