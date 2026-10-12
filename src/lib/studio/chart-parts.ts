import { parseColor, luminance } from "./color";
import type { CanvasSize, Layer, TextAlign, Transform } from "./document";
import { nearestFontWeight } from "./fonts";
import { chartPercentText, chartValueText, isBarChart, isRoundChart, paletteColor, shownSeries, type ChartSpec } from "./chart";

export type ChartPartRole = "grid" | "axis" | "tick" | "bar" | "line" | "area" | "point" | "slice" | "value" | "legend";

export interface ChartPart {
  layer: Layer;
  role: ChartPartRole;
  series?: number;
  category?: number;
  base?: { axis: "x" | "y"; at: number };
  wedge?: { start: number; end: number };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Scale {
  low: number;
  high: number;
  step: number;
  ticks: number[];
}

const LABEL_WEIGHT = 400;
const VALUE_WEIGHT = 600;
const AXIS_OPACITY = 0.55;
const AREA_OPACITY = 0.4;
const STACKED_AREA_OPACITY = 0.85;
const TICK_TARGET = 5;
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;
const MIN_SIDE = 1e-4;
const LIGHT_TEXT = "#ffffff";
const DARK_TEXT = "#111111";
const MIN_LABELED_SLICE = 0.3;
const START_ANGLE = -Math.PI / 2;
const TAU = Math.PI * 2;

const CHAR_WIDTHS: [RegExp, number][] = [
  [/[il.,:;'|!ı]/, 0.28],
  [/[ ]/, 0.28],
  [/[fjrt()[\]/\\-]/, 0.36],
  [/[MW@%mw]/, 0.86],
  [/[A-Z]/, 0.66],
];

export function textWidth(text: string, px: number): number {
  let width = 0;
  for (const char of text) width += (CHAR_WIDTHS.find(([pattern]) => pattern.test(char))?.[1] ?? 0.56) * px;
  return width;
}

function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  return (NICE_STEPS.find((step) => step * power >= raw - 1e-12) ?? 10) * power;
}

export function niceScale(low: number, high: number, target: number = TICK_TARGET): Scale {
  const [from, to] = low === high ? (low === 0 ? [0, 1] : [Math.min(0, low), Math.max(0, high)]) : [low, high];
  const span = to - from || Math.abs(to) || 1;
  const step = niceStep(span / target);
  const first = Math.floor(from / step + 1e-9) * step;
  const last = Math.ceil(to / step - 1e-9) * step;
  const count = Math.max(1, Math.round((last - first) / step));
  const ticks = Array.from({ length: count + 1 }, (_, i) => Number((first + i * step).toPrecision(12)));
  return { low: ticks[0], high: ticks[ticks.length - 1], step, ticks };
}

function stepDecimals(step: number): number {
  for (let decimals = 0; decimals < 3; decimals++) if (Math.abs(Math.round(step * 10 ** decimals) - step * 10 ** decimals) < 1e-9) return decimals;
  return 3;
}

function contrastText(color: string): string {
  const rgba = parseColor(color);
  return rgba && luminance(rgba) > 0.45 ? DARK_TEXT : LIGHT_TEXT;
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

class Builder {
  readonly parts: ChartPart[] = [];
  readonly fontPx: number;
  readonly pad: number;
  readonly hair: number;

  constructor(
    readonly spec: ChartSpec,
    readonly size: CanvasSize,
  ) {
    this.fontPx = spec.style.fontSize * size.height;
    this.pad = this.fontPx * 0.6;
    this.hair = Math.max(1, size.height * 0.0025);
  }

  transform(rect: Rect, opacity = 1): Transform {
    const { width, height } = this.size;
    return { x: round((rect.x + rect.w / 2) / width), y: round((rect.y + rect.h / 2) / height), w: Math.max(MIN_SIDE, round(rect.w / width)), h: Math.max(MIN_SIDE, round(rect.h / height)), rotation: 0, opacity };
  }

  add(part: Omit<ChartPart, "layer">, layer: Omit<Layer, "id"> & { id: string }): void {
    this.parts.push({ ...part, layer: layer as Layer });
  }

  rect(id: string, rect: Rect, fill: string, part: Omit<ChartPart, "layer">, extra: Partial<Layer> = {}, opacity = 1): void {
    if (rect.w <= 0 || rect.h <= 0) return;
    this.add(part, { id, type: "shape", shape: "rect", fill, ...extra, transform: this.transform(rect, opacity) });
  }

  text(id: string, text: string, anchor: { x: number; y: number; align: TextAlign }, part: Omit<ChartPart, "layer">, options: { color?: string; weight?: number; scale?: number } = {}): void {
    if (text.trim() === "") return;
    const px = this.fontPx * (options.scale ?? 1);
    const w = textWidth(text, px) * 1.3 + px;
    const h = px * 1.45;
    const left = anchor.align === "left" ? anchor.x : anchor.align === "right" ? anchor.x - w : anchor.x - w / 2;
    const { style } = this.spec;
    this.add(part, {
      id,
      type: "text",
      text,
      transform: this.transform({ x: left, y: anchor.y - h / 2, w, h }),
      fontId: style.fontId,
      fontSize: (px / this.size.height) || style.fontSize,
      fontWeight: nearestFontWeight(style.fontId, options.weight ?? LABEL_WEIGHT),
      align: anchor.align,
      lineHeight: 1.2,
      fill: options.color ?? style.textColor,
    });
  }

  path(id: string, rect: Rect, data: string, paint: Partial<Layer>, part: Omit<ChartPart, "layer">, opacity = 1): void {
    if (rect.w <= 0 || rect.h <= 0 || data === "") return;
    this.add(part, { id, type: "shape", shape: "path", path: data, transform: this.transform(rect, opacity), ...paint });
  }
}

interface LegendEntry {
  name: string;
  color: string;
}

function legendEntries(spec: ChartSpec): LegendEntry[] {
  if (isRoundChart(spec.kind)) return spec.data.labels.map((name, i) => ({ name, color: paletteColor(spec.style, i) })).filter((entry) => entry.name.trim() !== "");
  return shownSeries(spec)
    .map((index, k) => ({ name: spec.data.series[index].name, color: paletteColor(spec.style, k) }))
    .filter((entry) => entry.name.trim() !== "");
}

function drawLegend(b: Builder, area: Rect): Rect {
  const { legend } = b.spec.style;
  const entries = legend === "none" ? [] : legendEntries(b.spec);
  if (entries.length === 0) return area;
  const px = b.fontPx;
  const swatch = px * 0.8;
  const gap = px * 0.4;
  const spacing = px * 1.2;
  const rowHeight = px * 1.5;
  const widths = entries.map((entry) => swatch + gap + textWidth(entry.name, px));
  const place = (entry: LegendEntry, index: number, x: number, y: number) => {
    b.rect(`legend-swatch-${index}`, { x, y: y - swatch / 2, w: swatch, h: swatch }, entry.color, { role: "legend" }, { radius: 0.3 });
    b.text(`legend-text-${index}`, entry.name, { x: x + swatch + gap, y, align: "left" }, { role: "legend" });
  };
  if (legend === "right") {
    const width = Math.min(area.w * 0.4, Math.max(...widths));
    const height = entries.length * rowHeight;
    const left = area.x + area.w - width;
    const top = area.y + Math.max(0, (area.h - height) / 2);
    entries.forEach((entry, i) => place(entry, i, left, top + rowHeight * (i + 0.5)));
    return { ...area, w: Math.max(MIN_SIDE, area.w - width - b.pad) };
  }
  const rows: number[][] = [[]];
  let used = 0;
  widths.forEach((width, i) => {
    const row = rows[rows.length - 1];
    const needed = row.length === 0 ? width : used + spacing + width;
    if (row.length > 0 && needed > area.w) {
      rows.push([i]);
      used = width;
    } else {
      row.push(i);
      used = needed;
    }
  });
  const height = rows.length * rowHeight;
  const top = legend === "top" ? area.y : area.y + area.h - height;
  rows.forEach((row, r) => {
    const total = row.reduce((sum, i, k) => sum + widths[i] + (k > 0 ? spacing : 0), 0);
    let x = area.x + (area.w - total) / 2;
    for (const i of row) {
      place(entries[i], i, x, top + rowHeight * (r + 0.5));
      x += widths[i] + spacing;
    }
  });
  return { x: area.x, y: legend === "top" ? area.y + height + b.pad * 0.5 : area.y, w: area.w, h: Math.max(MIN_SIDE, area.h - height - b.pad * 0.5) };
}

function pointAt(angle: number, radius: number): [number, number] {
  return [0.5 + radius * Math.cos(angle), 0.5 + radius * Math.sin(angle)];
}

function fmt(value: number): string {
  return String(Math.round(value * 1e4) / 1e4 || 0);
}

export function wedgePath(start: number, end: number, hole: number): string {
  const sweep = end - start;
  if (sweep <= 0) return "";
  const outer = 0.5;
  const inner = 0.5 * hole;
  if (sweep >= TAU - 1e-9) {
    const ring = `M0.5 0 A0.5 0.5 0 1 1 0.5 1 A0.5 0.5 0 1 1 0.5 0 Z`;
    return hole > 0 ? `${ring} M0.5 ${fmt(0.5 - inner)} A${fmt(inner)} ${fmt(inner)} 0 1 0 0.5 ${fmt(0.5 + inner)} A${fmt(inner)} ${fmt(inner)} 0 1 0 0.5 ${fmt(0.5 - inner)} Z` : ring;
  }
  const large = sweep > Math.PI ? 1 : 0;
  const [ox0, oy0] = pointAt(start, outer);
  const [ox1, oy1] = pointAt(end, outer);
  if (hole <= 0) return `M0.5 0.5 L${fmt(ox0)} ${fmt(oy0)} A0.5 0.5 0 ${large} 1 ${fmt(ox1)} ${fmt(oy1)} Z`;
  const [ix1, iy1] = pointAt(end, inner);
  const [ix0, iy0] = pointAt(start, inner);
  return `M${fmt(ox0)} ${fmt(oy0)} A0.5 0.5 0 ${large} 1 ${fmt(ox1)} ${fmt(oy1)} L${fmt(ix1)} ${fmt(iy1)} A${fmt(inner)} ${fmt(inner)} 0 ${large} 0 ${fmt(ix0)} ${fmt(iy0)} Z`;
}

function roundChart(b: Builder, area: Rect): void {
  const { spec } = b;
  const values = spec.data.labels.map((_, i) => Math.max(0, spec.data.series[0]?.values[i] ?? 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return;
  const radius = Math.max(MIN_SIDE, Math.min(area.w, area.h) / 2);
  const box: Rect = { x: area.x + area.w / 2 - radius, y: area.y + area.h / 2 - radius, w: radius * 2, h: radius * 2 };
  const hole = spec.kind === "donut" ? spec.style.hole : 0;
  let angle = START_ANGLE;
  values.forEach((value, i) => {
    if (value <= 0) return;
    const sweep = (value / total) * TAU;
    const color = paletteColor(spec.style, i);
    const full = sweep >= TAU - 1e-9;
    b.path(`slice-${i}`, box, wedgePath(angle, angle + sweep, hole), { fill: color, ...(full && hole > 0 ? { fillRule: "evenodd" as const } : {}) }, { role: "slice", category: i, wedge: { start: angle, end: angle + sweep } });
    if (spec.style.valueLabels && sweep >= MIN_LABELED_SLICE) {
      const middle = angle + sweep / 2;
      const reach = hole > 0 ? (0.5 + hole / 2) * radius : radius * 0.62;
      const text = spec.format.percent ? chartPercentText(value / total, spec.format) : chartValueText(value, spec.format);
      b.text(`value-0-${i}`, text, { x: box.x + radius + reach * Math.cos(middle), y: box.y + radius + reach * Math.sin(middle), align: "center" }, { role: "value", series: 0, category: i }, { color: contrastText(color), weight: VALUE_WEIGHT, scale: 0.9 });
    }
    angle += sweep;
  });
}

function stacks(spec: ChartSpec): boolean {
  return spec.kind === "barStacked" || spec.kind === "areaStacked";
}

function seriesValue(spec: ChartSpec, series: number, category: number): number | null {
  const value = spec.data.series[series]?.values[category];
  return value === null || value === undefined ? null : value;
}

function valueDomain(spec: ChartSpec): [number, number] {
  const shown = shownSeries(spec);
  if (stacks(spec)) {
    const sums = spec.data.labels.map((_, c) => shown.reduce((acc, s) => {
      const value = seriesValue(spec, s, c) ?? 0;
      return value >= 0 ? [acc[0] + value, acc[1]] : [acc[0], acc[1] + value];
    }, [0, 0]));
    return [Math.min(0, ...sums.map((sum) => sum[1])), Math.max(0, ...sums.map((sum) => sum[0]))];
  }
  const values = shown.flatMap((s) => spec.data.labels.map((_, c) => seriesValue(spec, s, c)).filter((v): v is number => v !== null));
  if (values.length === 0) return [0, 1];
  if (spec.kind === "scatter") return [Math.min(...values), Math.max(...values)];
  return [Math.min(0, ...values), Math.max(0, ...values)];
}

function xDomain(spec: ChartSpec): [number, number] {
  const values = (spec.data.series[0]?.values ?? []).filter((v): v is number => v !== null && v !== undefined);
  return values.length === 0 ? [0, 1] : [Math.min(...values), Math.max(...values)];
}

function tickTexts(spec: ChartSpec, scale: Scale): string[] {
  const decimals = Math.max(spec.format.decimals, stepDecimals(scale.step));
  return scale.ticks.map((tick) => chartValueText(tick, spec.format, decimals));
}

function valueText(spec: ChartSpec, value: number): string {
  return chartValueText(value, spec.format);
}

function labelStride(widths: readonly number[], band: number): number {
  const widest = Math.max(0, ...widths);
  return widest <= band * 0.95 || band <= 0 ? 1 : Math.ceil(widest / (band * 0.95));
}

function axisColor(spec: ChartSpec): string {
  return spec.style.textColor;
}

function horizontalBars(b: Builder, area: Rect): void {
  const { spec } = b;
  const px = b.fontPx;
  const n = spec.data.labels.length;
  const scale = niceScale(...valueDomain(spec));
  const ticks = tickTexts(spec, scale);
  const labelWidths = spec.data.labels.map((label) => textWidth(label, px));
  const labelRoom = spec.style.axes ? Math.min(area.w * 0.35, Math.max(0, ...labelWidths)) + b.pad * 0.6 : 0;
  const tickRoom = spec.style.axes ? px * 1.4 : 0;
  const valueRoom = spec.style.valueLabels ? Math.max(0, ...spec.data.labels.map((_, c) => textWidth(valueText(spec, seriesValue(spec, 0, c) ?? 0), px * 0.9))) + b.pad * 0.4 : px * 0.5;
  const plot: Rect = { x: area.x + labelRoom, y: area.y, w: Math.max(MIN_SIDE, area.w - labelRoom - valueRoom), h: Math.max(MIN_SIDE, area.h - tickRoom) };
  const xOf = (value: number) => plot.x + ((value - scale.low) / (scale.high - scale.low)) * plot.w;
  const zero = xOf(Math.min(scale.high, Math.max(scale.low, 0)));
  if (spec.style.gridlines) scale.ticks.forEach((tick, i) => b.rect(`grid-x-${i}`, { x: xOf(tick) - b.hair / 2, y: plot.y, w: b.hair, h: plot.h }, spec.style.gridColor, { role: "grid" }));
  if (spec.style.axes) {
    b.rect("axis-y", { x: zero - b.hair * 0.75, y: plot.y, w: b.hair * 1.5, h: plot.h }, axisColor(spec), { role: "axis" }, {}, AXIS_OPACITY);
    scale.ticks.forEach((tick, i) => b.text(`tick-x-${i}`, ticks[i], { x: xOf(tick), y: plot.y + plot.h + px * 0.75, align: "center" }, { role: "tick" }, { scale: 0.85 }));
  }
  const band = plot.h / Math.max(1, n);
  const thickness = band * (1 - spec.style.barGap);
  spec.data.labels.forEach((label, c) => {
    const center = plot.y + band * (c + 0.5);
    if (spec.style.axes) b.text(`label-y-${c}`, label, { x: plot.x - b.pad * 0.6, y: center, align: "right" }, { role: "tick", category: c });
    const value = seriesValue(spec, 0, c);
    if (value === null || value === 0) return;
    const end = xOf(value);
    const color = paletteColor(spec.style, 0);
    b.rect(`bar-0-${c}`, { x: Math.min(zero, end), y: center - thickness / 2, w: Math.abs(end - zero), h: thickness }, color, { role: "bar", series: 0, category: c, base: { axis: "x", at: round(zero / b.size.width) } }, { radius: spec.style.barRadius });
    if (spec.style.valueLabels) b.text(`value-0-${c}`, valueText(spec, value), { x: value >= 0 ? end + b.pad * 0.4 : end - b.pad * 0.4, y: center, align: value >= 0 ? "left" : "right" }, { role: "value", series: 0, category: c }, { weight: VALUE_WEIGHT, scale: 0.9 });
  });
}

interface Frame {
  plot: Rect;
  yOf: (value: number) => number;
  xOf: (category: number) => number;
  band: number;
  zero: number;
}

function smoothPath(points: readonly [number, number][]): string {
  if (points.length < 3) return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`).join(" ");
  let data = `M${fmt(points[0][0])} ${fmt(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    data += ` C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return data;
}

function runPath(points: readonly ([number, number] | null)[], smooth: boolean): string {
  const runs: [number, number][][] = [[]];
  for (const point of points) {
    if (point) runs[runs.length - 1].push(point);
    else if (runs[runs.length - 1].length > 0) runs.push([]);
  }
  return runs
    .filter((run) => run.length >= 2)
    .map((run) => (smooth ? smoothPath(run) : run.map(([x, y], i) => `${i === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`).join(" ")))
    .join(" ");
}

function unit(frame: Frame, x: number, y: number): [number, number] {
  return [(x - frame.plot.x) / frame.plot.w, (y - frame.plot.y) / frame.plot.h];
}

function lineSeries(b: Builder, frame: Frame, stacked: number[][] | null): void {
  const { spec } = b;
  const shown = shownSeries(spec);
  const areas = spec.kind === "area" || spec.kind === "areaStacked";
  const strokePx = spec.style.lineWidth * b.size.height;
  const radius = Math.max(strokePx * 1.4, 2);
  shown.forEach((s, k) => {
    const color = paletteColor(spec.style, k);
    const base = { axis: "y" as const, at: round(frame.zero / b.size.height) };
    const top = spec.data.labels.map((_, c) => {
      const value = stacked ? stacked[k + 1][c] : seriesValue(spec, s, c);
      return value === null ? null : unit(frame, frame.xOf(c), frame.yOf(value));
    });
    if (areas) {
      const floor = spec.data.labels.map((_, c) => unit(frame, frame.xOf(c), frame.yOf(stacked ? stacked[k][c] : 0)));
      const filled = top.map((point, c) => point ?? floor[c]);
      const outline = [...filled, ...[...floor].reverse()];
      const data = filled.length >= 2 ? `${outline.map(([x, y], i) => `${i === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`).join(" ")} Z` : "";
      b.path(`area-${s}`, frame.plot, data, { fill: color }, { role: "area", series: s, base }, stacked ? STACKED_AREA_OPACITY : AREA_OPACITY);
    }
    const line = runPath(areas ? top.map((point, c) => point ?? unit(frame, frame.xOf(c), frame.yOf(stacked ? stacked[k][c] : 0))) : top, spec.style.smooth && !areas);
    b.path(`line-${s}`, frame.plot, line, { stroke: color, strokeWidth: strokePx, lineCap: "round", lineJoin: "round" }, { role: "line", series: s, base });
    top.forEach((point, c) => {
      if (!point) return;
      const x = frame.plot.x + point[0] * frame.plot.w;
      const y = frame.plot.y + point[1] * frame.plot.h;
      if (spec.style.points) b.add({ role: "point", series: s, category: c, base }, { id: `point-${s}-${c}`, type: "shape", shape: "ellipse", transform: b.transform({ x: x - radius, y: y - radius, w: radius * 2, h: radius * 2 }), fill: color });
      const value = seriesValue(spec, s, c);
      if (spec.style.valueLabels && value !== null) b.text(`value-${s}-${c}`, valueText(spec, value), { x, y: y - radius - b.fontPx * 0.6, align: "center" }, { role: "value", series: s, category: c }, { weight: VALUE_WEIGHT, scale: 0.85 });
    });
  });
}

function barSeries(b: Builder, frame: Frame): void {
  const { spec } = b;
  const shown = shownSeries(spec);
  const width = frame.band * (1 - spec.style.barGap);
  const grouped = spec.kind === "barGrouped";
  const each = grouped ? width / Math.max(1, shown.length) : width;
  const base = { axis: "y" as const, at: round(frame.zero / b.size.height) };
  spec.data.labels.forEach((_, c) => {
    const center = frame.xOf(c);
    let up = 0;
    let down = 0;
    shown.forEach((s, k) => {
      const value = seriesValue(spec, s, c);
      if (value === null || value === 0) return;
      const color = paletteColor(spec.style, k);
      const left = grouped ? center - width / 2 + each * k : center - width / 2;
      const from = spec.kind === "barStacked" ? (value >= 0 ? up : down) : 0;
      const to = from + value;
      if (spec.kind === "barStacked") {
        if (value >= 0) up = to;
        else down = to;
      }
      const y0 = frame.yOf(from);
      const y1 = frame.yOf(to);
      const rect = { x: left, y: Math.min(y0, y1), w: each, h: Math.abs(y1 - y0) };
      b.rect(`bar-${s}-${c}`, rect, color, { role: "bar", series: s, category: c, base }, { radius: spec.style.barRadius });
      if (!spec.style.valueLabels) return;
      const inside = spec.kind === "barStacked";
      const y = inside ? rect.y + rect.h / 2 : value >= 0 ? rect.y - b.fontPx * 0.6 : rect.y + rect.h + b.fontPx * 0.6;
      b.text(`value-${s}-${c}`, valueText(spec, value), { x: left + each / 2, y, align: "center" }, { role: "value", series: s, category: c }, { weight: VALUE_WEIGHT, scale: 0.85, ...(inside ? { color: contrastText(color) } : {}) });
    });
  });
}

function stackedValues(spec: ChartSpec): number[][] {
  const shown = shownSeries(spec);
  const levels: number[][] = [spec.data.labels.map(() => 0)];
  shown.forEach((s) => levels.push(spec.data.labels.map((_, c) => levels[levels.length - 1][c] + (seriesValue(spec, s, c) ?? 0))));
  return levels;
}

function scatterSeries(b: Builder, plot: Rect, xScale: Scale, yOf: (value: number) => number): void {
  const { spec } = b;
  const xs = spec.data.series[0]?.values ?? [];
  const radius = Math.max(spec.style.lineWidth * b.size.height * 1.6, 2.5);
  const xOf = (value: number) => plot.x + ((value - xScale.low) / (xScale.high - xScale.low)) * plot.w;
  const base = { axis: "y" as const, at: round((plot.y + plot.h) / b.size.height) };
  shownSeries(spec).forEach((s, k) => {
    const color = paletteColor(spec.style, k);
    spec.data.labels.forEach((_, c) => {
      const x = xs[c];
      const y = seriesValue(spec, s, c);
      if (x === null || x === undefined || y === null) return;
      const cx = xOf(x);
      const cy = yOf(y);
      b.add({ role: "point", series: s, category: c, base }, { id: `point-${s}-${c}`, type: "shape", shape: "ellipse", transform: b.transform({ x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 }), fill: color });
      if (spec.style.valueLabels) b.text(`value-${s}-${c}`, spec.data.labels[c] || valueText(spec, y), { x: cx, y: cy - radius - b.fontPx * 0.6, align: "center" }, { role: "value", series: s, category: c }, { weight: VALUE_WEIGHT, scale: 0.8 });
    });
  });
}

function cartesian(b: Builder, area: Rect): void {
  const { spec } = b;
  if (spec.kind === "barHorizontal") return horizontalBars(b, area);
  const px = b.fontPx;
  const n = spec.data.labels.length;
  const scale = niceScale(...valueDomain(spec));
  const ticks = tickTexts(spec, scale);
  const scatter = spec.kind === "scatter";
  const xScale = scatter ? niceScale(...xDomain(spec)) : null;
  const tickRoom = spec.style.axes ? Math.max(0, ...ticks.map((text) => textWidth(text, px * 0.85))) + b.pad * 0.6 : 0;
  const labelRoom = spec.style.axes ? px * 1.5 : 0;
  const headroom = spec.style.valueLabels ? px * 1.2 : px * 0.4;
  const plot: Rect = { x: area.x + tickRoom, y: area.y + headroom, w: Math.max(MIN_SIDE, area.w - tickRoom - px * 0.3), h: Math.max(MIN_SIDE, area.h - labelRoom - headroom) };
  const yOf = (value: number) => plot.y + plot.h - ((value - scale.low) / (scale.high - scale.low)) * plot.h;
  const zero = yOf(Math.min(scale.high, Math.max(scale.low, 0)));
  if (spec.style.gridlines) {
    scale.ticks.forEach((tick, i) => b.rect(`grid-y-${i}`, { x: plot.x, y: yOf(tick) - b.hair / 2, w: plot.w, h: b.hair }, spec.style.gridColor, { role: "grid" }));
    if (xScale) xScale.ticks.forEach((tick, i) => b.rect(`grid-x-${i}`, { x: plot.x + ((tick - xScale.low) / (xScale.high - xScale.low)) * plot.w - b.hair / 2, y: plot.y, w: b.hair, h: plot.h }, spec.style.gridColor, { role: "grid" }));
  }
  const bars = isBarChart(spec.kind);
  const band = plot.w / Math.max(1, n);
  const xOf = (c: number) => (bars ? plot.x + band * (c + 0.5) : n <= 1 ? plot.x + plot.w / 2 : plot.x + (plot.w * c) / (n - 1));
  if (spec.style.axes) {
    const axisY = scatter ? plot.y + plot.h : zero;
    b.rect("axis-x", { x: plot.x, y: axisY - b.hair * 0.75, w: plot.w, h: b.hair * 1.5 }, axisColor(spec), { role: "axis" }, {}, AXIS_OPACITY);
    scale.ticks.forEach((tick, i) => b.text(`tick-y-${i}`, ticks[i], { x: plot.x - b.pad * 0.6, y: yOf(tick), align: "right" }, { role: "tick" }, { scale: 0.85 }));
    if (xScale) {
      const texts = tickTexts(spec, xScale);
      xScale.ticks.forEach((tick, i) => b.text(`tick-x-${i}`, texts[i], { x: plot.x + ((tick - xScale.low) / (xScale.high - xScale.low)) * plot.w, y: plot.y + plot.h + px * 0.8, align: "center" }, { role: "tick" }, { scale: 0.85 }));
    } else {
      const slot = bars ? band : n <= 1 ? plot.w : plot.w / (n - 1);
      const stride = labelStride(spec.data.labels.map((label) => textWidth(label, px)), slot);
      spec.data.labels.forEach((label, c) => {
        if (c % stride === 0) b.text(`label-x-${c}`, label, { x: xOf(c), y: plot.y + plot.h + px * 0.8, align: "center" }, { role: "tick", category: c });
      });
    }
  }
  const frame: Frame = { plot, yOf, xOf, band, zero };
  if (bars) barSeries(b, frame);
  else if (scatter && xScale) scatterSeries(b, plot, xScale, yOf);
  else lineSeries(b, frame, spec.kind === "areaStacked" ? stackedValues(spec) : null);
}

function ordered(parts: ChartPart[]): ChartPart[] {
  const rank: Record<ChartPartRole, number> = { grid: 0, axis: 1, area: 2, bar: 3, slice: 3, line: 4, point: 5, value: 6, tick: 7, legend: 8 };
  return parts.map((part, index) => ({ part, index })).sort((a, b) => rank[a.part.role] - rank[b.part.role] || a.index - b.index).map((entry) => entry.part);
}

const cache = new WeakMap<ChartSpec, { key: string; parts: ChartPart[] }>();

export function chartParts(spec: ChartSpec, size: CanvasSize): ChartPart[] {
  const key = `${Math.round(size.width * 100)}x${Math.round(size.height * 100)}`;
  const known = cache.get(spec);
  if (known && known.key === key) return known.parts;
  const b = new Builder(spec, size);
  const area: Rect = { x: b.pad * 0.5, y: b.pad * 0.5, w: Math.max(MIN_SIDE, size.width - b.pad), h: Math.max(MIN_SIDE, size.height - b.pad) };
  const plot = drawLegend(b, area);
  if (isRoundChart(spec.kind)) roundChart(b, plot);
  else cartesian(b, plot);
  const parts = ordered(b.parts);
  cache.set(spec, { key, parts });
  return parts;
}

export function chartPartLayers(spec: ChartSpec, size: CanvasSize): Layer[] {
  return chartParts(spec, size).map((part) => part.layer);
}
