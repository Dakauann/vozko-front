import type { CellGrid } from "./data-grid";
import type { Layer } from "./document";
import { COUNTER_LIMITS, counterSeparators, formatCounterNumber, isCounterLocale, plainTextIssue, type CounterLocale } from "./locale-numbers";
import { DEFAULT_FONT_ID, isFontId, type FontId } from "./fonts";
import type { StudioStyle } from "./shared-styles";
import { COUNTER_RANGE } from "./text-properties";
import type { IssueCode } from "./validate";

export const CHART_KINDS = ["bar", "barHorizontal", "barGrouped", "barStacked", "line", "lineMulti", "area", "areaStacked", "pie", "donut", "scatter"] as const;

export type ChartKind = (typeof CHART_KINDS)[number];

export const CHART_LEGENDS = ["none", "top", "bottom", "right"] as const;

export type ChartLegend = (typeof CHART_LEGENDS)[number];

export const CHART_LIMITS = {
  fontSize: [0.02, 0.2],
  lineWidth: [0.001, 0.05],
  barRadius: [0, 1],
  barGap: [0, 0.9],
  hole: [0.1, 0.9],
  value: COUNTER_RANGE,
  decimals: COUNTER_LIMITS.decimals,
  affixRunes: COUNTER_LIMITS.affixRunes,
  labelRunes: 200,
  nameRunes: 120,
} as const;

export const CHART_PALETTE = ["#2563eb", "#f97316", "#10b981", "#e11d48", "#8b5cf6", "#eab308", "#06b6d4", "#64748b"] as const;

export interface ChartSeries {
  name: string;
  values: (number | null)[];
}

export interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

export interface ChartStyle {
  palette: string[];
  fontId: FontId;
  fontSize: number;
  textColor: string;
  gridColor: string;
  axes: boolean;
  gridlines: boolean;
  legend: ChartLegend;
  valueLabels: boolean;
  barRadius: number;
  barGap: number;
  lineWidth: number;
  smooth: boolean;
  points: boolean;
  hole: number;
}

export interface ChartFormat {
  locale: CounterLocale;
  decimals: number;
  prefix?: string;
  suffix?: string;
  percent: boolean;
}

export interface ChartSpec {
  kind: ChartKind;
  data: ChartData;
  style: ChartStyle;
  format: ChartFormat;
}

export const CHART_LAYER_FIELDS: readonly string[] = ["id", "type", "name", "transform", "hidden", "locked", "groupId", "chart", "layoutItem"];

const ROUND_KINDS: ReadonlySet<ChartKind> = new Set(["pie", "donut"]);
const SINGLE_KINDS: ReadonlySet<ChartKind> = new Set(["bar", "barHorizontal", "line", "area", "pie", "donut"]);
const BAR_KINDS: ReadonlySet<ChartKind> = new Set(["bar", "barHorizontal", "barGrouped", "barStacked"]);
const LINE_KINDS: ReadonlySet<ChartKind> = new Set(["line", "lineMulti", "area", "areaStacked", "scatter"]);

export function isChartKind(value: unknown): value is ChartKind {
  return typeof value === "string" && (CHART_KINDS as readonly string[]).includes(value);
}

export function isRoundChart(kind: ChartKind): boolean {
  return ROUND_KINDS.has(kind);
}

export function isBarChart(kind: ChartKind): boolean {
  return BAR_KINDS.has(kind);
}

export function drawsLines(kind: ChartKind): boolean {
  return LINE_KINDS.has(kind);
}

export function usesOneSeries(kind: ChartKind): boolean {
  return SINGLE_KINDS.has(kind);
}

export function shownSeries(spec: Pick<ChartSpec, "kind" | "data">): number[] {
  const all = spec.data.series.map((_, index) => index);
  if (spec.kind === "scatter") return all.slice(1);
  return usesOneSeries(spec.kind) ? all.slice(0, 1) : all;
}

export function minimumSeries(kind: ChartKind): number {
  return kind === "scatter" ? 2 : 1;
}

export function isChartLayer(layer: Pick<Layer, "type">): boolean {
  return layer.type === "chart";
}

export function paletteColor(style: Pick<ChartStyle, "palette">, index: number): string {
  const palette = style.palette.length > 0 ? style.palette : CHART_PALETTE;
  return palette[((index % palette.length) + palette.length) % palette.length];
}

export function nextPaletteColor(palette: readonly string[]): string {
  return CHART_PALETTE.find((color) => !palette.includes(color)) ?? CHART_PALETTE[palette.length % CHART_PALETTE.length];
}

export function stylePalette(styles: readonly StudioStyle[] | undefined): string[] {
  const own = (styles ?? []).flatMap((style) => (style.kind === "color" && style.color ? [style.color.toLowerCase()] : []));
  const unique = [...new Set(own)];
  return unique.length === 0 ? [...CHART_PALETTE] : [...unique, ...CHART_PALETTE.filter((color) => !unique.includes(color))];
}

export function withStylePalette(layer: Layer, styles: readonly StudioStyle[] | undefined): Layer {
  if (!layer.chart || !(styles ?? []).some((style) => style.kind === "color" && style.color)) return layer;
  return { ...layer, chart: { ...layer.chart, style: { ...layer.chart.style, palette: stylePalette(styles) } } };
}

export interface ChartInk {
  text: string;
  grid: string;
}

const GRID_ALPHA = "33";

export function chartInk(ink: string): ChartInk {
  return { text: ink, grid: `${ink.slice(0, 7)}${GRID_ALPHA}` };
}

export function newChartStyle(ink: ChartInk, palette: readonly string[] = CHART_PALETTE): ChartStyle {
  return {
    palette: [...palette],
    fontId: DEFAULT_FONT_ID,
    fontSize: 0.05,
    textColor: ink.text,
    gridColor: ink.grid,
    axes: true,
    gridlines: true,
    legend: "bottom",
    valueLabels: false,
    barRadius: 0,
    barGap: 0.3,
    lineWidth: 0.008,
    smooth: false,
    points: true,
    hole: 0.55,
  };
}

function kindDefaults(kind: ChartKind, seriesCount: number): { legend: ChartLegend; valueLabels: boolean; percent: boolean } {
  const round = isRoundChart(kind);
  return { legend: round ? "right" : seriesCount > 1 ? "bottom" : "none", valueLabels: round, percent: round };
}

export function newChartSpec(kind: ChartKind, data: ChartData, locale: CounterLocale, ink: ChartInk, palette?: readonly string[]): ChartSpec {
  const { legend, valueLabels, percent } = kindDefaults(kind, data.series.length);
  return { kind, data, style: { ...newChartStyle(ink, palette), legend, valueLabels }, format: { locale, decimals: 0, percent } };
}

export function withKind(spec: ChartSpec, kind: ChartKind): ChartSpec {
  if (isRoundChart(kind) === isRoundChart(spec.kind)) return { ...spec, kind };
  const { legend, valueLabels, percent } = kindDefaults(kind, spec.data.series.length);
  return { ...spec, kind, style: { ...spec.style, legend, valueLabels }, format: { ...spec.format, percent } };
}

function within(value: unknown, [low, high]: readonly [number, number]): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= low && value <= high;
}

function colorValid(value: unknown, alpha: boolean): boolean {
  return typeof value === "string" && (alpha ? /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/ : /^#[0-9a-fA-F]{6}$/).test(value);
}

function cellValid(value: unknown): boolean {
  return value === null || value === undefined || within(value, CHART_LIMITS.value);
}

function dataIssue(kind: ChartKind, data: ChartData): IssueCode | null {
  if (data.labels.length === 0 || data.series.length < minimumSeries(kind)) return "required";
  for (const label of data.labels) {
    const code = plainTextIssue(label, CHART_LIMITS.labelRunes);
    if (code) return code;
  }
  for (const series of data.series) {
    const code = plainTextIssue(series.name, CHART_LIMITS.nameRunes);
    if (code) return code;
    if (series.values.length !== data.labels.length) return "invalid";
    if (!series.values.every(cellValid)) return "out_of_range";
  }
  return null;
}

function styleIssue(style: ChartStyle): IssueCode | null {
  if (style.palette.length === 0 || !style.palette.every((color) => colorValid(color, true))) return "invalid";
  if (!isFontId(style.fontId)) return "unknown";
  if (!colorValid(style.textColor, true) || !colorValid(style.gridColor, true)) return "invalid";
  if (!(CHART_LEGENDS as readonly string[]).includes(style.legend)) return "unknown";
  const ranged =
    within(style.fontSize, CHART_LIMITS.fontSize) &&
    within(style.barRadius, CHART_LIMITS.barRadius) &&
    within(style.barGap, CHART_LIMITS.barGap) &&
    within(style.lineWidth, CHART_LIMITS.lineWidth) &&
    within(style.hole, CHART_LIMITS.hole);
  return ranged ? null : "out_of_range";
}

function formatIssue(format: ChartFormat): IssueCode | null {
  if (!isCounterLocale(format.locale)) return "unknown";
  if (!Number.isInteger(format.decimals)) return "invalid";
  if (!within(format.decimals, CHART_LIMITS.decimals)) return "out_of_range";
  return plainTextIssue(format.prefix, CHART_LIMITS.affixRunes) ?? plainTextIssue(format.suffix, CHART_LIMITS.affixRunes);
}

export function chartIssue(spec: ChartSpec | undefined): IssueCode | null {
  if (!spec) return "required";
  if (!isChartKind(spec.kind)) return "unknown";
  return dataIssue(spec.kind, spec.data) ?? styleIssue(spec.style) ?? formatIssue(spec.format);
}

function isZero(value: unknown): boolean {
  return value === undefined || value === "" || value === false || value === 0 || (Array.isArray(value) && value.length === 0);
}

export function chartLayerIssue(layer: Layer): IssueCode | null {
  if (Object.entries(layer).some(([key, value]) => !CHART_LAYER_FIELDS.includes(key) && !isZero(value))) return "invalid";
  return chartIssue(layer.chart);
}

export function formatChartNumber(value: number, format: ChartFormat, decimals: number = format.decimals): string {
  return formatCounterNumber(value, decimals, format.locale, true);
}

export function chartValueText(value: number, format: ChartFormat, decimals?: number): string {
  return `${format.prefix ?? ""}${formatChartNumber(value, format, decimals)}${format.suffix ?? ""}`;
}

export function chartPercentText(share: number, format: ChartFormat): string {
  return `${formatChartNumber(share * 100, format)}%`;
}

export type ChartGrid = CellGrid;

export function plainNumberText(value: number | null | undefined, locale: CounterLocale): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(".", counterSeparators(locale).decimal);
}

export function gridOf(data: ChartData, locale: CounterLocale): ChartGrid {
  return [["", ...data.series.map((series) => series.name)], ...data.labels.map((label, row) => [label, ...data.series.map((series) => plainNumberText(series.values[row], locale))])];
}

const NUMBER_NOISE = /[^\d.,\-]/g;

function decimalMarkOf(cleaned: string, locale: CounterLocale): string | null {
  const commas = cleaned.split(",").length - 1;
  const dots = cleaned.split(".").length - 1;
  if (commas > 0 && dots > 0) return cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
  const mark = commas > 0 ? "," : dots > 0 ? "." : null;
  if (!mark || commas + dots > 1) return null;
  if (mark === counterSeparators(locale).decimal) return mark;
  return /^-?\d{1,3}[.,]\d{3}$/.test(cleaned) ? null : mark;
}

export function parseChartNumber(raw: string, locale: CounterLocale): number | null {
  const text = raw.trim();
  const cleaned = text.replace(NUMBER_NOISE, "");
  if (!/\d/.test(cleaned)) return null;
  const mark = decimalMarkOf(cleaned, locale);
  const at = mark ? cleaned.lastIndexOf(mark) : -1;
  const whole = (at >= 0 ? cleaned.slice(0, at) : cleaned).replace(/[.,]/g, "");
  const fraction = at >= 0 ? cleaned.slice(at + 1).replace(/[.,]/g, "") : "";
  const value = Number(fraction === "" ? whole : `${whole}.${fraction}`);
  if (!Number.isFinite(value)) return null;
  const signed = /^\(.*\)$/.test(text) ? -Math.abs(value) : value;
  return Math.min(CHART_LIMITS.value[1], Math.max(CHART_LIMITS.value[0], signed));
}

export function dataOfGrid(grid: ChartGrid, locale: CounterLocale): ChartData {
  const width = Math.max(0, ...grid.map((row) => row.length));
  const header = grid[0] ?? [];
  const body = grid.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
  const series = Array.from({ length: Math.max(0, width - 1) }, (_, column) => ({
    name: (header[column + 1] ?? "").trim(),
    values: body.map((row) => parseChartNumber(row[column + 1] ?? "", locale)),
  })).filter((entry, column) => entry.name !== "" || body.some((row) => (row[column + 1] ?? "").trim() !== ""));
  return { labels: body.map((row) => (row[0] ?? "").trim()), series };
}

export { delimiterOf, gridColumns, insertColumn, insertRow, parseDelimited, pasteCells, removeColumn, removeRow, setCell, type GridCell } from "./data-grid";
