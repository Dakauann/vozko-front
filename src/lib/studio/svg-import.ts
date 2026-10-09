import { LINE_CAPS, LINE_JOINS, MAX_DASH_VALUES, newStudioId, type CanvasSize, type FillRule, type Gradient, type Layer, type LineCap, type LineJoin, type StudioGroup } from "./document";
import { LAYER_RANGES } from "./layer-ranges";
import { mapSubpaths, pathBounds, pathToSubpaths, type Subpath } from "./path-nodes";
import { pathLayerFromCanvas } from "./vector-layer";
import type { Point } from "./viewport";

export interface SvgTarget {
  center: Point;
  width: number;
  height: number;
  rotation: number;
}

export interface SvgImport {
  layers: Layer[];
  groups: StudioGroup[];
  skipped: number;
}

export type SvgImportResult = { ok: true; value: SvgImport } | { ok: false; reason: "invalid" | "empty" };

export const SVG_IMPORT_SHARE = 0.6;

type Matrix = [number, number, number, number, number, number];

interface Paint {
  fill: string;
  fillOpacity: number;
  fillRule: string;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  lineCap: string;
  lineJoin: string;
  miterLimit: number;
  dashArray: string;
  dashOffset: number;
  opacity: number;
  color: string;
}

interface Item {
  subpaths: Subpath[];
  local: Subpath[];
  paint: Paint;
  scale: number;
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const SKIPPED = new Set(["text", "image", "foreignObject", "video", "audio"]);
const IGNORED = new Set(["defs", "style", "title", "desc", "metadata", "script", "symbol", "clipPath", "mask", "pattern", "marker", "linearGradient", "radialGradient", "filter"]);
const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  lime: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  navy: "#000080",
  teal: "#008080",
  maroon: "#800000",
  olive: "#808000",
  fuchsia: "#ff00ff",
  aqua: "#00ffff",
  pink: "#ffc0cb",
  brown: "#a52a2a",
};
const DEFAULT_PAINT: Paint = { fill: "#000000", fillOpacity: 1, fillRule: "nonzero", stroke: "none", strokeOpacity: 1, strokeWidth: 1, lineCap: "butt", lineJoin: "miter", miterLimit: 4, dashArray: "none", dashOffset: 0, opacity: 1, color: "#000000" };

function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

function applyMatrix(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

function numbers(text: string): number[] {
  return (text.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(Number);
}

function parseTransform(text: string | null): Matrix {
  if (!text) return IDENTITY;
  let result = IDENTITY;
  for (const [, name, args] of text.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const v = numbers(args);
    let m: Matrix = IDENTITY;
    switch (name) {
      case "matrix":
        if (v.length === 6) m = v as Matrix;
        break;
      case "translate":
        m = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
        break;
      case "scale":
        m = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
        break;
      case "rotate": {
        const a = ((v[0] ?? 0) * Math.PI) / 180;
        const rotation: Matrix = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
        m = v.length === 3 ? multiply(multiply([1, 0, 0, 1, v[1], v[2]], rotation), [1, 0, 0, 1, -v[1], -v[2]]) : rotation;
        break;
      }
      case "skewX":
        m = [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case "skewY":
        m = [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    result = multiply(result, m);
  }
  return result;
}

function hex2(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
}

function parseColor(value: string, current: string): string | null {
  const text = value.trim().toLowerCase();
  if (text === "currentcolor") return current;
  if (NAMED[text]) return NAMED[text];
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  const rgb = /^rgba?\(([^)]*)\)$/.exec(text);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    const channel = (part: string) => (part.endsWith("%") ? (parseFloat(part) * 255) / 100 : parseFloat(part));
    if (parts.length >= 3 && parts.slice(0, 3).every((p) => Number.isFinite(channel(p)))) return `#${hex2(channel(parts[0]))}${hex2(channel(parts[1]))}${hex2(channel(parts[2]))}`;
  }
  return null;
}

function declarations(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(";")) {
    const [key, ...rest] = part.split(":");
    if (key && rest.length > 0) out[key.trim().toLowerCase()] = rest.join(":").trim();
  }
  return out;
}

function stylesheet(root: Element): Map<string, Record<string, string>> {
  const rules = new Map<string, Record<string, string>>();
  for (const style of Array.from(root.getElementsByTagName("style"))) {
    const css = (style.textContent ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      for (const selector of selectors.split(",").map((s) => s.trim()).filter(Boolean)) {
        rules.set(selector, { ...(rules.get(selector) ?? {}), ...declarations(body) });
      }
    }
  }
  return rules;
}

const PAINT_KEYS = ["fill", "fill-opacity", "fill-rule", "stroke", "stroke-opacity", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "opacity", "color", "display", "visibility"];

type Attributes = Record<string, string>;

function attributesOf(element: Element): Attributes {
  const out: Attributes = {};
  for (const attribute of Array.from(element.attributes)) out[attribute.name] = attribute.value;
  return out;
}

function ownDeclarations(name: string, attrs: Attributes, rules: Map<string, Record<string, string>>): Record<string, string> {
  const own: Record<string, string> = {};
  for (const key of PAINT_KEYS) if (attrs[key] !== undefined) own[key] = attrs[key];
  Object.assign(own, rules.get(name) ?? {});
  for (const className of (attrs.class ?? "").split(/\s+/).filter(Boolean)) Object.assign(own, rules.get(`.${className}`) ?? {});
  if (attrs.id) Object.assign(own, rules.get(`#${attrs.id}`) ?? {});
  Object.assign(own, declarations(attrs.style ?? ""));
  return own;
}

function fraction(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, value.trim().endsWith("%") ? parsed / 100 : parsed)) : fallback;
}

function paintOf(own: Record<string, string>, inherited: Paint): Paint {
  const color = own.color ? (parseColor(own.color, inherited.color) ?? inherited.color) : inherited.color;
  const width = own["stroke-width"] !== undefined ? parseFloat(own["stroke-width"]) : NaN;
  return {
    color,
    fill: own.fill ?? inherited.fill,
    fillOpacity: own["fill-opacity"] !== undefined ? fraction(own["fill-opacity"], 1) : inherited.fillOpacity,
    fillRule: own["fill-rule"] ?? inherited.fillRule,
    stroke: own.stroke ?? inherited.stroke,
    strokeOpacity: own["stroke-opacity"] !== undefined ? fraction(own["stroke-opacity"], 1) : inherited.strokeOpacity,
    strokeWidth: Number.isFinite(width) ? width : inherited.strokeWidth,
    lineCap: own["stroke-linecap"] ?? inherited.lineCap,
    lineJoin: own["stroke-linejoin"] ?? inherited.lineJoin,
    miterLimit: own["stroke-miterlimit"] !== undefined && Number.isFinite(parseFloat(own["stroke-miterlimit"])) ? parseFloat(own["stroke-miterlimit"]) : inherited.miterLimit,
    dashArray: own["stroke-dasharray"] ?? inherited.dashArray,
    dashOffset: own["stroke-dashoffset"] !== undefined && Number.isFinite(parseFloat(own["stroke-dashoffset"])) ? parseFloat(own["stroke-dashoffset"]) : inherited.dashOffset,
    opacity: inherited.opacity * fraction(own.opacity, 1),
  };
}

function attr(attrs: Attributes, name: string): number {
  const value = parseFloat(attrs[name] ?? "");
  return Number.isFinite(value) ? value : 0;
}

function polyPath(points: number[], closed: boolean): string {
  const pairs: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) pairs.push(`${i === 0 ? "M" : "L"}${points[i]} ${points[i + 1]}`);
  return pairs.length < 2 ? "" : `${pairs.join(" ")}${closed ? " Z" : ""}`;
}

function geometryOf(name: string, a: Attributes): string {
  switch (name) {
    case "path":
      return a.d ?? "";
    case "rect": {
      const x = attr(a, "x");
      const y = attr(a, "y");
      const w = attr(a, "width");
      const h = attr(a, "height");
      if (w <= 0 || h <= 0) return "";
      let rx = a.rx !== undefined ? attr(a, "rx") : attr(a, "ry");
      let ry = a.ry !== undefined ? attr(a, "ry") : rx;
      rx = Math.min(Math.max(0, rx), w / 2);
      ry = Math.min(Math.max(0, ry), h / 2);
      if (rx === 0 || ry === 0) return `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
      return `M${x + rx} ${y} H${x + w - rx} A${rx} ${ry} 0 0 1 ${x + w} ${y + ry} V${y + h - ry} A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} H${x + rx} A${rx} ${ry} 0 0 1 ${x} ${y + h - ry} V${y + ry} A${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`;
    }
    case "circle":
    case "ellipse": {
      const cx = attr(a, "cx");
      const cy = attr(a, "cy");
      const rx = name === "circle" ? attr(a, "r") : attr(a, "rx");
      const ry = name === "circle" ? attr(a, "r") : attr(a, "ry");
      if (rx <= 0 || ry <= 0) return "";
      return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    case "line":
      return `M${attr(a, "x1")} ${attr(a, "y1")} L${attr(a, "x2")} ${attr(a, "y2")}`;
    case "polyline":
    case "polygon":
      return polyPath(numbers(a.points ?? ""), name === "polygon");
    default:
      return "";
  }
}

class IdIndex {
  private index: Map<string, Element> | null = null;

  constructor(private readonly root: Element) {}

  find(id: string): Element | null {
    if (!this.index) {
      this.index = new Map();
      for (const element of Array.from(this.root.getElementsByTagName("*"))) {
        const own = element.getAttribute("id");
        if (own && !this.index.has(own)) this.index.set(own, element);
      }
    }
    return this.index.get(id) ?? null;
  }
}

function referenced(attrs: Attributes, ids: IdIndex): Element | null {
  const href = attrs.href ?? attrs["xlink:href"];
  return href?.startsWith("#") ? ids.find(href.slice(1)) : null;
}

function matrixScale(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

interface Walk {
  root: Element;
  ids: IdIndex;
  rules: Map<string, Record<string, string>>;
  items: Item[];
  skipped: number;
  depth: number;
}

function walk(element: Element, matrix: Matrix, inherited: Paint, state: Walk): void {
  if (state.depth > 64) return;
  const name = element.localName;
  if (IGNORED.has(name)) return;
  if (SKIPPED.has(name)) {
    state.skipped++;
    return;
  }
  const attrs = attributesOf(element);
  const own = ownDeclarations(name, attrs, state.rules);
  if (own.display === "none" || own.visibility === "hidden") return;
  const paint = paintOf(own, inherited);
  let local = multiply(matrix, parseTransform(attrs.transform ?? null));
  if (name === "use") {
    const target = referenced(attrs, state.ids);
    if (!target || target === element) return;
    local = multiply(local, [1, 0, 0, 1, attr(attrs, "x"), attr(attrs, "y")]);
    state.depth++;
    walk(target, local, paint, state);
    state.depth--;
    return;
  }
  if (SHAPES.has(name)) {
    const subpaths = pathToSubpaths(geometryOf(name, attrs));
    if (subpaths.length > 0) state.items.push({ local: subpaths, subpaths: mapSubpaths(subpaths, (p) => applyMatrix(local, p)), paint, scale: matrixScale(local) });
    return;
  }
  state.depth++;
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) walk(child, local, paint, state);
  state.depth--;
}

function frameOf(root: Element): { x: number; y: number; width: number; height: number } | null {
  const box = numbers(root.getAttribute("viewBox") ?? "");
  if (box.length === 4 && box[2] > 0 && box[3] > 0) return { x: box[0], y: box[1], width: box[2], height: box[3] };
  const width = parseFloat(root.getAttribute("width") ?? "");
  const height = parseFloat(root.getAttribute("height") ?? "");
  return width > 0 && height > 0 ? { x: 0, y: 0, width, height } : null;
}

function withAlpha(color: string, opacity: number): string {
  return opacity >= 1 ? color : `${color}${hex2(opacity * 255)}`;
}

function gradientOf(reference: string, ids: IdIndex, item: Item): Gradient | null {
  const id = /^url\(\s*#([^)\s]+)\s*\)$/.exec(reference.trim())?.[1];
  const element = id ? ids.find(id) : null;
  if (!element || (element.localName !== "linearGradient" && element.localName !== "radialGradient")) return null;
  const stops = Array.from(element.getElementsByTagName("stop")).flatMap((stop) => {
    const own = declarations(stop.getAttribute("style") ?? "");
    const color = parseColor(own["stop-color"] ?? stop.getAttribute("stop-color") ?? "#000000", item.paint.color);
    const opacity = fraction(own["stop-opacity"] ?? stop.getAttribute("stop-opacity") ?? undefined, 1);
    return color ? [withAlpha(color, opacity)] : [];
  });
  if (stops.length === 0) return null;
  const colors = { from: stops[0], to: stops[stops.length - 1], ...(stops.length > 2 ? { via: stops[Math.floor(stops.length / 2)] } : {}) };
  const user = element.getAttribute("gradientUnits") === "userSpaceOnUse";
  const bounds = pathBounds(item.local);
  const width = bounds.right - bounds.left || 1;
  const height = bounds.bottom - bounds.top || 1;
  const along = (name: string, fallback: number, axis: "x" | "y") => {
    const raw = element.getAttribute(name);
    if (raw === null) return fallback;
    const value = raw.trim().endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw);
    if (!Number.isFinite(value)) return fallback;
    return user ? (axis === "x" ? (value - bounds.left) / width : (value - bounds.top) / height) : value;
  };
  if (element.localName === "radialGradient") {
    const r = element.getAttribute("r");
    const radius = r === null ? 0.5 : user ? parseFloat(r) / Math.max(width, height) : fraction(r, 0.5);
    return { kind: "radial", ...colors, angle: 0, cx: Math.min(1, Math.max(0, along("cx", 0.5, "x"))), cy: Math.min(1, Math.max(0, along("cy", 0.5, "y"))), radius: Math.min(2, Math.max(0.05, radius * 2)) };
  }
  const x1 = along("x1", 0, "x");
  const y1 = along("y1", 0, "y");
  const x2 = along("x2", 1, "x");
  const y2 = along("y2", 0, "y");
  const angle = Math.round((Math.atan2((y2 - y1) * height, (x2 - x1) * width) * 180) / Math.PI);
  return { ...colors, angle: angle === -0 ? 0 : angle };
}

function strokeShape(paint: Paint): Partial<Layer> {
  const out: Partial<Layer> = {};
  out.lineCap = (LINE_CAPS as readonly string[]).includes(paint.lineCap) ? (paint.lineCap as LineCap) : "butt";
  out.lineJoin = (LINE_JOINS as readonly string[]).includes(paint.lineJoin) ? (paint.lineJoin as LineJoin) : "miter";
  if (out.lineJoin === "miter") out.miterLimit = Math.min(LAYER_RANGES.miterLimit[1], Math.max(LAYER_RANGES.miterLimit[0], paint.miterLimit));
  const unit = paint.strokeWidth > 0 ? paint.strokeWidth : 1;
  const dashes = paint.dashArray === "none" ? [] : numbers(paint.dashArray).map((v) => Math.min(LAYER_RANGES.dashValue[1], Math.max(0, Math.round((v / unit) * 1000) / 1000)));
  if (dashes.length > 0 && dashes.length <= MAX_DASH_VALUES && dashes.some((v) => v > 0)) {
    out.dashArray = dashes;
    const offset = Math.round((paint.dashOffset / unit) * 1000) / 1000;
    if (offset !== 0) out.dashOffset = Math.min(LAYER_RANGES.dashOffset[1], Math.max(LAYER_RANGES.dashOffset[0], offset));
  }
  return out;
}

function styled(layer: Layer, item: Item, ids: IdIndex, scale: number): Layer {
  const { paint } = item;
  const fillColor = paint.fill === "none" ? null : parseColor(paint.fill, paint.color);
  const gradient = paint.fill.startsWith("url(") ? gradientOf(paint.fill, ids, item) : null;
  const strokeColor = paint.stroke === "none" ? null : parseColor(paint.stroke, paint.color);
  const strokeWidth = strokeColor ? Math.min(200, Math.max(0, paint.strokeWidth * item.scale * scale)) : 0;
  const next: Layer = { ...layer, fill: undefined, stroke: undefined, strokeWidth: undefined, transform: { ...layer.transform, opacity: Math.min(1, Math.max(0, paint.opacity)) } };
  if (gradient) next.gradient = gradient;
  else if (fillColor) next.fill = withAlpha(fillColor, paint.fillOpacity);
  if (strokeColor && strokeWidth > 0) {
    next.stroke = withAlpha(strokeColor, paint.strokeOpacity);
    next.strokeWidth = Math.round(strokeWidth * 100) / 100;
    Object.assign(next, strokeShape(paint));
  }
  if (paint.fillRule === "evenodd") next.fillRule = "evenodd" as FillRule;
  return next;
}

export function importSvg(text: string, canvas: CanvasSize, options: { target?: SvgTarget; name?: string } = {}): SvgImportResult {
  let parsed: Document;
  try {
    parsed = new DOMParser().parseFromString(text, "image/svg+xml");
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const root = parsed.documentElement;
  if (!root || root.localName !== "svg" || parsed.getElementsByTagName("parsererror").length > 0) return { ok: false, reason: "invalid" };
  const state: Walk = { root, ids: new IdIndex(root), rules: stylesheet(root), items: [], skipped: 0, depth: 0 };
  const rootPaint = paintOf(ownDeclarations("svg", attributesOf(root), state.rules), DEFAULT_PAINT);
  for (let child = root.firstElementChild; child; child = child.nextElementSibling) walk(child, IDENTITY, rootPaint, state);
  if (state.items.length === 0) return { ok: false, reason: "empty" };
  const content = pathBounds(state.items.flatMap((item) => item.subpaths));
  const frame = frameOf(root) ?? { x: content.left, y: content.top, width: content.right - content.left || 1, height: content.bottom - content.top || 1 };
  const side = Math.min(canvas.width, canvas.height) * SVG_IMPORT_SHARE;
  const target = options.target ?? { center: { x: canvas.width / 2, y: canvas.height / 2 }, width: side, height: side, rotation: 0 };
  const scale = Math.min(target.width / frame.width, target.height / frame.height);
  const angle = (target.rotation * Math.PI) / 180;
  const toCanvas = (p: Point): Point => {
    const x = (p.x - frame.x - frame.width / 2) * scale;
    const y = (p.y - frame.y - frame.height / 2) * scale;
    return { x: target.center.x + x * Math.cos(angle) - y * Math.sin(angle), y: target.center.y + x * Math.sin(angle) + y * Math.cos(angle) };
  };
  const groupId = state.items.length > 1 ? newStudioId("g") : undefined;
  const layers = state.items.map((item) => {
    const open = item.paint.fill === "none";
    const layer = styled(pathLayerFromCanvas(mapSubpaths(item.subpaths, toCanvas), canvas, open), item, state.ids, scale);
    return groupId ? { ...layer, groupId } : layer;
  });
  const groups: StudioGroup[] = groupId ? [{ id: groupId, ...(options.name ? { name: options.name } : {}) }] : [];
  return { ok: true, value: { layers, groups, skipped: state.skipped } };
}

export function isSvgText(text: string): boolean {
  return /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text);
}

export type SvgImportOutcome = { ok: true; count: number; skipped: number } | { ok: false; reason: "invalid" | "empty" | "too_large" };
