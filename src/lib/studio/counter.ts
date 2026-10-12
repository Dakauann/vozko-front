import { newTextLayer, type Clip } from "./document";
import { valueAt, withLane, withoutProperty, type Easing, type Keyframe } from "./keyframes";
import { overlayClip } from "./media-clips";
import { animatesText } from "./text-animation";
import { COUNTER_RANGE } from "./text-properties";
import type { ClipPatch } from "./timeline";
import type { IssueCode } from "./validate";
import { COUNTER_LIMITS, COUNTER_MINUS, counterSeparators, formatCounterNumber, isCounterLocale, plainTextIssue, type CounterLocale } from "./locale-numbers";

export { COUNTER_LIMITS, COUNTER_LOCALES, COUNTER_MINUS, counterLocaleFor, counterSeparators, formatCounterNumber, isCounterLocale, plainTextIssue, type CounterLocale, type CounterSeparators } from "./locale-numbers";

export interface Counter {
  value: number;
  decimals: number;
  locale: CounterLocale;
  grouping: boolean;
  prefix?: string;
  suffix?: string;
}

export const COUNTER_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

export const COUNTER_PRESET = { from: 0, to: 10_000, durationMs: 2000, easing: "easeOut" as Easing };

export function newCounter(locale: CounterLocale): Counter {
  return { value: 0, decimals: 0, locale, grouping: true };
}

export function counterText(counter: Counter, value: number): string {
  return `${counter.prefix ?? ""}${formatCounterNumber(value, counter.decimals, counter.locale, counter.grouping)}${counter.suffix ?? ""}`;
}

function counterFrames(clip: Pick<Clip, "keyframes">): readonly Keyframe[] {
  return clip.keyframes?.counter ?? [];
}

function clamped(value: number): number {
  return Math.min(COUNTER_RANGE[1], Math.max(COUNTER_RANGE[0], value));
}

export function counterValueAt(clip: Pick<Clip, "counter" | "keyframes">, localMs: number): number {
  const frames = counterFrames(clip);
  return clamped(frames.length > 0 ? valueAt(frames, localMs) : (clip.counter?.value ?? 0));
}

export function finalCounterValue(clip: Pick<Clip, "counter" | "keyframes">): number {
  const frames = counterFrames(clip);
  return frames.length > 0 ? frames[frames.length - 1].value : (clip.counter?.value ?? 0);
}

export function shownText(clip: Pick<Clip, "counter" | "keyframes" | "layer">): string {
  return clip.counter ? counterText(clip.counter, finalCounterValue(clip)) : (clip.layer?.text ?? "");
}

export function counterCells(counter: Counter): string[] {
  const separators = counterSeparators(counter.locale);
  const cells: string[] = [...COUNTER_DIGITS];
  const add = (cell: string) => {
    if (cell !== "" && !cells.includes(cell)) cells.push(cell);
  };
  if (counter.grouping) add(separators.group);
  if (counter.decimals > 0) add(separators.decimal);
  add(COUNTER_MINUS);
  add(counter.prefix ?? "");
  add(counter.suffix ?? "");
  return cells;
}

export interface CounterToken {
  cell: number;
  digit: boolean;
}

export function counterTokens(counter: Counter, value: number): CounterToken[] {
  const cells = counterCells(counter);
  const token = (text: string): CounterToken => ({ cell: cells.indexOf(text), digit: (COUNTER_DIGITS as readonly string[]).includes(text) });
  const number = [...formatCounterNumber(value, counter.decimals, counter.locale, counter.grouping)].map(token);
  return [...(counter.prefix ? [token(counter.prefix)] : []), ...number, ...(counter.suffix ? [token(counter.suffix)] : [])];
}

export interface CountRange {
  from: number;
  to: number;
  startMs: number;
  durationMs: number;
  easing: Easing;
}

export function counterRange(clip: Pick<Clip, "keyframes">): CountRange | null {
  const frames = counterFrames(clip);
  if (frames.length < 2) return null;
  const first = frames[0];
  const last = frames[frames.length - 1];
  return { from: first.value, to: last.value, startMs: first.atMs, durationMs: last.atMs - first.atMs, easing: first.easing };
}

export function countPatch(clip: Pick<Clip, "counter" | "keyframes">, range: CountRange): ClipPatch {
  const startMs = Math.round(range.startMs);
  const endMs = Math.round(range.startMs + range.durationMs);
  const counter = clip.counter;
  if (!counter) return {};
  if (endMs <= startMs || range.from === range.to) return { counter: { ...counter, value: range.to }, keyframes: withoutProperty(clip.keyframes, "counter") };
  const frames: Keyframe[] = [
    { atMs: startMs, value: range.from, easing: range.easing },
    { atMs: endMs, value: range.to, easing: "linear" },
  ];
  return { keyframes: withLane(clip.keyframes, "counter", frames) };
}

export function countEndsPatch(clip: Pick<Clip, "keyframes">, ends: { from?: number; to?: number }): ClipPatch {
  const frames = counterFrames(clip);
  if (frames.length < 2) return {};
  const last = frames.length - 1;
  const next = frames.map((frame, i) => (i === 0 && ends.from !== undefined ? { ...frame, value: ends.from } : i === last && ends.to !== undefined ? { ...frame, value: ends.to } : frame));
  return { keyframes: withLane(clip.keyframes, "counter", next) };
}

export function counterPatch(clip: Pick<Clip, "keyframes">, counter: Counter | null): ClipPatch {
  if (counter) return { counter };
  return { counter: undefined, keyframes: withoutProperty(clip.keyframes, "counter") };
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

function affixIssue(affix: string | undefined): IssueCode | null {
  return plainTextIssue(affix, COUNTER_LIMITS.affixRunes);
}

export function counterIssue(clip: Clip): IssueCode | null {
  const counter = clip.counter;
  if (!counter) return counterFrames(clip).length > 0 ? "invalid" : null;
  if (!animatesText(clip)) return "invalid";
  if (!isCounterLocale(counter.locale)) return "unknown";
  if (!Number.isInteger(counter.decimals)) return "invalid";
  if (!within(counter.decimals, COUNTER_LIMITS.decimals) || !within(counter.value, COUNTER_RANGE)) return "out_of_range";
  return affixIssue(counter.prefix) ?? affixIssue(counter.suffix);
}

export function startCounterPatch(clip: Pick<Clip, "keyframes" | "durationMs">, locale: CounterLocale): ClipPatch {
  const counter = newCounter(locale);
  const counted = { ...clip, counter };
  return { counter, ...countPatch(counted, { from: COUNTER_PRESET.from, to: COUNTER_PRESET.to, startMs: 0, durationMs: Math.min(COUNTER_PRESET.durationMs, clip.durationMs), easing: COUNTER_PRESET.easing }) };
}

export function counterPresetClip(locale: CounterLocale, atMs: number): Clip {
  const layer = { ...newTextLayer(formatCounterNumber(COUNTER_PRESET.to, 0, locale, true), "heading"), fontSize: 0.1, fontWeight: 800, fill: "#ffffff", shadow: { color: "#000000", blur: 18, x: 0, y: 4 } };
  const clip = overlayClip(layer, atMs, { x: 0.5, y: 0.5, w: 0.86, h: 0.16, rotation: 0, opacity: 1 });
  return { ...clip, ...startCounterPatch(clip, locale) };
}
