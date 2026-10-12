import data from "./font-metrics.json";
import type { FontId } from "./fonts";

export const FONT_METRIC_WEIGHTS = [400, 700] as const;

export const FONT_METRIC_SAMPLES = {
  lower: "a vida e bela quando o dia comeca com cafe the quick brown fox jumps over the lazy dog",
  upper: "A VIDA E BELA QUANDO O DIA COMECA COM CAFE THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG",
  digits: "0123456789",
  marks: "!?%.,:&'$",
} as const;

type MetricWeight = `${(typeof FONT_METRIC_WEIGHTS)[number]}`;

export type FontAdvances = readonly [lower: number, upper: number, digit: number, mark: number, space: number];

export const FONT_METRICS = data as unknown as Readonly<Record<FontId, Readonly<Record<MetricWeight, FontAdvances>>>>;

const [LIGHT, HEAVY] = FONT_METRIC_WEIGHTS;

function advancesAt(fontId: FontId, weight: number): FontAdvances {
  const metrics = FONT_METRICS[fontId];
  const t = Math.min(1, Math.max(0, (weight - LIGHT) / (HEAVY - LIGHT)));
  const light = metrics[String(LIGHT) as MetricWeight];
  const heavy = metrics[String(HEAVY) as MetricWeight];
  return light.map((value, i) => value + (heavy[i] - value) * t) as unknown as FontAdvances;
}

function charClass(char: string): number {
  if (/\s/u.test(char)) return 4;
  if (/\p{Lu}/u.test(char)) return 1;
  if (/\p{L}/u.test(char)) return 0;
  if (/\p{Nd}/u.test(char)) return 2;
  return 3;
}

export function textAdvance(text: string, fontId: FontId, weight: number, letterSpacing: number = 0): number {
  const advances = advancesAt(fontId, weight);
  const chars = [...text];
  return chars.reduce((sum, char) => sum + advances[charClass(char)], 0) + letterSpacing * chars.length;
}
