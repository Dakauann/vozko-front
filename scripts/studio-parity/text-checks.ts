import { counterText, counterValueAt, newCounter } from "@/lib/studio/counter";
import { emptyVideoDocument, newTextLayer, type Clip, type Layer, type VideoDocument } from "@/lib/studio/document";
import { basePath, sampleAt } from "@/lib/studio/line-geometry";
import { overlayClip } from "@/lib/studio/media-clips";
import { pathToSubpaths } from "@/lib/studio/path-nodes";
import { pathOffsetAt, textPathData, type TextPath } from "@/lib/studio/text-path";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;

const SIZE = 1080;
const LIT = 96;
const ARC_REACH_CELLS = 2;
const DIGIT_REACH_CELLS = 1;
const MATCH_LIMIT = 0.01;
const WRONG_FLOOR = 0.03;
const ARC_MATCH_LIMIT = 0.25;
const CENTROID_TOLERANCE_PX = 36;
const COUNTER_TIMES = [0, 300, 600, 900] as const;
const ARC_TIMES = [0, 500, 1000] as const;
const BOX = { x: 0.5, y: 0.5, w: 0.9, h: 0.4, rotation: 0, opacity: 1 };
const ARC: TextPath = { shape: "arc", bend: 0.8, offset: 0.5, align: "center" };

function film(clip: Clip, durationMs: number): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  doc.tracks = [{ id: "v1", kind: "visual", clips: [clip] }];
  doc.durationMs = durationMs;
  return doc;
}

function textClip(layer: Partial<Layer>, patch: Partial<Clip>, durationMs: number): Clip {
  const base = { ...newTextLayer("0"), id: "l-glyphs", fontId: "roboto" as const, fontWeight: 700, fontSize: 0.12, fill: "#ffffff", align: "center" as const, ...layer };
  return { ...overlayClip(base, 0, BOX), id: "glyphs", startMs: 0, durationMs, ...patch };
}

function lit(frame: Uint8Array, columns: number, x: number, y: number): boolean {
  return frame[(y * columns + x) * 3] > LIT;
}

function near(frame: Uint8Array, columns: number, rows: number, x: number, y: number, reach: number): boolean {
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx >= 0 && cy >= 0 && cx < columns && cy < rows && lit(frame, columns, cx, cy)) return true;
    }
  }
  return false;
}

function inkMismatch(a: Uint8Array, b: Uint8Array, step: number, reach: number): number {
  const columns = Math.ceil(SIZE / step);
  const rows = Math.ceil(SIZE / step);
  let ink = 0;
  let stray = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      for (const [one, other] of [
        [a, b],
        [b, a],
      ]) {
        if (!lit(one, columns, x, y)) continue;
        ink += 1;
        if (!near(other, columns, rows, x, y, reach)) stray += 1;
      }
    }
  }
  return ink === 0 ? 1 : stray / ink;
}

function centroid(frame: Uint8Array, step: number): { x: number; y: number; ink: number } {
  const columns = Math.ceil(SIZE / step);
  let x = 0;
  let y = 0;
  let ink = 0;
  for (let row = 0; row < columns; row++) {
    for (let column = 0; column < columns; column++) {
      if (!lit(frame, columns, column, row)) continue;
      x += column * step;
      y += row * step;
      ink += 1;
    }
  }
  return ink === 0 ? { x: 0, y: 0, ink } : { x: x / ink, y: y / ink, ink };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

async function counterDigits(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const counter = { ...newCounter("pt-BR"), prefix: "R$ " };
  const clip = textClip({}, { counter, keyframes: { counter: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 900, value: 1000, easing: "linear" }] } }, 1000);
  const shown = await frames(film(clip, 1000), SIZE, SIZE, COUNTER_TIMES);
  const expected = COUNTER_TIMES.map((ms) => counterValueAt(clip, ms));
  const results: { text: string; match: number; wrong: number }[] = [];
  for (const [i, value] of expected.entries()) {
    const text = counterText(counter, value);
    const [right] = await frames(film(textClip({ text }, {}, 1000), 1000), SIZE, SIZE, [0]);
    const [neighbour] = await frames(film(textClip({ text: counterText(counter, value + 1) }, {}, 1000), 1000), SIZE, SIZE, [0]);
    results.push({ text, match: round(inkMismatch(shown[i], right, step, DIGIT_REACH_CELLS)), wrong: round(inkMismatch(shown[i], neighbour, step, DIGIT_REACH_CELLS)) });
  }
  return {
    shown: results.map((result) => result.text).join(" | "),
    match: results.map((result) => result.match).join(" "),
    wrong: results.map((result) => result.wrong).join(" "),
    digitsOk: results.every((result) => result.match <= MATCH_LIMIT && result.wrong >= WRONG_FLOOR && result.wrong > result.match * 2),
  };
}

function arcPoint(offset: number): { x: number; y: number } {
  const width = BOX.w * SIZE;
  const height = BOX.h * SIZE;
  const base = basePath(pathToSubpaths(textPathData(ARC, width, height))[0], 2)!;
  const sample = sampleAt(base, offset * base.length);
  return { x: (BOX.x - BOX.w / 2) * SIZE + sample.x, y: (BOX.y - BOX.h / 2) * SIZE + sample.y };
}

async function arcText(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const text = "OFERTA";
  const clip = textClip({ text }, { textPath: ARC, keyframes: { pathOffset: [{ atMs: 0, value: 0.3, easing: "linear" }, { atMs: 1000, value: 0.7, easing: "linear" }] } }, 1001);
  const doc = film(clip, 1001);
  const shown = await frames(doc, SIZE, SIZE, ARC_TIMES);
  const again = await frames(doc, SIZE, SIZE, ARC_TIMES);
  const middle = shown[1];
  const [curved] = await frames(film(textClip({ text, curve: ARC.bend }, { keyframes: undefined }, 1001), 1001), SIZE, SIZE, [0]);
  const [straight] = await frames(film(textClip({ text }, {}, 1001), 1001), SIZE, SIZE, [0]);
  const drift = ARC_TIMES.map((ms, i) => {
    const want = arcPoint(pathOffsetAt(clip, ms));
    const got = centroid(shown[i], step);
    return got.ink === 0 ? Infinity : Math.hypot(got.x - want.x, got.y - want.y);
  });
  const curveMatch = inkMismatch(middle, curved, step, ARC_REACH_CELLS);
  const straightMatch = inkMismatch(middle, straight, step, ARC_REACH_CELLS);
  const same = shown.every((frame, i) => frame.every((value, k) => value === again[i][k]));
  return {
    curveMatch: round(curveMatch),
    straightMatch: round(straightMatch),
    drift: drift.map((value) => Math.round(value)).join(" "),
    arcOk: curveMatch <= ARC_MATCH_LIMIT && straightMatch > curveMatch * 2 && drift.every((value) => value <= CENTROID_TOLERANCE_PX),
    repeatOk: same,
  };
}

export async function textGlyphs(frames: Frames, step: number): Promise<Record<string, unknown>> {
  return { ...(await counterDigits(frames, step)), ...(await arcText(frames, step)) };
}
