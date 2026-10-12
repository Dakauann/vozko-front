import { ciede2000, labOf, type Lab } from "@/lib/studio/agent/evals/replication-score";
import { imageScene, paintOf, videoSceneAt, type SceneElement } from "@/lib/studio/agent/scene";
import { resolvedSurface } from "@/lib/studio/components";
import type { Clip, Layer, StudioDocument, Track } from "@/lib/studio/document";

export interface Richness {
  elements: number;
  shapeKinds: number;
  curved: number;
  effects: number;
  depthPlanes: number;
  photos: number;
  typeLevels: number;
  fonts: number;
  palette: number;
}

interface Signature {
  grid: number[];
  palette: Lab[];
  fonts: string[];
  shadows: string[];
  radii: string[];
  scale: string;
  easings: string[];
  entrances: string[];
}

export interface Variety {
  runs: number;
  layoutDistance: number;
  paletteDistance: number;
  fontRepetition: { font: string; share: number };
  defaults: { kind: string; value: string; share: number }[];
  converging: string[];
}

const GRID = 6;
const SAME_COLOR = 8;
const DEPTH_BIN = 8;
const VIDEO_SAMPLES = 6;
const CONVERGENT_FONT = 0.6;
const CONVERGENT_DEFAULT = 0.5;
const CONVERGENT_LAYOUT = 0.15;

function elementsOf(doc: StudioDocument): SceneElement[] {
  if ("artboards" in doc) return imageScene(resolvedSurface(doc, doc.artboards[0])).elements;
  const seen = new Map<string, SceneElement>();
  for (let i = 0; i < VIDEO_SAMPLES; i++) for (const element of videoSceneAt(doc, Math.round(((i + 0.5) * doc.durationMs) / VIDEO_SAMPLES)).elements) seen.set(element.id, element);
  return [...seen.values()];
}

function curved(layer: Layer | undefined): boolean {
  if (!layer) return false;
  if (layer.type === "shape") return layer.shape === "ellipse" || layer.shape === "path" || layer.shape === "star" || (layer.shape === "rect" && (layer.radius ?? 0) > 0);
  return layer.type === "text" && Boolean(layer.curve);
}

function shadowsOf(layer: Layer | undefined): { x: number; y: number; blur: number }[] {
  if (!layer) return [];
  const effects = (layer.effects ?? []).filter((effect) => !effect.hidden && effect.type === "drop-shadow").map((effect) => ({ x: effect.x, y: effect.y, blur: effect.blur }));
  return layer.shadow ? [...effects, { x: layer.shadow.x, y: layer.shadow.y, blur: layer.shadow.blur }] : effects;
}

function styled(layer: Layer | undefined): boolean {
  return Boolean(layer && ((layer.effects?.some((effect) => !effect.hidden) ?? false) || layer.shadow));
}

function paletteOf(elements: readonly SceneElement[]): Lab[] {
  const colors: Lab[] = [];
  for (const element of elements) {
    const paint = element.layer ? paintOf(element.layer) : null;
    if (!paint || paint.a < 0.05) continue;
    const lab = labOf(paint);
    if (!colors.some((known) => ciede2000(known, lab) < SAME_COLOR)) colors.push(lab);
  }
  return colors;
}

function texts(elements: readonly SceneElement[]): Layer[] {
  return elements.flatMap((element) => (element.layer?.type === "text" && element.layer.text?.trim() ? [element.layer] : []));
}

export function richnessOf(doc: StudioDocument): Richness {
  const elements = elementsOf(doc);
  const words = texts(elements);
  const elevations = new Set(elements.flatMap((element) => shadowsOf(element.layer).map((s) => Math.round((Math.hypot(s.x, s.y) + s.blur) / DEPTH_BIN))));
  return {
    elements: elements.length,
    shapeKinds: new Set(elements.map((element) => (element.layer ? (element.layer.type === "shape" ? `shape:${element.layer.shape}` : element.layer.type) : "media"))).size,
    curved: elements.filter((element) => curved(element.layer)).length,
    effects: elements.filter((element) => styled(element.layer)).length,
    depthPlanes: elevations.size,
    photos: elements.filter((element) => element.media || element.layer?.type === "image").length,
    typeLevels: new Set(words.map((layer) => Math.round((layer.fontSize ?? 0) * 200))).size,
    fonts: new Set(words.map((layer) => layer.fontId ?? "inter")).size,
    palette: paletteOf(elements).length,
  };
}

function clipsOf(tracks: readonly Track[]): Clip[] {
  return tracks.flatMap((track) => track.clips.flatMap((clip) => [clip, ...(clip.tracks ? clipsOf(clip.tracks) : [])]));
}

function motionOf(doc: StudioDocument): { easings: string[]; entrances: string[] } {
  if ("artboards" in doc) return { easings: [], entrances: [] };
  const clips = clipsOf(doc.tracks);
  const easings = clips.flatMap((clip) => Object.values(clip.keyframes ?? {}).flatMap((keys) => (Array.isArray(keys) ? keys.map((key) => String((key as { easing?: unknown }).easing ?? "linear")) : [])));
  const entrances = clips.flatMap((clip) => [
    ...(clip.motionIn ? [`motion:${clip.motionIn.edge}`] : []),
    ...(clip.textIn ? [`text:${String((clip.textIn as { kind?: unknown; preset?: unknown }).kind ?? (clip.textIn as { preset?: unknown }).preset ?? "in")}`] : []),
    ...(clip.transitionIn ? [`transition:${String((clip.transitionIn as { kind?: unknown }).kind ?? "in")}`] : []),
    ...Object.keys(clip.keyframes ?? {}).map((lane) => `key:${lane}`),
  ]);
  return { easings: [...new Set(easings)], entrances: [...new Set(entrances)] };
}

function signatureOf(doc: StudioDocument): Signature {
  const elements = elementsOf(doc);
  const grid = new Array<number>(GRID * GRID).fill(0);
  for (const element of elements) {
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const left = Math.max(element.box.left, col / GRID);
        const right = Math.min(element.box.right, (col + 1) / GRID);
        const top = Math.max(element.box.top, row / GRID);
        const bottom = Math.min(element.box.bottom, (row + 1) / GRID);
        if (right > left && bottom > top) grid[row * GRID + col] = Math.min(1, grid[row * GRID + col] + (right - left) * (bottom - top) * GRID * GRID);
      }
    }
  }
  const words = texts(elements);
  return {
    grid,
    palette: paletteOf(elements),
    fonts: [...new Set(words.map((layer) => layer.fontId ?? "inter"))],
    shadows: [...new Set(elements.flatMap((element) => shadowsOf(element.layer).map((s) => `${Math.round(s.x)},${Math.round(s.y)},${Math.round(s.blur)}`)))],
    radii: [...new Set(elements.flatMap((element) => (element.layer?.type === "shape" && element.layer.shape === "rect" && (element.layer.radius ?? 0) > 0 ? [String(Math.round((element.layer.radius ?? 0) * 100) / 100)] : [])))],
    ...motionOf(doc),
    scale: [...new Set(words.map((layer) => Math.round((layer.fontSize ?? 0) * 1000) / 1000))].sort((a, b) => b - a).slice(0, 3).join("/"),
  };
}

function paletteGap(a: readonly Lab[], b: readonly Lab[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const nearest = (from: readonly Lab[], to: readonly Lab[]) => from.reduce((sum, lab) => sum + Math.min(...to.map((other) => ciede2000(lab, other))), 0) / from.length;
  return (nearest(a, b) + nearest(b, a)) / 2;
}

function meanPairs<T>(items: readonly T[], distance: (a: T, b: T) => number): number {
  let total = 0;
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      total += distance(items[i], items[j]);
      count += 1;
    }
  }
  return count === 0 ? 0 : total / count;
}

function mostCommon(lists: readonly (readonly string[])[]): { value: string; share: number } {
  const counts = new Map<string, number>();
  for (const list of lists) for (const value of new Set(list)) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = { value: "", share: 0 };
  for (const [value, count] of counts) if (count / lists.length > best.share) best = { value, share: count / lists.length };
  return best;
}

export function varietyOf(docs: readonly StudioDocument[]): Variety {
  const signatures = docs.map(signatureOf);
  const layoutDistance = meanPairs(signatures, (a, b) => a.grid.reduce((sum, v, i) => sum + Math.abs(v - b.grid[i]), 0) / (GRID * GRID));
  const paletteDistance = meanPairs(signatures, (a, b) => paletteGap(a.palette, b.palette));
  const font = mostCommon(signatures.map((s) => s.fonts));
  const defaults = [
    { kind: "sombra", ...mostCommon(signatures.map((s) => s.shadows)) },
    { kind: "raio", ...mostCommon(signatures.map((s) => s.radii)) },
    { kind: "escala de tipo", ...mostCommon(signatures.map((s) => (s.scale ? [s.scale] : []))) },
    ...(signatures.some((s) => s.easings.length > 0) ? [{ kind: "easing", ...mostCommon(signatures.filter((s) => s.easings.length > 0).map((s) => s.easings)) }, { kind: "entrada", ...mostCommon(signatures.filter((s) => s.entrances.length > 0).map((s) => s.entrances)) }] : []),
  ].filter((entry) => entry.value !== "");
  const converging = [
    ...(font.share >= CONVERGENT_FONT ? [`a fonte ${font.value} aparece em ${Math.round(font.share * 100)}% das peças`] : []),
    ...defaults.filter((entry) => entry.share >= CONVERGENT_DEFAULT).map((entry) => `${entry.kind} ${entry.value} se repete em ${Math.round(entry.share * 100)}% das peças`),
    ...(signatures.length > 2 && layoutDistance < CONVERGENT_LAYOUT ? [`layouts parecidos (distância ${layoutDistance.toFixed(2)})`] : []),
  ];
  return { runs: docs.length, layoutDistance, paletteDistance, fontRepetition: { font: font.value, share: font.share }, defaults, converging };
}
