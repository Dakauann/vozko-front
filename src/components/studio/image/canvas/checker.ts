"use client";

import { loadUrlImage, useLoadedImage } from "@/components/studio/canvas/asset-images";

export const CHECKER_CELL_PX = 8;

const LIGHT = "#ffffff";
const DARK = "#e5e7eb";

let source: string | null = null;

function checkerSource(): string {
  if (source) return source;
  const side = CHECKER_CELL_PX * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><rect width="${side}" height="${side}" fill="${LIGHT}"/><rect width="${CHECKER_CELL_PX}" height="${CHECKER_CELL_PX}" fill="${DARK}"/><rect x="${CHECKER_CELL_PX}" y="${CHECKER_CELL_PX}" width="${CHECKER_CELL_PX}" height="${CHECKER_CELL_PX}" fill="${DARK}"/></svg>`;
  source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return source;
}

export function useCheckerImage(enabled: boolean): HTMLImageElement | null {
  const loaded = useLoadedImage(enabled ? checkerSource() : null, loadUrlImage);
  return enabled && loaded.status === "ready" ? loaded.image : null;
}
