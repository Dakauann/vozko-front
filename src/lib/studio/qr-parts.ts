import type { CanvasSize, Layer, Transform } from "./document";
import { isDark, type QrSymbol } from "./qr-encoder";
import { logoPlate, qrSymbol, type QrSpec } from "./qr";

export const QR_PART_IDS = { background: "background", modules: "modules", logo: "logo" } as const;

const LOGO_INSET_MODULES = 1;
const DECIMALS = 1e5;

interface Square {
  left: number;
  top: number;
  side: number;
}

function round(value: number): number {
  return Math.round(value * DECIMALS) / DECIMALS;
}

function boxTransform(square: Square, size: CanvasSize): Transform {
  return {
    x: round((square.left + square.side / 2) / size.width),
    y: round((square.top + square.side / 2) / size.height),
    w: round(square.side / size.width),
    h: round(square.side / size.height),
    rotation: 0,
    opacity: 1,
  };
}

function rectTransform(left: number, top: number, width: number, height: number, size: CanvasSize): Transform {
  return { x: round((left + width / 2) / size.width), y: round((top + height / 2) / size.height), w: round(width / size.width), h: round(height / size.height), rotation: 0, opacity: 1 };
}

function unit(value: number, size: number): string {
  return String(round(value / size));
}

export function modulePath(symbol: QrSymbol, hidden?: { start: number; side: number }): string {
  const parts: string[] = [];
  const covered = (x: number, y: number) => hidden !== undefined && x >= hidden.start && x < hidden.start + hidden.side && y >= hidden.start && y < hidden.start + hidden.side;
  for (let y = 0; y < symbol.size; y++) {
    let x = 0;
    while (x < symbol.size) {
      if (!isDark(symbol, x, y) || covered(x, y)) {
        x++;
        continue;
      }
      const from = x;
      while (x < symbol.size && isDark(symbol, x, y) && !covered(x, y)) x++;
      parts.push(`M${unit(from, symbol.size)} ${unit(y, symbol.size)}H${unit(x, symbol.size)}V${unit(y + 1, symbol.size)}H${unit(from, symbol.size)}Z`);
    }
  }
  return parts.join("");
}

function codeSquare(size: CanvasSize): Square {
  const side = Math.max(1, Math.min(size.width, size.height));
  return { left: (size.width - side) / 2, top: (size.height - side) / 2, side };
}

const cache = new WeakMap<QrSpec, { key: string; layers: Layer[] }>();

export function qrPartLayers(spec: QrSpec, size: CanvasSize): Layer[] {
  const key = `${Math.round(size.width * 100)}x${Math.round(size.height * 100)}`;
  const known = cache.get(spec);
  if (known && known.key === key) return known.layers;
  const layers = drawnQrPartLayers(spec, size);
  cache.set(spec, { key, layers });
  return layers;
}

function drawnQrPartLayers(spec: QrSpec, size: CanvasSize): Layer[] {
  const symbol = qrSymbol(spec);
  const square = codeSquare(size);
  const background: Layer = { id: QR_PART_IDS.background, type: "shape", shape: "rect", fill: spec.light, transform: boxTransform(square, size) };
  if (!symbol) return [background];
  const modulePx = square.side / (symbol.size + spec.quietZone * 2);
  const symbolSquare: Square = { left: square.left + spec.quietZone * modulePx, top: square.top + spec.quietZone * modulePx, side: symbol.size * modulePx };
  const plate = spec.logo ? logoPlate(symbol.size, spec.logo) : undefined;
  const modules: Layer = { id: QR_PART_IDS.modules, type: "shape", shape: "path", path: modulePath(symbol, plate), fill: spec.dark, transform: boxTransform(symbolSquare, size) };
  if (!spec.logo || !plate) return [background, modules];
  const plateSquare: Square = { left: symbolSquare.left + plate.start * modulePx, top: symbolSquare.top + plate.start * modulePx, side: plate.side * modulePx };
  const inner = Math.max(modulePx, plateSquare.side - LOGO_INSET_MODULES * 2 * modulePx);
  const width = spec.logo.aspect >= 1 ? inner : inner * spec.logo.aspect;
  const height = spec.logo.aspect >= 1 ? inner / spec.logo.aspect : inner;
  const center = { x: plateSquare.left + plateSquare.side / 2, y: plateSquare.top + plateSquare.side / 2 };
  return [
    background,
    modules,
    { id: QR_PART_IDS.logo, type: "image", assetId: spec.logo.assetId, transform: rectTransform(center.x - width / 2, center.y - height / 2, width, height, size) },
  ];
}
