import { boxCorners } from "../arrange";
import { contrastRatio, parseColor, type Rgba } from "../color";
import { convexIntersection, type Point } from "../convex";
import type { CanvasSize, ImageSurface, Layer, Transform } from "../document";
import { visibleLayers } from "../image-edits";
import { neededContrast, outlineInk, paintOf, snippet } from "./design-check";

export interface PixelGrid {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface BackdropContrast {
  low: number;
  typical: number;
}

const LOW_SHARE = 0.1;
const MAX_SAMPLES = 4000;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function pixelRange(start: number, end: number, size: number): [number, number] {
  return [Math.max(0, Math.floor(start * size)), Math.min(size, Math.ceil(end * size))];
}

export function unitCorners(transform: Transform, canvas: CanvasSize): Point[] {
  return boxCorners(transform, canvas).map(([x, y]): Point => [x / canvas.width, y / canvas.height]);
}

function touches(grid: PixelGrid, x: number, y: number, region: readonly Point[]): boolean {
  const [left, right, top, bottom] = [x / grid.width, (x + 1) / grid.width, y / grid.height, (y + 1) / grid.height];
  const cell: Point[] = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
  return convexIntersection(cell, region).length > 0;
}

export function backdropContrast(grid: PixelGrid, region: readonly Point[], ink: Rgba, outline: Rgba | null): BackdropContrast | null {
  const xs = region.map(([x]) => x);
  const ys = region.map(([, y]) => y);
  const [x0, x1] = pixelRange(Math.min(...xs), Math.max(...xs), grid.width);
  const [y0, y1] = pixelRange(Math.min(...ys), Math.max(...ys), grid.height);
  const count = (x1 - x0) * (y1 - y0);
  if (x1 <= x0 || y1 <= y0) return null;
  const step = Math.max(1, Math.ceil(Math.sqrt(count / MAX_SAMPLES)));
  const ratios: number[] = [];
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      if (!touches(grid, x, y, region)) continue;
      const i = (y * grid.width + x) * 4;
      const ground = { r: grid.data[i], g: grid.data[i + 1], b: grid.data[i + 2], a: 1 };
      ratios.push(Math.max(contrastRatio(ink, ground), outline ? contrastRatio(outline, ground) : 0));
    }
  }
  if (ratios.length === 0) return null;
  ratios.sort((a, b) => a - b);
  const at = (share: number) => ratios[Math.min(ratios.length - 1, Math.floor(share * ratios.length))];
  return { low: round(at(LOW_SHARE)), typical: round(at(0.5)) };
}

function measurable(layer: Layer): boolean {
  return layer.type === "text" && Boolean(layer.text?.trim()) && !parseColor(layer.highlight?.color);
}

function shaded(layer: Layer): boolean {
  return Boolean(layer.shadow) || (layer.effects ?? []).length > 0;
}

export function legibilityReport(doc: ImageSurface, grid: PixelGrid): string[] {
  const canvas = doc.canvas;
  let measured = 0;
  const lines = visibleLayers(doc.layers)
    .filter(measurable)
    .flatMap((layer) => {
      const ink = paintOf(layer);
      if (!ink) return [];
      const fontPx = (layer.fontSize ?? 0) * canvas.height;
      const contrast = backdropContrast(grid, unitCorners(layer.transform, canvas), ink, outlineInk(layer, fontPx));
      if (!contrast) return [];
      measured += 1;
      const needed = neededContrast(layer, fontPx, canvas.height);
      if (contrast.low >= needed) return [];
      const level = contrast.typical < needed ? "erro" : "aviso";
      const shadow = shaded(layer) ? " (a sombra do texto não entra na medida)" : "";
      return [`${level}: o texto ${layer.id} ("${snippet(layer)}") lê mal sobre o que está atrás: medido nos pixels, ${contrast.low}:1 nos 10% piores pontos e ${contrast.typical}:1 no típico, precisa de ${needed}:1${shadow}; uma caixa atrás, um véu escuro, um contorno grosso ou outra cor resolvem`];
    });
  if (lines.length > 0 || measured === 0) return lines;
  return [`ok: contraste medido nos pixels de ${measured} ${measured === 1 ? "texto" : "textos"}, todos acima do mínimo`];
}
