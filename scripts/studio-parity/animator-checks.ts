import { emptyVideoDocument, newTextLayer, type Clip, type VideoDocument } from "@/lib/studio/document";
import { overlayClip } from "@/lib/studio/media-clips";
import { newRangeSelector } from "@/lib/studio/text-animator";
import { animatorFrameAt, rangeAmounts, type AnimatorProperties, type RangeSelector, type TextUnitAnimator } from "@/lib/studio/text-selectors";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;

const SIZE = 1080;
const UNITS = 6;
const TEXT = "M M M M M M";
const LIT = 96;
const FILM_MS = 1001;
const SHARE_TOLERANCE = 0.12;
const FULL = 0.99;
const NONE = 0.01;
const RED_GREEN = 90;
const BOX = { x: 0.5, y: 0.5, w: 0.9, h: 0.3, rotation: 0, opacity: 1 };

interface Case {
  name: string;
  properties: AnimatorProperties;
  selector: Partial<RangeSelector>;
  keys?: TextUnitAnimator["keyframes"];
  times: readonly number[];
}

const CASES: readonly Case[] = [
  { name: "centerOut", properties: { opacity: 0 }, selector: { order: "centerOut", end: 34 }, times: [0] },
  { name: "edgesIn", properties: { opacity: 0 }, selector: { order: "edgesIn", end: 34 }, times: [0] },
  { name: "rampUp", properties: { opacity: 0 }, selector: { shape: "rampUp", start: 30, end: 70 }, times: [0] },
  { name: "triangle", properties: { opacity: 0 }, selector: { shape: "triangle", start: 0, end: 100 }, times: [0] },
  { name: "smoothEased", properties: { opacity: 0 }, selector: { shape: "smooth", start: 10, end: 90, easeHigh: 60, easeLow: 30 }, times: [0] },
  { name: "random", properties: { opacity: 0 }, selector: { order: "random", end: 50, seed: 4242 }, times: [0] },
  {
    name: "keyedOffset",
    properties: { opacity: 0 },
    selector: { units: "index", end: 2 },
    keys: { offset: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 4, easing: "linear" }] },
    times: [0, 500, 1000],
  },
];

function animatorOf(item: Pick<Case, "properties" | "selector" | "keys">): TextUnitAnimator {
  return { id: "anim", unit: "char", properties: item.properties, selector: { ...newRangeSelector(1), ...item.selector }, ...(item.keys ? { keyframes: item.keys } : {}) };
}

function film(animators: TextUnitAnimator[]): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  const layer = { ...newTextLayer(TEXT), id: "l-units", fontId: "roboto" as const, fontWeight: 700, fontSize: 0.1, fill: "#ffffff", align: "center" as const };
  const clip: Clip = { ...overlayClip(layer, 0, BOX), id: "units", startMs: 0, durationMs: FILM_MS, ...(animators.length > 0 ? { textAnimators: animators } : {}) };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [clip] }];
  doc.durationMs = FILM_MS;
  return doc;
}

function inkColumns(frame: Uint8Array, columns: number): number[] {
  const ink = new Array<number>(columns).fill(0);
  for (let y = 0; y < columns; y++) {
    for (let x = 0; x < columns; x++) if (frame[(y * columns + x) * 3] > LIT) ink[x] += 1;
  }
  return ink;
}

function spans(ink: readonly number[]): [number, number][] {
  const found: [number, number][] = [];
  ink.forEach((count, x) => {
    if (count === 0) return;
    const last = found[found.length - 1];
    if (last && last[1] === x - 1) last[1] = x;
    else found.push([x, x]);
  });
  return found;
}

function spanInk(frame: Uint8Array, columns: number, span: readonly [number, number], channel: number): { ink: number; sum: number } {
  let ink = 0;
  let sum = 0;
  for (let y = 0; y < columns; y++) {
    for (let x = span[0]; x <= span[1]; x++) {
      const at = (y * columns + x) * 3;
      if (Math.max(frame[at], frame[at + 1], frame[at + 2]) <= LIT) continue;
      ink += 1;
      sum += frame[at + channel];
    }
  }
  return { ink, sum };
}

function spanLight(frame: Uint8Array, columns: number, span: readonly [number, number]): number {
  let light = 0;
  for (let y = 0; y < columns; y++) {
    for (let x = span[0]; x <= span[1]; x++) light += frame[(y * columns + x) * 3];
  }
  return light;
}

function verdict(expected: readonly number[], shares: readonly number[]): boolean {
  return expected.every((amount, i) => Math.abs(shares[i] - (1 - amount)) <= SHARE_TOLERANCE);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function animatorUnits(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const columns = Math.ceil(SIZE / step);
  const [plain] = await frames(film([]), SIZE, SIZE, [0]);
  const letters = spans(inkColumns(plain, columns));
  const full = letters.map((span) => spanLight(plain, columns, span));
  const results: Record<string, string> = {};
  let unitsOk = letters.length === UNITS;
  for (const item of CASES) {
    const animator = animatorOf(item);
    const shown = await frames(film([animator]), SIZE, SIZE, item.times);
    item.times.forEach((ms, k) => {
      const frame = animatorFrameAt(animator, ms).selector as RangeSelector;
      const expected = rangeAmounts(frame, UNITS);
      const shares = letters.map((span, i) => (full[i] > 0 ? spanLight(shown[k], columns, span) / full[i] : 0));
      const ok = letters.length === UNITS && verdict(expected, shares);
      unitsOk &&= ok;
      results[`${item.name}@${ms}`] = `${expected.map((v) => (v >= FULL ? "x" : v <= NONE ? "o" : "~")).join("")} ${shares.map(round).join(" ")} ${ok ? "ok" : "off"}`;
    });
  }
  const tinted = animatorOf({ properties: { fill: "#ff0000" }, selector: { end: 50 } });
  const [painted] = await frames(film([tinted]), SIZE, SIZE, [0]);
  const greens = letters.map((span) => {
    const { ink, sum } = spanInk(painted, columns, span, 1);
    return ink > 0 ? sum / ink : 255;
  });
  const colorOk = letters.length === UNITS && greens.slice(0, 3).every((green) => green < RED_GREEN) && greens.slice(3).every((green) => green > 255 - RED_GREEN);
  return { letters: letters.length, ...results, greens: greens.map(Math.round).join(" "), unitsOk, colorOk };
}
