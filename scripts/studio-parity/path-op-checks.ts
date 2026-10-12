import { repeatCopies, type ClipRepeat } from "@/lib/studio/clip-repeat";
import { emptyArtboard, emptyVideoDocument, newOverlayClip, newShapeLayer, videoCanvasSize, type Artboard, type Layer, type Transform, type VideoDocument } from "@/lib/studio/document";
import { MERGE_OPERAND_PATHS, newPathOp, type PathOp } from "@/lib/studio/path-ops";
import { placeBy } from "@/lib/studio/repeat";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;
type Board = (board: Artboard) => Promise<(x: number, y: number) => number[]>;

const LIT = 200;
const DARK = 60;
const BOARD_SIZE = 400;
const OFFSET_PX = 54;
const OFFSET_MS = 1000;
const SIDE = 0.25;
const REPEAT_STEP_PX = 270;
const REPEAT_SIDE = 0.05;
const FADE_TOLERANCE = 30;

interface Sample {
  name: string;
  got: number;
  lit: boolean;
}

function pixelOf(frame: Uint8Array, width: number, step: number, x: number, y: number): number {
  const columns = Math.ceil(width / step);
  return frame[(Math.floor(y / step) * columns + Math.floor(x / step)) * 3];
}

function verdict(samples: readonly Sample[]): { samples: string; wrong: string } {
  return {
    samples: samples.map((sample) => `${sample.name}=${sample.got}`).join("; "),
    wrong: samples.filter((sample) => (sample.lit ? sample.got < LIT : sample.got > DARK)).map((sample) => sample.name).join(","),
  };
}

function same(a: readonly Uint8Array[], b: readonly Uint8Array[]): boolean {
  return a.length === b.length && a.every((frame, i) => frame.length === b[i].length && frame.every((value, k) => value === b[i][k]));
}

function overlayFilm(layer: Layer, transform: Transform, extra: Partial<ReturnType<typeof newOverlayClip>> = {}): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newOverlayClip(layer, 0, 1500, transform), id: "shape", ...extra }] }];
  doc.durationMs = 1500;
  return doc;
}

function whiteSquare(pathOps?: PathOp[]): Layer {
  return { ...newShapeLayer("rect", { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }), id: "sq", fill: "#ffffff", ...(pathOps ? { pathOps } : {}) };
}

async function keyedOffset(frames: Frames, step: number) {
  const grow = { ...newPathOp("offset"), id: "grow", amount: 0, join: "miter" as const, keyframes: { amount: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: OFFSET_MS, value: OFFSET_PX, easing: "linear" as const }] } } as PathOp;
  const doc = overlayFilm(whiteSquare([grow]), { x: 0.5, y: 0.5, w: SIDE, h: SIDE, rotation: 0, opacity: 1 });
  const { width, height } = videoCanvasSize(doc);
  const times = [0, OFFSET_MS];
  const first = await frames(doc, width, height, times);
  const second = await frames(doc, width, height, times);
  const edge = width / 2 + (SIDE * width) / 2;
  const outside = edge + OFFSET_PX / 2;
  const samples: Sample[] = [
    { name: "insideAtStart", got: pixelOf(first[0], width, step, width / 2, height / 2), lit: true },
    { name: "outsideAtStart", got: pixelOf(first[0], width, step, outside, height / 2), lit: false },
    { name: "grownAtEnd", got: pixelOf(first[1], width, step, outside, height / 2), lit: true },
    { name: "pastGrowthAtEnd", got: pixelOf(first[1], width, step, edge + OFFSET_PX + 12, height / 2), lit: false },
  ];
  return { ...verdict(samples), sameTwice: same(first, second) };
}

function boardWith(layer: Layer): Artboard {
  return { ...emptyArtboard({ width: BOARD_SIZE, height: BOARD_SIZE }, "#0000ff"), layers: [layer] };
}

function boardSquare(pathOps: PathOp[]): Layer {
  return { ...newShapeLayer("rect", { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }), id: "card", fill: "#ffffff", pathOps };
}

async function zigZagAndMerge(board: Board) {
  const zig = await board(boardWith(boardSquare([{ ...newPathOp("zigZag"), id: "zig", size: 20, ridges: 1, points: "corner" } as PathOp])));
  const holed = await board(boardWith(boardSquare([{ ...newPathOp("merge"), id: "hole", mode: "subtract", path: MERGE_OPERAND_PATHS.ellipse, w: 0.3, h: 0.3 } as PathOp])));
  const again = await board(boardWith(boardSquare([{ ...newPathOp("zigZag"), id: "zig", size: 20, ridges: 1, points: "corner" } as PathOp])));
  const samples: Sample[] = [
    { name: "zigPeak", got: zig(200, 86)[0], lit: true },
    { name: "zigNotch", got: zig(150, 95)[0], lit: false },
    { name: "zigCenter", got: zig(200, 200)[0], lit: true },
    { name: "mergeHole", got: holed(200, 200)[0], lit: false },
    { name: "mergeRing", got: holed(200, 250)[0], lit: true },
    { name: "mergeOutside", got: holed(200, 320)[0], lit: false },
  ];
  const repeatable = [[200, 86], [150, 95], [120, 120]].every(([x, y]) => zig(x, y).every((value, i) => value === again(x, y)[i]));
  return { ...verdict(samples), sameTwice: repeatable };
}

export async function pathOpParity(frames: Frames, step: number, board: Board): Promise<Record<string, unknown>> {
  const offset = await keyedOffset(frames, step);
  const shapes = await zigZagAndMerge(board);
  return { offset, shapes, pathOpsOk: offset.wrong === "" && offset.sameTwice && shapes.wrong === "" && shapes.sameTwice };
}

export async function repeaterParity(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const repeat: ClipRepeat = { mode: "linear", copies: 3, x: REPEAT_STEP_PX, startOpacity: 1, endOpacity: 0.5, keyframes: { shift: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: OFFSET_MS, value: 1, easing: "linear" }] } };
  const transform = { x: 0.2, y: 0.5, w: REPEAT_SIDE, h: REPEAT_SIDE, rotation: 0, opacity: 1 };
  const doc = overlayFilm(whiteSquare(), transform, { repeat });
  const { width, height } = videoCanvasSize(doc);
  const times = [0, OFFSET_MS];
  const first = await frames(doc, width, height, times);
  const second = await frames(doc, width, height, times);
  const half = (REPEAT_SIDE * width) / 2;
  const box = { left: transform.x * width - half, top: transform.y * height - half, right: transform.x * width + half, bottom: transform.y * height + half };
  const centers = (shift: number) => repeatCopies({ ...repeat, keyframes: undefined, shift }, box).map((copy) => ({ ...placeBy(copy.place, { x: transform.x * width, y: transform.y * height, rotation: 0, flipX: false }), opacity: copy.opacity }));
  const atStart = centers(0);
  const atEnd = centers(1);
  const copyLevel = (frame: Uint8Array, copy: { x: number; y: number; opacity: number }) => Math.abs(pixelOf(frame, width, step, copy.x, copy.y) - Math.round(255 * copy.opacity));
  const levels = [...atStart.map((copy) => copyLevel(first[0], copy)), ...atEnd.map((copy) => copyLevel(first[1], copy))];
  const samples: Sample[] = [
    { name: "startGap", got: pixelOf(first[0], width, step, (atStart[0].x + atStart[1].x) / 2, atStart[0].y), lit: false },
    { name: "endLeftBehind", got: pixelOf(first[1], width, step, atStart[0].x, atStart[0].y), lit: false },
  ];
  const result = verdict(samples);
  const fadeOk = levels.every((miss) => miss <= FADE_TOLERANCE);
  return { ...result, copyMisses: levels.join(","), sameTwice: same(first, second), repeaterOk: result.wrong === "" && fadeOk && same(first, second) };
}
