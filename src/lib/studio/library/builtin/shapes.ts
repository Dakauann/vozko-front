import { endPatch, layerArrowheads, pathArrowheads } from "../../arrowheads";
import { newShapeLayer, type CanvasSize, type Layer, type ShapeKind } from "../../document";
import { squareTransform } from "../../geometry";
import { regularPolygon, starPolygon } from "../../paint";
import { scalePath } from "../../vector-path";
import { presetLayer, VECTOR_PRESET_IDS, VECTOR_PRESETS, type VectorPreset, type VectorPresetId } from "../../vector-presets";
import { OWN_SOURCE, type LibraryCategory, type LibraryContext, type LibraryItem } from "../model";
import { previewSvg } from "../preview";
import { SHAPE_PACK, SHAPE_SUBCATEGORIES, type LineEnds, type PackItem, type PackShape, type ShapeSubcategory } from "./shape-pack";

const VIEW = 40;
const ROOM = 30;
const SHAPE_SHARE = 0.3;
const LINE_SHARE = 0.5;
const LINE_HEIGHT_SHARE = 0.05;
const PREVIEW_STROKE = 2.5;
const LINE_FROM = 7;
const LINE_TO = 33;
const STROKE = `fill="none" stroke="currentColor" stroke-width="${PREVIEW_STROKE}" stroke-linecap="round" stroke-linejoin="round"`;

interface BasicShape {
  id: string;
  name: string;
  shape: Exclude<ShapeKind, "path" | "polygon">;
  subcategory: ShapeSubcategory;
  extra?: Partial<Layer>;
  markup: string;
}

const BASIC_SHAPES: BasicShape[] = [
  { id: "shape-rect", name: "rect", shape: "rect", subcategory: "basic", markup: `<rect x="5" y="9" width="30" height="22" rx="2" fill="currentColor"/>` },
  { id: "shape-rounded", name: "rounded", shape: "rect", subcategory: "basic", extra: { radius: 0.4 }, markup: `<rect x="5" y="9" width="30" height="22" rx="8" fill="currentColor"/>` },
  { id: "shape-ellipse", name: "ellipse", shape: "ellipse", subcategory: "basic", markup: `<circle cx="20" cy="20" r="13" fill="currentColor"/>` },
  { id: "shape-triangle", name: "triangle", shape: "triangle", subcategory: "basic", markup: `<path d="M20 7 34 32H6Z" fill="currentColor"/>` },
  {
    id: "shape-star",
    name: "star",
    shape: "star",
    subcategory: "stars",
    markup: `<path d="m20 5 4.4 9.6 10.4 1.1-7.8 7 2.2 10.3L20 27.7 10.8 33l2.2-10.3-7.8-7 10.4-1.1Z" fill="currentColor"/>`,
  },
  { id: "shape-line", name: "line", shape: "line", subcategory: "lines", markup: `<path d="M6 20h28" ${STROKE}/>` },
  { id: "shape-arrow", name: "arrow", shape: "arrow", subcategory: "lines", markup: `<path d="M6 20h27m-7-7 7 7-7 7" ${STROKE}/>` },
  { id: "shape-double-arrow", name: "doubleArrow", shape: "arrow", subcategory: "lines", extra: { arrowStart: true }, markup: `<path d="M7 20h26m-7-7 7 7-7 7M14 13l-7 7 7 7" ${STROKE}/>` },
];

const PRESET_SUBCATEGORIES: Record<VectorPresetId, ShapeSubcategory> = {
  diagonalBand: "banners",
  diagonalSplit: "banners",
  arch: "basic",
  ribbon: "banners",
  chevron: "arrows",
  wave: "banners",
  blob: "basic",
  speechBubble: "bubbles",
  heart: "basic",
  swoosh: "lines",
  tornPaper: "banners",
  cornerBracket: "lines",
  squiggle: "lines",
  burst: "stars",
  seal: "banners",
};

function svg(body: string): string {
  return previewSvg(body, VIEW);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function room(ratio: number): { width: number; height: number; offset: string } {
  const width = ratio >= 1 ? ROOM : ROOM * ratio;
  const height = ratio >= 1 ? ROOM / ratio : ROOM;
  return { width, height, offset: `translate(${round((VIEW - width) / 2)} ${round((VIEW - height) / 2)})` };
}

function polygonMarkup(points: readonly number[], offset: string): string {
  return svg(`<g transform="${offset}"><polygon points="${points.map(round).join(" ")}" fill="currentColor"/></g>`);
}

function headsMarkup(heads: readonly number[][], dx: number, dy: number): string {
  return heads.map((points) => `<polygon points="${points.map((value, i) => round(value + (i % 2 === 0 ? dx : dy))).join(" ")}" fill="currentColor"/>`).join("");
}

export function presetMarkup(preset: VectorPreset, evenOdd = false, ends?: LineEnds): string {
  const { width, height, offset } = room(preset.ratio);
  if (preset.kind === "star") return polygonMarkup(starPolygon(preset, width, height), offset);
  const data = scalePath(preset.data, width, height);
  if (!preset.open) return svg(`<g transform="${offset}"><path d="${data}" fill="currentColor" stroke-linejoin="round"${evenOdd ? ` fill-rule="evenodd"` : ""}/></g>`);
  const heads = pathArrowheads({ path: preset.data, strokeWidth: PREVIEW_STROKE, ...endFields(ends) }, width, height);
  return svg(`<g transform="${offset}"><path d="${data}" ${STROKE}/>${headsMarkup(heads, 0, 0)}</g>`);
}

export function vectorPresetMarkup(id: VectorPresetId): string {
  return presetMarkup(VECTOR_PRESETS[id]);
}

function endFields(ends: LineEnds | undefined): Partial<Layer> {
  return { ...(ends?.start ? endPatch("start", ends.start) : {}), ...(ends?.end ? endPatch("end", ends.end) : {}) };
}

function endsOf(item: PackItem): Partial<Layer> {
  return endFields(item.shape.kind === "line" ? item.shape.ends : item.ends);
}

function lineMarkup(shape: Extract<PackShape, { kind: "line" }>): string {
  const dash = shape.dash && shape.dash.length > 0 ? ` stroke-dasharray="${shape.dash.map((value) => round(value * PREVIEW_STROKE)).join(" ")}"` : "";
  const heads = layerArrowheads({ type: "shape", shape: "line", strokeWidth: PREVIEW_STROKE, ...endFields(shape.ends) }, LINE_TO - LINE_FROM, 0);
  return svg(`<path d="M${LINE_FROM} 20H${LINE_TO}" fill="none" stroke="currentColor" stroke-width="${PREVIEW_STROKE}" stroke-linecap="${shape.cap ?? "butt"}"${dash}/>${headsMarkup(heads, LINE_FROM, 20)}`);
}

function packMarkup(item: PackItem): string {
  const { shape } = item;
  switch (shape.kind) {
    case "line":
      return lineMarkup(shape);
    case "polygon": {
      const { width, height, offset } = room(shape.ratio);
      return polygonMarkup(regularPolygon(shape, width, height), offset);
    }
    case "rect": {
      const { width, height, offset } = room(shape.ratio);
      return svg(`<g transform="${offset}"><rect width="${round(width)}" height="${round(height)}" rx="${round((Math.min(width, height) / 2) * shape.radius)}" fill="currentColor"/></g>`);
    }
    case "ellipse": {
      const { width, height } = room(shape.ratio);
      return svg(`<ellipse cx="20" cy="20" rx="${round(width / 2)}" ry="${round(height / 2)}" fill="currentColor"/>`);
    }
    default:
      return presetMarkup(shape, item.evenOdd, item.ends);
  }
}

function ratioTransform(canvas: CanvasSize, ratio: number) {
  return ratio >= 1 ? squareTransform(canvas, SHAPE_SHARE, SHAPE_SHARE / ratio) : squareTransform(canvas, SHAPE_SHARE * ratio, SHAPE_SHARE);
}

function packLayer(item: PackItem, canvas: CanvasSize): Layer {
  const { shape } = item;
  switch (shape.kind) {
    case "line":
      return { ...newShapeLayer("line", squareTransform(canvas, LINE_SHARE, LINE_HEIGHT_SHARE)), ...endsOf(item), ...(shape.dash ? { dashArray: [...shape.dash] } : {}), ...(shape.cap ? { lineCap: shape.cap } : {}) };
    case "polygon":
      return { ...newShapeLayer("polygon", ratioTransform(canvas, shape.ratio)), points: shape.points };
    case "rect":
      return { ...newShapeLayer("rect", ratioTransform(canvas, shape.ratio)), ...(shape.radius > 0 ? { radius: shape.radius } : {}) };
    case "ellipse":
      return newShapeLayer("ellipse", ratioTransform(canvas, shape.ratio));
    default:
      return { ...presetLayer(shape, canvas), ...endsOf(item), ...(item.evenOdd ? { fillRule: "evenodd" as const } : {}) };
  }
}

function packRatio(shape: PackShape): number {
  return shape.kind === "line" ? LINE_SHARE / LINE_HEIGHT_SHARE : shape.ratio;
}

function inked(layer: Layer, ctx: LibraryContext): Layer {
  return layer.strokeWidth !== undefined ? { ...layer, stroke: ctx.ink } : layer;
}

function basicLayer(shape: BasicShape, canvas: CanvasSize): Layer {
  const line = shape.shape === "line" || shape.shape === "arrow";
  const transform = line ? squareTransform(canvas, LINE_SHARE, LINE_HEIGHT_SHARE) : squareTransform(canvas, SHAPE_SHARE);
  return { ...newShapeLayer(shape.shape, transform), ...shape.extra };
}

function basicItem(shape: BasicShape): LibraryItem {
  const line = shape.shape === "line" || shape.shape === "arrow";
  return {
    id: shape.id,
    category: "shapes",
    subcategory: shape.subcategory,
    editors: ["image", "video"],
    ratio: line ? LINE_SHARE / LINE_HEIGHT_SHARE : 1,
    label: { key: `studio.library.items.${shape.name}` },
    preview: { kind: "svg", markup: svg(shape.markup) },
    source: OWN_SOURCE,
    template: { kind: "layers", build: (ctx) => ({ layers: [inked(basicLayer(shape, ctx.canvas), ctx)] }) },
  };
}

function kebab(id: string): string {
  return id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function presetItem(id: VectorPresetId): LibraryItem {
  return {
    id: `shape-${kebab(id)}`,
    category: "shapes",
    subcategory: PRESET_SUBCATEGORIES[id],
    editors: ["image", "video"],
    ratio: VECTOR_PRESETS[id].ratio,
    label: { key: `studio.vectors.names.${id}` },
    preview: { kind: "svg", markup: vectorPresetMarkup(id) },
    source: OWN_SOURCE,
    template: { kind: "layers", build: (ctx) => ({ layers: [inked(presetLayer(VECTOR_PRESETS[id], ctx.canvas), ctx)] }) },
  };
}

function packItem(item: PackItem): LibraryItem {
  return {
    id: item.id,
    category: "shapes",
    subcategory: item.subcategory,
    editors: ["image", "video"],
    ratio: packRatio(item.shape),
    label: { text: item.name },
    ...(item.tags ? { tags: item.tags } : {}),
    preview: { kind: "svg", markup: packMarkup(item) },
    source: OWN_SOURCE,
    template: { kind: "layers", build: (ctx) => ({ layers: [inked(packLayer(item, ctx.canvas), ctx)] }) },
  };
}

const UNORDERED: readonly LibraryItem[] = [...BASIC_SHAPES.map(basicItem), ...VECTOR_PRESET_IDS.map(presetItem), ...SHAPE_PACK.map(packItem)];

const HOME_FIRST: ShapeSubcategory = "basic";

const SHAPE_ITEMS: readonly LibraryItem[] = [HOME_FIRST, ...SHAPE_SUBCATEGORIES.filter((sub) => sub !== HOME_FIRST)].flatMap((sub) => UNORDERED.filter((item) => item.subcategory === sub));

export const SHAPES_CATEGORY: LibraryCategory = {
  id: "shapes",
  panel: "elements",
  label: { key: "studio.library.categories.shapes" },
  tile: "square",
  subcategories: SHAPE_SUBCATEGORIES.map((id) => ({ id, label: { key: `studio.library.subcategories.${id}` } })),
  items: () => SHAPE_ITEMS,
};
