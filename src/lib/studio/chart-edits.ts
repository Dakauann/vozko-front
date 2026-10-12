import { isRoundChart, type ChartKind, type ChartSpec } from "./chart";
import { detachedParts, replaceInstance } from "./component-edits";
import { generatedBoard } from "./components";
import { newStudioId, type CanvasSize, type ImageSurface, type Layer, type Transform } from "./document";
import { squareTransform } from "./geometry";

export const CHART_SHARE = 0.7;

export function chartRatio(kind: ChartKind): number {
  return isRoundChart(kind) ? 1.3 : 1.6;
}

export function chartTransform(canvas: CanvasSize, kind: ChartKind, share: number = CHART_SHARE): Transform {
  return squareTransform(canvas, share, share / chartRatio(kind));
}

export function newChartLayer(spec: ChartSpec, transform: Transform, name?: string): Layer {
  return { id: newStudioId("l"), type: "chart", ...(name ? { name } : {}), transform, chart: spec };
}

export type ExpandedChart = { ok: true; document: ImageSurface; groupId: string; ids: string[] } | { ok: false; reason: "missing" | "locked" };

export function expandChart(surface: ImageSurface, layerId: string): ExpandedChart {
  const layer = surface.layers.find((candidate) => candidate.id === layerId);
  if (!layer || layer.type !== "chart" || !layer.chart) return { ok: false, reason: "missing" };
  if (layer.locked) return { ok: false, reason: "locked" };
  const parts = detachedParts(generatedBoard(layer, surface.canvas), layer, surface.canvas);
  return { ok: true, document: replaceInstance(surface, layer.id, parts.layers, parts.group), groupId: parts.group.id, ids: parts.layers.map((part) => part.id) };
}
