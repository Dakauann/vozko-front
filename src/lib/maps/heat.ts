import type { FeatureCollection, Point } from "geojson";
import type { ExpressionSpecification } from "maplibre-gl";

import type { MapLayerResponse } from "./types";

export type HeatTheme = "light" | "dark";

export interface HeatStop {
  at: number;
  color: string;
}

export interface HeatLegendRamp {
  from: string;
  to: string;
}

export const HEAT_FLOOR = 0.04;
export const HEAT_POINT_RADIUS = 26;
export const HEAT_INTENSITY = Math.sqrt(2 * Math.PI);
const HEAT_CELL_SPREAD = 1.25;
const LEADS_TO_SATURATE = 12;
const WORLD_PIXELS_AT_ZOOM_ZERO = 512;
const DEGREES_AROUND = 360;
const HEAT_MAX_ZOOM = 22;
const ALPHA_FLOOR = 0.08;
const ALPHA_SLOPE = 0.52;
const ALPHA_CEILING = 0.58;
const ALPHA_CAP_AT = (ALPHA_CEILING - ALPHA_FLOOR) / ALPHA_SLOPE;
const HALF_LIGHTNESS = 50;
const STOP_DECIMALS = 4;
const TRANSPARENT = "rgba(0, 0, 0, 0)";

const LIGHTNESS: Record<HeatTheme, { from: number; to: number }> = {
  light: { from: 80, to: 40 },
  dark: { from: 36, to: 66 },
};

const LEGEND_LIGHTNESS: Record<HeatTheme, { from: number; to: number }> = {
  light: { from: 76, to: 32 },
  dark: { from: 40, to: 72 },
};

const LEGEND_ALPHA = { from: 0.35, to: 0.85 };

function hueAndSaturation(token: string): [number, number] | null {
  const match = token.trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function rounded(value: number): number {
  const scale = 10 ** STOP_DECIMALS;
  return Math.round(value * scale) / scale;
}

function heatAt(hue: number, saturation: number, theme: HeatTheme, t: number): string {
  const { from, to } = LIGHTNESS[theme];
  const [r, g, b] = hslToRgb(hue, saturation, from + (to - from) * t);
  const alpha = Math.min(ALPHA_CEILING, ALPHA_FLOOR + t * ALPHA_SLOPE);
  return `rgba(${r}, ${g}, ${b}, ${rounded(alpha)})`;
}

export function heatRamp(token: string, theme: HeatTheme): HeatStop[] | null {
  const base = hueAndSaturation(token);
  if (!base) return null;
  const [hue, saturation] = base;
  const { from, to } = LIGHTNESS[theme];
  const halfway = (HALF_LIGHTNESS - from) / (to - from);
  const stops = [HEAT_FLOOR, halfway, ALPHA_CAP_AT, 1].sort((a, b) => a - b);
  return [{ at: 0, color: TRANSPARENT }, ...stops.map((t) => ({ at: rounded(t), color: heatAt(hue, saturation, theme, t) }))];
}

export function heatLegendRamp(token: string, theme: HeatTheme): HeatLegendRamp | null {
  const base = hueAndSaturation(token);
  if (!base) return null;
  const [hue, saturation] = base;
  const { from, to } = LEGEND_LIGHTNESS[theme];
  return {
    from: `hsla(${hue}, ${saturation}%, ${from}%, ${LEGEND_ALPHA.from})`,
    to: `hsla(${hue}, ${saturation}%, ${to}%, ${LEGEND_ALPHA.to})`,
  };
}

interface HeatSpot {
  lat: number;
  lng: number;
  count: number;
}

function preciseSpots(layer: MapLayerResponse | null): HeatSpot[] {
  if (!layer) return [];
  const items: ReadonlyArray<HeatSpot & { placement: string }> = layer.kind === "points" ? layer.points : layer.cells;
  return items.filter((item) => item.placement === "on_map");
}

export function heatFeatureCollection(layer: MapLayerResponse | null): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: preciseSpots(layer).map((spot) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [spot.lng, spot.lat] },
      properties: { count: spot.count },
    })),
  };
}

export function heatWeight(layer: MapLayerResponse | null): ExpressionSpecification | number {
  if (layer?.kind === "points") return ["interpolate", ["linear"], ["get", "count"], 0, 0, LEADS_TO_SATURATE, 1];
  const busiest = preciseSpots(layer).reduce((highest, spot) => Math.max(highest, spot.count), 0);
  if (busiest <= 0) return 1;
  return ["interpolate", ["linear"], ["sqrt", ["get", "count"]], 0, 0, Math.sqrt(busiest), 1];
}

export function heatRadius(layer: MapLayerResponse | null): ExpressionSpecification | number {
  if (!layer || layer.kind !== "cells") return HEAT_POINT_RADIUS;
  const atZero = layer.cellSizeDegrees * (WORLD_PIXELS_AT_ZOOM_ZERO / DEGREES_AROUND) * HEAT_CELL_SPREAD;
  const top = atZero * 2 ** HEAT_MAX_ZOOM;
  const floorZoom = Math.log2(HEAT_POINT_RADIUS / atZero);
  if (floorZoom <= 0) return ["interpolate", ["exponential", 2], ["zoom"], 0, atZero, HEAT_MAX_ZOOM, top];
  if (floorZoom >= HEAT_MAX_ZOOM) return HEAT_POINT_RADIUS;
  return ["interpolate", ["exponential", 2], ["zoom"], 0, HEAT_POINT_RADIUS, floorZoom, HEAT_POINT_RADIUS, HEAT_MAX_ZOOM, top];
}
