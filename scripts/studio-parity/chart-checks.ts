import { rasterizeRegion } from "@/components/studio/canvas/rasterize";
import { chartInk, newChartSpec, type ChartData, type ChartKind, type ChartSpec } from "@/lib/studio/chart";
import { chartParts } from "@/lib/studio/chart-parts";
import { resolvedSurface } from "@/lib/studio/components";
import { emptyArtboard, emptyVideoDocument, imageDocument, newOverlayClip, videoCanvasSize, type Artboard, type Layer, type VideoDocument } from "@/lib/studio/document";
import { artboardScenes } from "@/lib/studio/scene/image-scene";
import type { Scene } from "@/lib/studio/scene/scene";

type Board = (board: Artboard, scene?: Scene) => Promise<(x: number, y: number) => number[]>;
type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;

const SIZE = 600;
const BOX = 0.8;
const BARS = [10, 20, 40, 30];
const SLICES = [50, 30, 20];
const COLORS = ["#ff0000", "#00c000", "#0000ff", "#ffcc00"];
const RGB: number[][] = [
  [255, 0, 0],
  [0, 192, 0],
  [0, 0, 255],
  [255, 204, 0],
];
const WHITE = [255, 255, 255];
const EDGE_TOLERANCE_PX = 1.5;
const RATIO_TOLERANCE = 0.02;
const ANGLE_SAMPLES = 720;
const SHARE_TOLERANCE = 0.01;
const FALLBACK_STEP = 6;
const FALLBACK_TOLERANCE = 24;
const FALLBACK_SHARE = 0.01;
const GROW_MS = 1000;
const FILM_MS = 2000;

function bare(kind: ChartKind, data: ChartData): ChartSpec {
  const spec = newChartSpec(kind, data, "pt-BR", chartInk("#111111"), COLORS);
  return { ...spec, style: { ...spec.style, axes: false, gridlines: false, legend: "none", valueLabels: false, barRadius: 0 } };
}

function chartLayer(spec: ChartSpec): Layer {
  return { id: "chart", type: "chart", transform: { x: 0.5, y: 0.5, w: BOX, h: BOX, rotation: 0, opacity: 1 }, chart: spec };
}

function board(spec: ChartSpec): Artboard {
  return { ...emptyArtboard({ width: SIZE, height: SIZE }, "#ffffff"), id: "board", layers: [chartLayer(spec)] };
}

function closest(rgb: number[]): number {
  let best = -1;
  let distance = Infinity;
  [...RGB, WHITE].forEach((color, index) => {
    const d = Math.max(...color.map((value, c) => Math.abs(value - rgb[c])));
    if (d < distance) {
      distance = d;
      best = index;
    }
  });
  return best === RGB.length ? -1 : best;
}

async function gpuOf(draw: Board, artboard: Artboard): Promise<(x: number, y: number) => number[]> {
  const [scene] = artboardScenes(imageDocument([artboard]), { hidden: new Set(), overrides: new Map() });
  return draw(artboard, scene);
}

async function barHeights(draw: Board): Promise<Record<string, unknown>> {
  const spec = bare("bar", { labels: ["a", "b", "c", "d"], series: [{ name: "x", values: BARS }] });
  const artboard = board(spec);
  const at = await gpuOf(draw, artboard);
  const offset = (SIZE * (1 - BOX)) / 2;
  const boxPx = SIZE * BOX;
  const bars = chartParts(spec, { width: boxPx, height: boxPx }).filter((part) => part.role === "bar");
  const measured = bars.map((part) => {
    const t = part.layer.transform;
    const x = offset + t.x * boxPx;
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < SIZE; y++) {
      if (closest(at(x, y)) !== 0) continue;
      if (top < 0) top = y;
      bottom = y + 1;
    }
    return { top, bottom, height: bottom - top, wantTop: offset + (t.y - t.h / 2) * boxPx, wantBottom: offset + (t.y + t.h / 2) * boxPx };
  });
  const placed = measured.every((bar) => Math.abs(bar.top - bar.wantTop) <= EDGE_TOLERANCE_PX && Math.abs(bar.bottom - bar.wantBottom) <= EDGE_TOLERANCE_PX);
  const proportional = measured.every((bar, i) => Math.abs(bar.height / measured[0].height - BARS[i] / BARS[0]) <= (RATIO_TOLERANCE * BARS[i]) / BARS[0]);
  return { heights: measured.map((bar) => bar.height).join(","), expectedHeights: measured.map((bar) => Math.round(bar.wantBottom - bar.wantTop)).join(","), barsOk: bars.length === BARS.length && placed && proportional };
}

async function sliceAngles(draw: Board): Promise<Record<string, unknown>> {
  const spec = bare("pie", { labels: ["a", "b", "c"], series: [{ name: "x", values: SLICES }] });
  const artboard = board(spec);
  const at = await gpuOf(draw, artboard);
  const offset = (SIZE * (1 - BOX)) / 2;
  const boxPx = SIZE * BOX;
  const slices = chartParts(spec, { width: boxPx, height: boxPx }).filter((part) => part.role === "slice");
  const t = slices[0].layer.transform;
  const cx = offset + t.x * boxPx;
  const cy = offset + t.y * boxPx;
  const radius = (t.w * boxPx) / 2;
  const counts = SLICES.map(() => 0);
  const firstAngle = slices[0].wedge!.start;
  let startOk = true;
  for (let i = 0; i < ANGLE_SAMPLES; i++) {
    const angle = firstAngle + ((i + 0.5) / ANGLE_SAMPLES) * Math.PI * 2;
    const found = closest(at(cx + radius * 0.6 * Math.cos(angle), cy + radius * 0.6 * Math.sin(angle)));
    if (found >= 0 && found < counts.length) counts[found] += 1;
    if (i === 2) startOk &&= found === 0;
    if (i === ANGLE_SAMPLES - 3) startOk &&= found === SLICES.length - 1;
  }
  const total = SLICES.reduce((sum, value) => sum + value, 0);
  const shares = counts.map((count) => count / ANGLE_SAMPLES);
  const sharesOk = shares.every((share, i) => Math.abs(share - SLICES[i] / total) <= SHARE_TOLERANCE);
  return { shares: shares.map((share) => share.toFixed(3)).join(","), expectedShares: SLICES.map((value) => (value / total).toFixed(3)).join(","), slicesOk: slices.length === SLICES.length && sharesOk && startOk };
}

async function fallbackMatch(draw: Board): Promise<Record<string, unknown>> {
  const results: string[] = [];
  let ok = true;
  for (const kind of ["barStacked", "lineMulti", "donut", "areaStacked", "scatter"] as const) {
    const data: ChartData = kind === "scatter" ? { labels: ["a", "b", "c"], series: [{ name: "x", values: [1, 2, 3] }, { name: "y", values: [3, 1, 2] }] } : { labels: ["a", "b", "c"], series: [{ name: "x", values: [3, 5, 4] }, { name: "y", values: [2, 2, 3] }] };
    const artboard = board(bare(kind, data));
    const gpu = await gpuOf(draw, artboard);
    const layers = resolvedSurface(imageDocument([artboard]), artboard).layers;
    const konva = (await rasterizeRegion(layers, SIZE, SIZE, { x: 0, y: 0, width: SIZE, height: SIZE }, { background: "#ffffff" })).getContext("2d")!.getImageData(0, 0, SIZE, SIZE).data;
    let total = 0;
    let off = 0;
    for (let y = FALLBACK_STEP / 2; y < SIZE; y += FALLBACK_STEP) {
      for (let x = FALLBACK_STEP / 2; x < SIZE; x += FALLBACK_STEP) {
        const i = (Math.floor(y) * SIZE + Math.floor(x)) * 4;
        const want = [konva[i], konva[i + 1], konva[i + 2]];
        total += 1;
        if (Math.max(...gpu(x, y).map((value, c) => Math.abs(value - want[c]))) > FALLBACK_TOLERANCE) off += 1;
      }
    }
    results.push(`${kind}:${off}/${total}`);
    ok &&= off <= total * FALLBACK_SHARE;
  }
  return { fallback: results.join(" "), fallbackOk: ok };
}

function growFilm(spec: ChartSpec): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#ffffff";
  const clip = { ...newOverlayClip(chartLayer(spec), 0, FILM_MS, { x: 0.5, y: 0.5, w: BOX, h: BOX, rotation: 0, opacity: 1 }), id: "grow", chartIn: { style: "grow" as const, order: "category" as const, durationMs: GROW_MS, staggerMs: 0, easing: "linear" as const } };
  doc.tracks = [{ id: "charts", kind: "visual", clips: [clip] }];
  doc.durationMs = FILM_MS;
  return doc;
}

async function growMiddle(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const spec = bare("bar", { labels: ["a", "b", "c", "d"], series: [{ name: "x", values: BARS }] });
  const doc = growFilm(spec);
  const { width, height } = videoCanvasSize(doc);
  const [middle, settled] = await frames(doc, width, height, [GROW_MS / 2, GROW_MS + 500]);
  const columns = Math.ceil(width / step);
  const pick = (frame: Uint8Array, x: number, y: number) => {
    const i = (Math.round(y / step) * columns + Math.round(x / step)) * 3;
    return [frame[i], frame[i + 1], frame[i + 2]];
  };
  const boxW = width * BOX;
  const boxH = height * BOX;
  const tallest = chartParts(spec, { width: boxW, height: boxH }).find((part) => part.layer.id === "bar-0-2")!.layer.transform;
  const x = (width - boxW) / 2 + tallest.x * boxW;
  const span = (frame: Uint8Array) => {
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < height; y += step) {
      if (closest(pick(frame, x, y)) !== 0) continue;
      if (top < 0) top = y;
      bottom = y + step;
    }
    return { top, bottom, height: bottom - top };
  };
  const half = span(middle);
  const full = span(settled);
  const growOk = full.height > 0 && Math.abs(half.height - full.height / 2) <= step * 1.5 && Math.abs(half.bottom - full.bottom) <= step;
  return { middle: `${half.top}-${half.bottom}`, settled: `${full.top}-${full.bottom}`, growOk };
}

export async function chartParity(draw: Board, frames: Frames, step: number): Promise<Record<string, unknown>> {
  return { ...(await barHeights(draw)), ...(await sliceAngles(draw)), ...(await fallbackMatch(draw)), ...(await growMiddle(frames, step)) };
}
