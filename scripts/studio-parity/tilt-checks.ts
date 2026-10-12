import { sceneLens, tiltMatrix } from "@/lib/studio/clip-tilt";
import { emptyVideoDocument, newMediaClip, newTextLayer, type Clip, type VideoDocument } from "@/lib/studio/document";
import { overlayClip } from "@/lib/studio/media-clips";
import { invertHomography, lensOf, pieceQuad, projectHomography, type Homography } from "@/lib/studio/perspective";
import { visualPlan } from "@/lib/studio/playback";
import { newRangeSelector } from "@/lib/studio/text-animator";
import type { AnimatorProperties, RangeSelector, TextUnitAnimator } from "@/lib/studio/text-selectors";

type Frames = (doc: VideoDocument, width: number, height: number, times?: readonly number[]) => Promise<Uint8Array[]>;
type Rgb = readonly [number, number, number];

const SIZE = 1080;
const TOLERANCE = 8;
const EDGE_MARGIN = 0.04;
const MIN_CHECKED = 2000;
const BACKGROUND: Rgb = [16, 16, 16];
const QUADRANTS: readonly Rgb[] = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 255],
];
const TEXT = "M M M M";
const LETTERS = 4;
const LIT = 96;
const RATIO_TOLERANCE = 0.08;
const BOX = { x: 0.5, y: 0.5, w: 0.9, h: 0.3, rotation: 0, opacity: 1 };

interface ClipCase {
  name: string;
  patch: Partial<Clip>;
  perspective?: number;
}

const CLIP_CASES: readonly ClipCase[] = [
  { name: "y45", patch: { rotationY: 45 } },
  { name: "x30Hinge", patch: { rotationX: 30, rotationY: -20, anchor: { x: 0.5, y: 0 } }, perspective: 70 },
];

function pictureFilm(item: ClipCase): VideoDocument {
  const doc = emptyVideoDocument("square", "#101010");
  if (item.perspective !== undefined) doc.canvas.perspective = item.perspective;
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "quad.png", 0, 200), id: "card", fit: "cover", transform: { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }, ...item.patch }] }];
  doc.durationMs = 200;
  return doc;
}

function at(frame: Uint8Array, step: number, x: number, y: number): Rgb {
  const i = (Math.floor(y / step) * Math.ceil(SIZE / step) + Math.floor(x / step)) * 3;
  return [frame[i], frame[i + 1], frame[i + 2]];
}

function expectedAt(unproject: Homography, box: { left: number; top: number; width: number; height: number }, x: number, y: number): Rgb | null {
  const plane = projectHomography(unproject, { x, y });
  if (!plane) return BACKGROUND;
  const u = (plane.x - box.left) / box.width;
  const v = (plane.y - box.top) / box.height;
  if (u < -EDGE_MARGIN || u > 1 + EDGE_MARGIN || v < -EDGE_MARGIN || v > 1 + EDGE_MARGIN) return BACKGROUND;
  if (Math.abs(u - 0.5) < EDGE_MARGIN || Math.abs(v - 0.5) < EDGE_MARGIN || u < EDGE_MARGIN || v < EDGE_MARGIN || u > 1 - EDGE_MARGIN || v > 1 - EDGE_MARGIN) return null;
  return QUADRANTS[(v < 0.5 ? 0 : 2) + (u < 0.5 ? 0 : 1)];
}

async function clipCase(frames: Frames, step: number, item: ClipCase): Promise<{ checked: number; wrong: number; flatWouldMiss: number; firstWrong: string | null }> {
  const doc = pictureFilm(item);
  const plan = visualPlan(doc, 0)[0];
  const t = plan.transform;
  const drawn = { x: t.x * SIZE, y: t.y * SIZE, width: t.w * SIZE, height: t.h * SIZE, rotation: t.rotation };
  const unproject = invertHomography(tiltMatrix(sceneLens(doc.canvas, { width: SIZE, height: SIZE }), drawn, plan.tilt!))!;
  const box = { left: drawn.x - drawn.width / 2, top: drawn.y - drawn.height / 2, width: drawn.width, height: drawn.height };
  const flat = invertHomography([1, 0, 0, 0, 1, 0, 0, 0, 1])!;
  const [shown] = await frames(doc, SIZE, SIZE, [0]);
  const report = { checked: 0, wrong: 0, flatWouldMiss: 0, firstWrong: null as string | null };
  for (let y = 0; y < SIZE; y += step) {
    for (let x = 0; x < SIZE; x += step) {
      const want = expectedAt(unproject, box, x + 0.5, y + 0.5);
      if (!want) continue;
      const got = at(shown, step, x, y);
      report.checked += 1;
      const plain = expectedAt(flat, box, x + 0.5, y + 0.5);
      if (plain && plain.some((value, c) => Math.abs(value - want[c]) > TOLERANCE)) report.flatWouldMiss += 1;
      if (got.every((value, c) => Math.abs(value - want[c]) <= TOLERANCE)) continue;
      report.wrong += 1;
      report.firstWrong ??= `${item.name} pixel ${x},${y}: got ${got.join(",")} expected ${want.join(",")}`;
    }
  }
  return report;
}

function textFilm(properties: AnimatorProperties | null, selector: Partial<RangeSelector>, perspective?: number): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  if (perspective !== undefined) doc.canvas.perspective = perspective;
  const layer = { ...newTextLayer(TEXT), id: "l-flip", fontId: "roboto" as const, fontWeight: 700, fontSize: 0.12, fill: "#ffffff", align: "center" as const };
  const animator: TextUnitAnimator | null = properties ? { id: "flip", unit: "char", properties, selector: { ...newRangeSelector(1), ...selector } } : null;
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...overlayClip(layer, 0, BOX), id: "flip", startMs: 0, durationMs: 200, ...(animator ? { textAnimators: [animator] } : {}) }] }];
  doc.durationMs = 200;
  return doc;
}

interface Letter {
  left: number;
  right: number;
  top: number;
  bottom: number;
  ink: number;
}

function letters(frame: Uint8Array, columns: number): Letter[] {
  const lit = (x: number, y: number) => frame[(y * columns + x) * 3] > LIT;
  const found: Letter[] = [];
  for (let x = 0; x < columns; x++) {
    let ink = 0;
    let top = columns;
    let bottom = -1;
    for (let y = 0; y < columns; y++) {
      if (!lit(x, y)) continue;
      ink += 1;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    if (ink === 0) continue;
    const last = found[found.length - 1];
    if (last && last.right === x - 1) Object.assign(last, { right: x, top: Math.min(last.top, top), bottom: Math.max(last.bottom, bottom), ink: last.ink + ink });
    else found.push({ left: x, right: x, top, bottom, ink });
  }
  return found;
}

function inside(spans: readonly Letter[], letter: Letter): number {
  return spans.findIndex((span) => letter.left + letter.right >= 2 * span.left - 2 && letter.left + letter.right <= 2 * span.right + 2);
}

function ratio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export async function tiltParity(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const cases: Record<string, unknown> = {};
  let clipOk = true;
  for (const item of CLIP_CASES) {
    const result = await clipCase(frames, step, item);
    cases[item.name] = result;
    clipOk &&= result.checked >= MIN_CHECKED / (step * step) && result.wrong === 0 && result.flatWouldMiss > 0;
  }
  const columns = Math.ceil(SIZE / step);
  const [plain] = await frames(textFilm(null, {}), SIZE, SIZE, [0]);
  const base = letters(plain, columns);
  const [hidden] = await frames(textFilm({ rotationY: 90 }, { units: "index", end: 2 }, 0), SIZE, SIZE, [0]);
  const shownLetters = letters(hidden, columns).map((letter) => inside(base, letter));
  const hiddenOk = base.length === LETTERS && !shownLetters.includes(0) && !shownLetters.includes(1) && shownLetters.includes(2) && shownLetters.includes(3);
  const flat = lensOf(0, SIZE, SIZE);
  const squash = (tilt: { rotationX?: number; rotationY?: number }) => {
    const quad = pieceQuad({ x: 0, y: 0, width: 1, height: 1, rotation: 0, ...tilt }, [1, 0, 0, 1, 0, 0], flat)!;
    return { x: Math.abs(quad[1].x - quad[0].x), y: Math.abs(quad[3].y - quad[0].y) };
  };
  const [narrow] = await frames(textFilm({ rotationY: 60 }, {}, 0), SIZE, SIZE, [0]);
  const [short] = await frames(textFilm({ rotationX: 60 }, {}, 0), SIZE, SIZE, [0]);
  const widths = letters(narrow, columns).map((letter, i) => (base[i] ? (letter.right - letter.left + 1) / (base[i].right - base[i].left + 1) : 0));
  const heights = letters(short, columns).map((letter, i) => (base[i] ? (letter.bottom - letter.top + 1) / (base[i].bottom - base[i].top + 1) : 0));
  const wantWidth = squash({ rotationY: 60 }).x;
  const wantHeight = squash({ rotationX: 60 }).y;
  const flipOk = base.length === LETTERS && widths.length === LETTERS && heights.length === LETTERS && widths.every((value) => Math.abs(value - wantWidth) <= RATIO_TOLERANCE) && heights.every((value) => Math.abs(value - wantHeight) <= RATIO_TOLERANCE);
  return { ...cases, letters: base.length, shownLetters: shownLetters.join(" "), widths: widths.map(ratio).join(" "), wantWidth: ratio(wantWidth), heights: heights.map(ratio).join(" "), wantHeight: ratio(wantHeight), clipOk, hiddenOk, flipOk, tiltOk: clipOk && hiddenOk && flipOk };
}
