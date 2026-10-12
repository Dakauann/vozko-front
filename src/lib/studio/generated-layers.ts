import { chartPartLayers } from "./chart-parts";
import type { CanvasSize, Layer, LayerType } from "./document";
import { qrPartLayers } from "./qr-parts";
import { tablePartLayers } from "./table-parts";
import type { TableSpec } from "./table";

export const GENERATED_LAYER_TYPES = ["chart", "table", "qr"] as const satisfies readonly LayerType[];

export type GeneratedLayerType = (typeof GENERATED_LAYER_TYPES)[number];

export function isGeneratedLayer(layer: Pick<Layer, "type">): boolean {
  return (GENERATED_LAYER_TYPES as readonly string[]).includes(layer.type);
}

export function generatedPartLayers(layer: Layer, size: CanvasSize): Layer[] {
  switch (layer.type) {
    case "chart":
      return layer.chart ? chartPartLayers(layer.chart, size) : [];
    case "table":
      return layer.table ? tablePartLayers(layer.table, size) : [];
    case "qr":
      return layer.qr ? qrPartLayers(layer.qr, size) : [];
    default:
      return [];
  }
}

export type ColorSwap = (color: string) => string;

function tableColors(spec: TableSpec): string[] {
  const { style } = spec;
  return [style.textColor, style.fill, style.headerFill, style.headerText, style.bandFill, style.borderColor, ...spec.rows.flatMap((row) => row.flatMap((cell) => (cell.runs ?? []).flatMap((run) => (run.fill ? [run.fill] : []))))];
}

export function generatedColors(layer: Layer): string[] {
  if (layer.chart) return [...layer.chart.style.palette, layer.chart.style.textColor, layer.chart.style.gridColor];
  if (layer.table) return tableColors(layer.table);
  if (layer.qr) return [layer.qr.dark, layer.qr.light];
  return [];
}

function recoloredTable(spec: TableSpec, swap: ColorSwap): TableSpec {
  const { style } = spec;
  return {
    ...spec,
    rows: spec.rows.map((row) => row.map((cell) => (cell.runs ? { ...cell, runs: cell.runs.map((run) => (run.fill ? { ...run, fill: swap(run.fill) } : run)) } : cell))),
    style: { ...style, textColor: swap(style.textColor), fill: swap(style.fill), headerFill: swap(style.headerFill), headerText: swap(style.headerText), bandFill: swap(style.bandFill), borderColor: swap(style.borderColor) },
  };
}

export function recoloredGenerated(layer: Layer, swap: ColorSwap): Partial<Layer> {
  if (layer.chart) return { chart: { ...layer.chart, style: { ...layer.chart.style, palette: layer.chart.style.palette.map(swap), textColor: swap(layer.chart.style.textColor), gridColor: swap(layer.chart.style.gridColor) } } };
  if (layer.table) return { table: recoloredTable(layer.table, swap) };
  if (layer.qr) return { qr: { ...layer.qr, dark: swap(layer.qr.dark), light: swap(layer.qr.light) } };
  return {};
}
