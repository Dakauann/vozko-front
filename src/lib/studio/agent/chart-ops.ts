import {
  CHART_KINDS,
  CHART_LEGENDS,
  CHART_PALETTE,
  chartInk,
  chartIssue,
  isChartKind,
  minimumSeries,
  newChartSpec,
  withKind,
  type ChartData,
  type ChartFormat,
  type ChartKind,
  type ChartLegend,
  type ChartSpec,
  type ChartStyle,
} from "../chart";
import { CHART_ANIMATION_LIMITS, CHART_ANIMATION_ORDERS, CHART_ANIMATION_STYLES, chartAnimatorIssue, defaultChartAnimator, isChartAnimationOrder, isChartAnimationStyle, type ChartAnimator } from "../chart-animation";
import { isFontId } from "../fonts";
import { isEasing, type Easing } from "../keyframes";
import { counterLocaleFor, isCounterLocale } from "../locale-numbers";
import { issueText } from "./layer-style";
import { partSource } from "../components";
import type { ImageDocument } from "../document";

export const CHART_IMAGE_OPERATIONS = ["add_chart", "update_chart_data", "expand_chart"] as const;

export const CHART_VIDEO_OPERATIONS = ["add_chart", "update_chart_data", "animate_chart"] as const;

export type ChartImageOpName = (typeof CHART_IMAGE_OPERATIONS)[number];

export type ChartVideoOpName = (typeof CHART_VIDEO_OPERATIONS)[number];

export interface AgentChartSeries {
  name?: string;
  values?: (number | null)[];
}

export interface AgentChartStyle {
  palette?: string[];
  font_id?: string;
  font_size?: number;
  text_color?: string;
  grid_color?: string;
  axes?: boolean;
  gridlines?: boolean;
  legend?: string;
  value_labels?: boolean;
  bar_radius?: number;
  bar_gap?: number;
  line_width?: number;
  smooth?: boolean;
  points?: boolean;
  hole?: number;
}

export interface AgentChartFormat {
  locale?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  percent?: boolean;
}

export interface AgentChartFields {
  chart_kind?: string;
  chart_labels?: string[];
  chart_series?: AgentChartSeries[];
  chart_style?: AgentChartStyle;
  chart_format?: AgentChartFormat;
  chart_entrance?: string;
  chart_order?: string;
}

interface AgentChartTiming {
  duration_ms?: number;
  stagger_ms?: number;
  easing?: string;
}

interface ChartDefaults {
  locale: string;
  ink: string;
  palette?: readonly string[];
}

type Built<T> = { ok: true; value: T } | { ok: false; reason: string };

const DATA_HINT = "chart_labels traz o nome de cada categoria e chart_series traz uma série por item, com name e values (um número por categoria, null deixa vazio)";

function refuse<T>(reason: string): Built<T> {
  return { ok: false, reason };
}

export function isChartImageOperation(op: string): op is ChartImageOpName {
  return (CHART_IMAGE_OPERATIONS as readonly string[]).includes(op);
}

function kindOf(raw: string | undefined, fallback: ChartKind | null): Built<ChartKind> {
  if (raw === undefined) return fallback ? { ok: true, value: fallback } : refuse(`add_chart precisa de chart_kind: ${CHART_KINDS.join(", ")}`);
  return isChartKind(raw) ? { ok: true, value: raw } : refuse(`chart_kind precisa ser um de: ${CHART_KINDS.join(", ")}`);
}

function dataOf(fields: AgentChartFields, current: ChartData | null): Built<ChartData> {
  if (!current && (!fields.chart_labels || !fields.chart_series)) return refuse(`add_chart precisa dos dados: ${DATA_HINT}`);
  const labels = fields.chart_labels ?? current!.labels;
  const series = fields.chart_series ? fields.chart_series.map((entry) => ({ name: entry.name ?? "", values: entry.values ?? [] })) : current!.series;
  const short = series.find((entry) => entry.values.length !== labels.length);
  if (short) return refuse(`cada série precisa de ${labels.length} valores, um por categoria em chart_labels; a série ${short.name || "sem nome"} tem ${short.values.length}`);
  return { ok: true, value: { labels: [...labels], series: series.map((entry) => ({ name: entry.name, values: entry.values.map((value) => (value === undefined ? null : value)) })) } };
}

function styleOf(fields: AgentChartStyle | undefined, base: ChartStyle): Built<ChartStyle> {
  if (!fields) return { ok: true, value: base };
  if (fields.legend !== undefined && !(CHART_LEGENDS as readonly string[]).includes(fields.legend)) return refuse(`chart_style.legend precisa ser um de: ${CHART_LEGENDS.join(", ")}`);
  if (fields.font_id !== undefined && !isFontId(fields.font_id)) return refuse(`chart_style.font_id ${fields.font_id} não existe`);
  const pick = <K extends keyof ChartStyle>(value: ChartStyle[K] | undefined, key: K): Partial<ChartStyle> => (value === undefined ? {} : { [key]: value });
  return {
    ok: true,
    value: {
      ...base,
      ...pick(fields.palette, "palette"),
      ...pick(fields.font_id as ChartStyle["fontId"] | undefined, "fontId"),
      ...pick(fields.font_size, "fontSize"),
      ...pick(fields.text_color, "textColor"),
      ...pick(fields.grid_color, "gridColor"),
      ...pick(fields.axes, "axes"),
      ...pick(fields.gridlines, "gridlines"),
      ...pick(fields.legend as ChartLegend | undefined, "legend"),
      ...pick(fields.value_labels, "valueLabels"),
      ...pick(fields.bar_radius, "barRadius"),
      ...pick(fields.bar_gap, "barGap"),
      ...pick(fields.line_width, "lineWidth"),
      ...pick(fields.smooth, "smooth"),
      ...pick(fields.points, "points"),
      ...pick(fields.hole, "hole"),
    },
  };
}

function formatOf(fields: AgentChartFormat | undefined, base: ChartFormat): Built<ChartFormat> {
  if (!fields) return { ok: true, value: base };
  if (fields.locale !== undefined && !isCounterLocale(fields.locale)) return refuse("chart_format.locale precisa ser pt-BR, en-US, es-ES ou de-DE");
  const next: ChartFormat = { ...base, ...(fields.locale !== undefined && isCounterLocale(fields.locale) ? { locale: fields.locale } : {}), ...(fields.decimals !== undefined ? { decimals: fields.decimals } : {}), ...(fields.percent !== undefined ? { percent: fields.percent } : {}) };
  if (fields.prefix !== undefined) next.prefix = fields.prefix === "" ? undefined : fields.prefix;
  if (fields.suffix !== undefined) next.suffix = fields.suffix === "" ? undefined : fields.suffix;
  return { ok: true, value: next };
}

function checked(spec: ChartSpec): Built<ChartSpec> {
  if (spec.data.series.length < minimumSeries(spec.kind)) return refuse("scatter precisa de duas séries: a primeira dá o eixo x e as outras, os pontos");
  const code = chartIssue(spec);
  return code ? refuse(`o gráfico ficaria inválido: ${issueText(code)}`) : { ok: true, value: spec };
}

export function chartSpecFrom(fields: AgentChartFields, current: ChartSpec | null, defaults: ChartDefaults): Built<ChartSpec> {
  const kind = kindOf(fields.chart_kind, current?.kind ?? null);
  if (!kind.ok) return kind;
  const data = dataOf(fields, current?.data ?? null);
  if (!data.ok) return data;
  const base = current ? withKind({ ...current, data: data.value }, kind.value) : newChartSpec(kind.value, data.value, counterLocaleFor(defaults.locale), chartInk(defaults.ink), defaults.palette ?? CHART_PALETTE);
  const style = styleOf(fields.chart_style, base.style);
  if (!style.ok) return style;
  const format = formatOf(fields.chart_format, base.format);
  if (!format.ok) return format;
  return checked({ ...base, style: style.value, format: format.value });
}

export function chartPartRefusal(doc: ImageDocument, ids: readonly string[]): { ok: false; reason: string } | null {
  for (const id of ids) {
    const source = partSource(id);
    const owner = source ? doc.artboards.flatMap((artboard) => artboard.layers).find((layer) => layer.id === source.instanceId) : undefined;
    if (owner?.type === "chart") return { ok: false, reason: `${id} é parte do gráfico ${owner.id}; mude textos, cores e números com update_chart_data (chart_style, chart_format) ou transforme o gráfico em camadas comuns com expand_chart` };
  }
  return null;
}

export function chartChangeRequested(fields: AgentChartFields): boolean {
  return [fields.chart_kind, fields.chart_labels, fields.chart_series, fields.chart_style, fields.chart_format].some((value) => value !== undefined);
}

const NO_ENTRANCE = "none";

export function chartAnimatorFrom(fields: AgentChartFields & AgentChartTiming, current: ChartAnimator | undefined, kind: ChartKind): Built<ChartAnimator | null> {
  const entrance = fields.chart_entrance;
  if (entrance === undefined && !current) return refuse(`animate_chart precisa de chart_entrance: ${[...CHART_ANIMATION_STYLES, NO_ENTRANCE].join(", ")}`);
  if (entrance === NO_ENTRANCE) return { ok: true, value: null };
  if (entrance !== undefined && !isChartAnimationStyle(entrance)) return refuse(`chart_entrance precisa ser um de: ${[...CHART_ANIMATION_STYLES, NO_ENTRANCE].join(", ")}`);
  if (fields.chart_order !== undefined && !isChartAnimationOrder(fields.chart_order)) return refuse(`chart_order precisa ser um de: ${CHART_ANIMATION_ORDERS.join(", ")}`);
  if (fields.easing !== undefined && !isEasing(fields.easing)) return refuse(`easing ${fields.easing} não existe`);
  const style = entrance ?? current!.style;
  const base = current ? { ...current, style } : defaultChartAnimator(kind, style);
  const next: ChartAnimator = {
    ...base,
    ...(fields.chart_order !== undefined && isChartAnimationOrder(fields.chart_order) ? { order: fields.chart_order } : {}),
    ...(fields.duration_ms !== undefined ? { durationMs: Math.round(fields.duration_ms) } : {}),
    ...(fields.stagger_ms !== undefined ? { staggerMs: Math.round(fields.stagger_ms) } : {}),
    ...(fields.easing !== undefined ? { easing: fields.easing as Easing } : {}),
  };
  const code = chartAnimatorIssue(next);
  if (code === "out_of_range") return refuse(`duration_ms vai de ${CHART_ANIMATION_LIMITS.durationMs[0]} a ${CHART_ANIMATION_LIMITS.durationMs[1]} ms e stagger_ms de ${CHART_ANIMATION_LIMITS.staggerMs[0]} a ${CHART_ANIMATION_LIMITS.staggerMs[1]} ms`);
  return code ? refuse(`a animação do gráfico ficaria inválida: ${issueText(code)}`) : { ok: true, value: next };
}

export interface OutlineChart {
  kind: ChartKind;
  labels: string[];
  series: { name: string; values: (number | null)[] }[];
  style: {
    palette: string[];
    font_id: string;
    font_size: number;
    text_color: string;
    grid_color: string;
    axes: boolean;
    gridlines: boolean;
    legend: ChartLegend;
    value_labels: boolean;
    bar_radius: number;
    bar_gap: number;
    line_width: number;
    smooth: boolean;
    points: boolean;
    hole: number;
  };
  format: { locale: string; decimals: number; prefix?: string; suffix?: string; percent: boolean };
}

export function chartOutline(spec: ChartSpec): OutlineChart {
  const { style, format } = spec;
  return {
    kind: spec.kind,
    labels: spec.data.labels,
    series: spec.data.series.map((entry) => ({ name: entry.name, values: entry.values.map((value) => (value === undefined ? null : value)) })),
    style: {
      palette: style.palette,
      font_id: style.fontId,
      font_size: style.fontSize,
      text_color: style.textColor,
      grid_color: style.gridColor,
      axes: style.axes,
      gridlines: style.gridlines,
      legend: style.legend,
      value_labels: style.valueLabels,
      bar_radius: style.barRadius,
      bar_gap: style.barGap,
      line_width: style.lineWidth,
      smooth: style.smooth,
      points: style.points,
      hole: style.hole,
    },
    format: { locale: format.locale, decimals: format.decimals, ...(format.prefix ? { prefix: format.prefix } : {}), ...(format.suffix ? { suffix: format.suffix } : {}), percent: format.percent },
  };
}

export interface OutlineChartAnimation {
  entrance: ChartAnimator["style"];
  order: ChartAnimator["order"];
  duration_ms: number;
  stagger_ms: number;
  easing: string;
}

export function chartAnimationOutline(animator: ChartAnimator): OutlineChartAnimation {
  return { entrance: animator.style, order: animator.order, duration_ms: animator.durationMs, stagger_ms: animator.staggerMs, easing: animator.easing };
}
