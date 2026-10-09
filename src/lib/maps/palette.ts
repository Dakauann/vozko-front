import { heatLegendRamp, heatRamp, type HeatLegendRamp, type HeatStop } from "./heat";
import { TONE_KEYS, type ToneKey } from "./types";
import { toneStyle } from "./tones";

export { cssTokenColor } from "./tones";

export type TokenReader = (name: string) => string;

export type MapTheme = "light" | "dark";

export type BasemapRole =
  | "land"
  | "landcover"
  | "water"
  | "building"
  | "road"
  | "roadCasing"
  | "rail"
  | "boundary"
  | "label"
  | "placeLabel"
  | "halo";

export type BasemapPalette = Record<BasemapRole, string>;

export const BASEMAP_TOKENS: Record<MapTheme, Record<BasemapRole, string>> = {
  light: {
    land: "--background",
    landcover: "--secondary",
    water: "--accent-hover",
    building: "--muted",
    road: "--card",
    roadCasing: "--border",
    rail: "--border-strong",
    boundary: "--border-strong",
    label: "--muted-foreground",
    placeLabel: "--foreground",
    halo: "--background",
  },
  dark: {
    land: "--card",
    landcover: "--muted",
    water: "--background",
    building: "--popover",
    road: "--accent-hover",
    roadCasing: "--border",
    rail: "--border-strong",
    boundary: "--control-edge",
    label: "--muted-foreground",
    placeLabel: "--foreground",
    halo: "--card",
  },
};

export interface MapPalette {
  tones: Record<ToneKey, string>;
  surface: string;
  ink: string;
  mutedInk: string;
  edge: string;
  primary: string;
  primaryFill: string;
  primaryHex: `#${string}`;
  primaryEdgeHex: `#${string}`;
  surfaceHex: `#${string}`;
  dot: string;
  clusterStroke: string;
  heat: HeatStop[];
  heatLegend: HeatLegendRamp;
  districtFill: string;
  districtStroke: string;
  approximate: string;
}

export const DISTRICT_FILL_ALPHA = 0.28;
export const AREA_FILL_ALPHA = 0.07;
export const CLUSTER_STROKE_ALPHA = 0.9;
export const HEAT_TOKEN = "--chart-2";
export const APPROXIMATE_TOKEN = "--warning-ink";
export const PRIMARY_EDGE_TOKEN = "--primary-edge";
const MUTED_INK_TOKEN = "--muted-foreground";

type Triple = [number, number, number];

function parseTriple(value: string): Triple | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function tokenToHsl(value: string, alpha?: number): string | null {
  const triple = parseTriple(value);
  if (!triple) return null;
  const [h, s, l] = triple;
  return alpha === undefined ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}

export function tokenToHex(value: string): `#${string}` | null {
  const triple = parseTriple(value);
  if (!triple) return null;
  const [h, s, l] = [triple[0], triple[1] / 100, triple[2] / 100];
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const bySector: Triple[] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ];
  const [r, g, b] = bySector[Math.min(5, Math.floor(sector))];
  const m = l - chroma / 2;
  const channel = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function basemapPalette(theme: MapTheme, read: TokenReader): BasemapPalette | null {
  const palette: Partial<BasemapPalette> = {};
  for (const [role, token] of Object.entries(BASEMAP_TOKENS[theme]) as Array<[BasemapRole, string]>) {
    const color = tokenToHsl(read(token));
    if (!color) return null;
    palette[role] = color;
  }
  return palette as BasemapPalette;
}

export function mapPalette(read: TokenReader, theme: MapTheme): MapPalette | null {
  const tones: Partial<Record<ToneKey, string>> = {};
  for (const tone of TONE_KEYS) {
    const color = tokenToHsl(read(toneStyle(tone).token));
    if (!color) return null;
    tones[tone] = color;
  }
  const indigo = read(HEAT_TOKEN);
  const surface = tokenToHsl(read("--card"));
  const surfaceHex = tokenToHex(read("--card"));
  const ink = tokenToHsl(read("--foreground"));
  const mutedInk = tokenToHsl(read(MUTED_INK_TOKEN));
  const edge = tokenToHsl(read("--border-strong"));
  const primary = tokenToHsl(read("--primary"));
  const primaryFill = tokenToHsl(read("--primary"), AREA_FILL_ALPHA);
  const primaryHex = tokenToHex(read("--primary"));
  const primaryEdgeHex = tokenToHex(read(PRIMARY_EDGE_TOKEN));
  const dot = tokenToHsl(indigo);
  const clusterStroke = tokenToHsl(indigo, CLUSTER_STROKE_ALPHA);
  const districtFill = tokenToHsl(indigo, DISTRICT_FILL_ALPHA);
  const approximate = tokenToHsl(read(APPROXIMATE_TOKEN));
  const heat = heatRamp(indigo, theme);
  const heatLegend = heatLegendRamp(indigo, theme);
  if (!surface || !surfaceHex || !ink || !mutedInk || !edge || !primary || !primaryFill || !primaryHex || !primaryEdgeHex) return null;
  if (!dot || !clusterStroke || !districtFill || !approximate || !heat || !heatLegend) return null;
  return {
    tones: tones as Record<ToneKey, string>,
    surface,
    ink,
    mutedInk,
    edge,
    primary,
    primaryFill,
    primaryHex,
    primaryEdgeHex,
    surfaceHex,
    dot,
    clusterStroke,
    heat,
    heatLegend,
    districtFill,
    districtStroke: dot,
    approximate,
  };
}

export const MAP_TOKEN_NAMES: readonly string[] = Array.from(
  new Set([
    ...Object.values(BASEMAP_TOKENS.light),
    ...Object.values(BASEMAP_TOKENS.dark),
    ...TONE_KEYS.map((tone) => toneStyle(tone).token),
    "--card",
    "--foreground",
    "--border-strong",
    "--primary",
    PRIMARY_EDGE_TOKEN,
    MUTED_INK_TOKEN,
    HEAT_TOKEN,
    APPROXIMATE_TOKEN,
  ]),
).sort();
