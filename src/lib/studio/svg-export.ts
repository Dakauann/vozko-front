import type { ImageSurface } from "./document";
import { layerVectors, roundedSubpaths, type ColorStop, type ExportScene, type PortableBlend, type RasterItem, type SceneStroke, type ScenePaint, type VectorItem } from "./export-scene";
import type { Box } from "./paint";
import { pathBounds, subpathsToPath } from "./path-nodes";

const DECIMALS = 3;
export const SVG_PATCH_RATIO = 2;
const SVG_NAMESPACE = 'xmlns="http://www.w3.org/2000/svg"';
const XLINK_NAMESPACE = 'xmlns:xlink="http://www.w3.org/1999/xlink"';

export interface SvgImage {
  bounds: Box;
  href: string;
}

function num(value: number): string {
  const scale = 10 ** DECIMALS;
  return String(Math.round(value * scale) / scale || 0);
}

function stopElement(stop: ColorStop): string {
  return `<stop offset="${num(stop.offset)}" stop-color="${stop.color}"${stop.alpha < 1 ? ` stop-opacity="${num(stop.alpha)}"` : ""}/>`;
}

class Defs {
  readonly entries: string[] = [];

  paint(name: "fill" | "stroke", paint: ScenePaint | null): string {
    if (!paint) return `${name}="none"`;
    if (paint.kind === "solid") return paint.alpha < 1 ? `${name}="${paint.color}" ${name}-opacity="${num(paint.alpha)}"` : `${name}="${paint.color}"`;
    const id = `g${this.entries.length}`;
    const stops = paint.stops.map(stopElement).join("");
    this.entries.push(
      paint.kind === "linear"
        ? `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(paint.from.x)}" y1="${num(paint.from.y)}" x2="${num(paint.to.x)}" y2="${num(paint.to.y)}">${stops}</linearGradient>`
        : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${num(paint.center.x)}" cy="${num(paint.center.y)}" r="${num(paint.radius)}">${stops}</radialGradient>`,
    );
    return `${name}="url(#${id})"`;
  }

  toString(): string {
    return this.entries.length > 0 ? `<defs>${this.entries.join("")}</defs>` : "";
  }
}

function blendStyle(blend: PortableBlend): string {
  return blend === "normal" ? "" : ` style="mix-blend-mode:${blend}"`;
}

function strokeAttrs(stroke: SceneStroke, defs: Defs): string[] {
  const attrs = [defs.paint("stroke", { kind: "solid", color: stroke.color, alpha: stroke.alpha }), `stroke-width="${num(stroke.width)}"`, `stroke-linecap="${stroke.cap}"`, `stroke-linejoin="${stroke.join}"`];
  if (stroke.join === "miter") attrs.push(`stroke-miterlimit="${num(stroke.miterLimit)}"`);
  if (stroke.dash) attrs.push(`stroke-dasharray="${stroke.dash.map(num).join(" ")}"`);
  if (stroke.dashOffset !== 0) attrs.push(`stroke-dashoffset="${num(stroke.dashOffset)}"`);
  return attrs;
}

function vectorElement(item: VectorItem, defs: Defs): string {
  const attrs = [`d="${subpathsToPath(roundedSubpaths(item.subpaths, DECIMALS))}"`, defs.paint("fill", item.fill)];
  if (item.fillRule === "evenodd") attrs.push(`fill-rule="evenodd"`);
  if (item.stroke) attrs.push(...strokeAttrs(item.stroke, defs));
  if (item.opacity < 1) attrs.push(`opacity="${num(item.opacity)}"`);
  return `<path ${attrs.join(" ")}${blendStyle(item.blend)}/>`;
}

function imageElement(item: RasterItem, image: SvgImage | undefined): string {
  if (!image) throw new Error(`svg export is missing the pixels of ${item.id}`);
  const { bounds } = image;
  return `<image x="${num(bounds.x)}" y="${num(bounds.y)}" width="${num(bounds.width)}" height="${num(bounds.height)}" preserveAspectRatio="none" xlink:href="${image.href}"${blendStyle(item.blend)}/>`;
}

export function sceneToSvg(scene: ExportScene, images: ReadonlyMap<string, SvgImage>): string {
  const defs = new Defs();
  const background = scene.background ? `<rect x="0" y="0" width="${num(scene.width)}" height="${num(scene.height)}" ${defs.paint("fill", scene.background)}/>` : "";
  const items = scene.items.map((item) => (item.kind === "vector" ? vectorElement(item, defs) : imageElement(item, images.get(item.id))));
  const size = `width="${num(scene.width)}" height="${num(scene.height)}" viewBox="0 0 ${num(scene.width)} ${num(scene.height)}"`;
  return `<svg ${SVG_NAMESPACE} ${XLINK_NAMESPACE} ${size}>${defs}${background}${items.join("")}</svg>`;
}

export function layersToSvg(doc: ImageSurface, ids: readonly string[]): string | null {
  const wanted = new Set(ids);
  const vectors = doc.layers.filter((l) => wanted.has(l.id) && !l.hidden).flatMap((l) => layerVectors(l, doc.canvas) ?? []);
  if (vectors.length === 0) return null;
  const defs = new Defs();
  const elements = vectors.map((item) => vectorElement(item, defs));
  const bounds = pathBounds(vectors.flatMap((item) => roundedSubpaths(item.subpaths, DECIMALS)));
  const viewBox = [bounds.left, bounds.top, Math.max(bounds.right - bounds.left, 1), Math.max(bounds.bottom - bounds.top, 1)].map(num).join(" ");
  return `<svg ${SVG_NAMESPACE} viewBox="${viewBox}">${defs}${elements.join("")}</svg>`;
}
