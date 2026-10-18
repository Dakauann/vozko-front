import { parseColor } from "./color";
import type { CanvasSize, Layer, Transform } from "./document";
import { textAdvance } from "./font-metrics";
import { nearestFontWeight } from "./fonts";
import { columnShares, type TableSpec } from "./table";

interface TableLayout {
  fontPx: number;
  padPx: number;
  borderPx: number;
  columns: number[];
  rows: number[];
}

const FIT_ROUNDS = 8;
const WRAP_SLACK = 1.08;
const DECIMALS = 1e5;
const MIN_SIDE = 1e-4;

function round(value: number): number {
  return Math.round(value * DECIMALS) / DECIMALS;
}

function paragraphLines(paragraph: string, widthPx: number, fontPx: number, measure: (text: string) => number): number {
  let lines = 1;
  let used = 0;
  for (const piece of paragraph.split(/(\s+)/)) {
    if (piece === "") continue;
    const width = measure(piece) * fontPx * WRAP_SLACK;
    if (/^\s+$/.test(piece)) {
      used += width;
      continue;
    }
    if (used > 0 && used + width > widthPx) {
      lines += 1;
      used = 0;
    }
    if (width > widthPx) {
      const extra = Math.ceil(width / widthPx) - 1;
      lines += extra;
      used = width - extra * widthPx;
    } else used += width;
  }
  return lines;
}

export function wrappedLines(text: string, widthPx: number, fontPx: number, measure: (text: string) => number): number {
  const paragraphs = text.split("\n");
  if (widthPx <= 0) return paragraphs.length;
  return paragraphs.reduce((total, paragraph) => total + paragraphLines(paragraph, widthPx, fontPx, measure), 0);
}

function cellWeight(spec: TableSpec, row: number): number {
  return spec.header && row === 0 ? spec.style.headerWeight : spec.style.weight;
}

function naturalRows(spec: TableSpec, columns: readonly number[], fontPx: number): number[] {
  const { style } = spec;
  const padPx = style.padding * fontPx;
  return spec.rows.map((row, r) => {
    const weight = cellWeight(spec, r);
    const measure = (text: string) => textAdvance(text, style.fontId, weight);
    const lines = Math.max(1, ...row.map((cell, c) => wrappedLines(cell.text, columns[c] - padPx * 2, fontPx, measure)));
    return lines * style.lineHeight * fontPx + padPx * 2;
  });
}

export function tableLayout(spec: TableSpec, size: CanvasSize): TableLayout {
  const columns = columnShares(spec.columns).map((share) => share * size.width);
  let fontPx = spec.style.fontSize * size.height;
  let rows = naturalRows(spec, columns, fontPx);
  for (let pass = 0; pass < FIT_ROUNDS; pass++) {
    const total = rows.reduce((sum, height) => sum + height, 0);
    if (total <= size.height + 1e-6) break;
    fontPx *= size.height / total;
    rows = naturalRows(spec, columns, fontPx);
  }
  const total = rows.reduce((sum, height) => sum + height, 0);
  const fitted = total > size.height ? rows.map((height) => (height * size.height) / total) : rows.map((height) => height + (size.height - total) / rows.length);
  return { fontPx, padPx: spec.style.padding * fontPx, borderPx: spec.style.borderWidth * size.height, columns, rows: fitted };
}

function edges(lengths: readonly number[]): number[] {
  const result = [0];
  for (const length of lengths) result.push(result[result.length - 1] + length);
  return result;
}

function shows(color: string): boolean {
  return (parseColor(color)?.a ?? 0) > 0;
}

class Parts {
  readonly layers: Layer[] = [];

  constructor(readonly size: CanvasSize) {}

  transform(left: number, top: number, width: number, height: number): Transform {
    return {
      x: round((left + width / 2) / this.size.width),
      y: round((top + height / 2) / this.size.height),
      w: Math.max(MIN_SIDE, round(width / this.size.width)),
      h: Math.max(MIN_SIDE, round(height / this.size.height)),
      rotation: 0,
      opacity: 1,
    };
  }

  rect(id: string, left: number, top: number, width: number, height: number, fill: string): void {
    if (width <= 0 || height <= 0 || !shows(fill)) return;
    this.layers.push({ id, type: "shape", shape: "rect", fill, transform: this.transform(left, top, width, height) });
  }
}

function horizontalBorders(spec: TableSpec, count: number): number[] {
  const all = Array.from({ length: count + 1 }, (_, k) => k);
  switch (spec.style.borders) {
    case "all":
    case "rows":
      return all;
    case "outer":
      return [0, count];
    case "none":
      return [];
  }
}

function verticalBorders(spec: TableSpec, count: number): number[] {
  switch (spec.style.borders) {
    case "all":
      return Array.from({ length: count + 1 }, (_, k) => k);
    case "rows":
    case "outer":
      return [0, count];
    case "none":
      return [];
  }
}

function lineSpan(at: number, edge: number, thickness: number): [number, number] {
  if (at <= 0) return [0, thickness];
  if (at >= edge - 1e-6) return [edge - thickness, thickness];
  return [at - thickness / 2, thickness];
}

const cache = new WeakMap<TableSpec, { key: string; layers: Layer[] }>();

export function tablePartLayers(spec: TableSpec, size: CanvasSize): Layer[] {
  const key = `${Math.round(size.width * 100)}x${Math.round(size.height * 100)}`;
  const known = cache.get(spec);
  if (known && known.key === key) return known.layers;
  const layers = drawnTablePartLayers(spec, size);
  cache.set(spec, { key, layers });
  return layers;
}

function drawnTablePartLayers(spec: TableSpec, size: CanvasSize): Layer[] {
  const layout = tableLayout(spec, size);
  const { style } = spec;
  const xs = edges(layout.columns);
  const ys = edges(layout.rows);
  const parts = new Parts(size);
  parts.rect("fill", 0, 0, size.width, size.height, style.fill);
  if (spec.header) parts.rect("header-fill", 0, 0, size.width, layout.rows[0], style.headerFill);
  if (style.banding) {
    spec.rows.forEach((_, r) => {
      const body = spec.header ? r - 1 : r;
      if (body >= 0 && body % 2 === 1) parts.rect(`band-${r}`, 0, ys[r], size.width, layout.rows[r], style.bandFill);
    });
  }
  if (layout.borderPx > 0) {
    for (const k of horizontalBorders(spec, spec.rows.length)) {
      const [top, height] = lineSpan(ys[k], size.height, layout.borderPx);
      parts.rect(`border-h-${k}`, 0, top, size.width, height, style.borderColor);
    }
    for (const k of verticalBorders(spec, spec.columns.length)) {
      const [left, width] = lineSpan(xs[k], size.width, layout.borderPx);
      parts.rect(`border-v-${k}`, left, 0, width, size.height, style.borderColor);
    }
  }
  spec.rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell.text.trim() === "") return;
      const header = spec.header && r === 0;
      const width = Math.max(MIN_SIDE, layout.columns[c] - layout.padPx * 2);
      const height = Math.max(MIN_SIDE, layout.rows[r] - layout.padPx * 2);
      parts.layers.push({
        id: `cell-${r}-${c}`,
        type: "text",
        text: cell.text,
        ...(cell.runs && cell.runs.length > 0 ? { runs: cell.runs } : {}),
        fontId: style.fontId,
        fontSize: layout.fontPx / size.height,
        fontWeight: nearestFontWeight(style.fontId, cellWeight(spec, r)),
        align: spec.columns[c].align,
        lineHeight: style.lineHeight,
        fill: header ? style.headerText : style.textColor,
        transform: parts.transform(xs[c] + layout.padPx, ys[r] + layout.padPx, width, height),
      });
    }),
  );
  return parts.layers;
}

export function tableCellAt(spec: TableSpec, size: CanvasSize, x: number, y: number): { row: number; column: number } | null {
  if (x < 0 || y < 0 || x > size.width || y > size.height) return null;
  const layout = tableLayout(spec, size);
  const xs = edges(layout.columns);
  const ys = edges(layout.rows);
  const column = Math.min(spec.columns.length - 1, Math.max(0, xs.findIndex((edge, i) => i > 0 && x <= edge) - 1));
  const row = Math.min(spec.rows.length - 1, Math.max(0, ys.findIndex((edge, i) => i > 0 && y <= edge) - 1));
  return { row, column };
}
