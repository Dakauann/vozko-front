import { ensureFont } from "@/components/studio/canvas/ensure-font";
import { rasterizeRegion } from "@/components/studio/canvas/rasterize";
import { emptyArtboard, emptyVideoDocument, newMediaClip, VIDEO_ASPECT_SIZES, type Artboard, type Layer, type VideoDocument } from "@/lib/studio/document";
import { DEFAULT_FONT_ID } from "@/lib/studio/fonts";
import { fillFrame } from "@/lib/studio/frame-fill";
import { FRAMES_CATEGORY } from "@/lib/studio/library/builtin/frames";
import { STICKERS_CATEGORY } from "@/lib/studio/library/builtin/stickers";
import { frameWithItem } from "@/lib/studio/library/framing";
import { imageContent, videoClips, type LibraryRequest } from "@/lib/studio/library/instantiate";
import { LIBRARY_INK, type LibraryItem } from "@/lib/studio/library/model";
import { lastFrameMs } from "@/lib/studio/library/sticker-still";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;
type Board = (board: Artboard) => Promise<(x: number, y: number) => number[]>;

const SIDE = VIDEO_ASPECT_SIZES.square.width;
const PHOTO = "quad.png";
const QUAD = { width: 512, height: 512 };
const EDGE_PX = 4;
const TOLERANCE = 12;
const STICKER_SIDE = VIDEO_ASPECT_SIZES.square.width;
const STICKER_TOLERANCE = 48;
const MAX_STICKER_MISS = 0.015;
const MIN_INK_SHARE = 0.002;
const BLACK = "#000000";

const QUADRANTS = { topLeft: [255, 0, 0], topRight: [0, 255, 0], bottomLeft: [0, 0, 255], bottomRight: [255, 255, 255] } as const;

function request(side: number, colors: LibraryRequest["colors"] = []): LibraryRequest {
  return { canvas: { width: side, height: side }, locale: "pt", text: (slot) => ("text" in slot.sample ? slot.sample.text.pt : slot.sample.key), colors };
}

function itemOf(items: readonly LibraryItem[], id: string): LibraryItem {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`missing library item ${id}`);
  return item;
}

function expectedInCircle(x: number, y: number, center: number, radius: number): number[] | null {
  const distance = Math.hypot(x + 0.5 - center, y + 0.5 - center);
  if (Math.abs(distance - radius) < EDGE_PX || Math.abs(x + 0.5 - center) < EDGE_PX || Math.abs(y + 0.5 - center) < EDGE_PX) return null;
  if (distance > radius) return [0, 0, 0];
  const top = y + 0.5 < center;
  const left = x + 0.5 < center;
  return [...(top ? (left ? QUADRANTS.topLeft : QUADRANTS.topRight) : left ? QUADRANTS.bottomLeft : QUADRANTS.bottomRight)];
}

function differs(got: readonly number[], want: readonly number[], tolerance: number): boolean {
  return got.some((value, i) => Math.abs(value - want[i]) > tolerance);
}

function filledCircleBoard(): { board: Artboard; radius: number; center: number } {
  const frame = itemOf(FRAMES_CATEGORY.items() as readonly LibraryItem[], "frame-circle");
  const content = imageContent(frame, request(SIDE))!;
  const board: Artboard = { ...emptyArtboard({ width: SIDE, height: SIDE }, BLACK), layers: content.layers };
  const filled = fillFrame(board, { frameId: content.layers[0].id }, PHOTO, QUAD);
  if (!filled.ok) throw new Error(`the circle frame could not be filled: ${filled.reason}`);
  const slot = content.layers[0].transform;
  return { board: { ...board, ...filled.document } as Artboard, radius: (slot.w * SIDE) / 2, center: slot.x * SIDE };
}

function circleFilm(): VideoDocument {
  const doc = emptyVideoDocument("square", BLACK);
  const clip = { ...newMediaClip("image", PHOTO, 0, 1000), id: "photo" };
  const film: VideoDocument = { ...doc, durationMs: 1000, tracks: [{ id: "v", kind: "visual", clips: [clip] }] };
  const framed = frameWithItem(film, itemOf(FRAMES_CATEGORY.items() as readonly LibraryItem[], "frame-circle"), ["photo"]);
  if (!framed?.ok) throw new Error("the circle frame could not mask the clip");
  return framed.document;
}

export async function frameParity(frames: Frames, board: Board, step: number): Promise<Record<string, unknown>> {
  const { board: filled, radius, center } = filledCircleBoard();
  const gpu = await board(filled);
  const exported = (await rasterizeRegion(filled.layers, SIDE, SIDE, { x: 0, y: 0, width: SIDE, height: SIDE }, { background: BLACK })).getContext("2d")!.getImageData(0, 0, SIDE, SIDE).data;
  const [video] = await frames(circleFilm(), SIDE, SIDE, [500]);
  const columns = Math.ceil(SIDE / step);
  let checked = 0;
  const wrong = { gpu: 0, export: 0, video: 0 };
  let firstWrong: string | null = null;
  for (let y = 0; y < SIDE; y += step) {
    for (let x = 0; x < SIDE; x += step) {
      const want = { gpu: expectedInCircle(x, y, center, radius), export: expectedInCircle(x, y, center, radius), video: expectedInCircle(x, y, SIDE / 2, SIDE / 2) };
      const i = (y * SIDE + x) * 4;
      const v = ((y / step) * columns + x / step) * 3;
      const got = { gpu: gpu(x, y), export: Array.from(exported.slice(i, i + 3)), video: Array.from(video.slice(v, v + 3)) };
      for (const key of ["gpu", "export", "video"] as const) {
        const expected = want[key];
        if (!expected) continue;
        checked += 1;
        if (!differs(got[key], expected, TOLERANCE)) continue;
        wrong[key] += 1;
        firstWrong ??= `${key} at ${x},${y}: got ${got[key].join(",")} expected ${expected.join(",")}`;
      }
    }
  }
  return { checked, ...wrong, firstWrong, frameOk: checked > 0 && wrong.gpu === 0 && wrong.export === 0 && wrong.video === 0 };
}

const STICKER_SLOT_MS = 3000;

function stickerFilm(items: readonly LibraryItem[]): { doc: VideoDocument; times: number[] } {
  const doc = emptyVideoDocument("square", BLACK);
  const tracks: VideoDocument["tracks"] = [];
  const times = items.map((item, index) => {
    const startMs = index * STICKER_SLOT_MS;
    const clips = videoClips(item, { ...request(STICKER_SIDE), atMs: startMs, documentMs: 0 })!;
    clips.forEach((clip) => tracks.push({ id: `s${tracks.length}`, kind: "visual", clips: [clip] }));
    return startMs + lastFrameMs(Math.max(...clips.map((clip) => clip.durationMs)));
  });
  return { doc: { ...doc, durationMs: items.length * STICKER_SLOT_MS, tracks }, times };
}

function stillBoard(item: LibraryItem): Artboard {
  const content = imageContent(item, request(STICKER_SIDE, [{ from: LIBRARY_INK.image, to: LIBRARY_INK.video }]))!;
  return { ...emptyArtboard({ width: STICKER_SIDE, height: STICKER_SIDE }, BLACK), layers: content.layers as Layer[], ...(content.groups ? { groups: content.groups } : {}) };
}

export async function stickerParity(frames: Frames, board: Board, step: number): Promise<Record<string, unknown>> {
  await Promise.all([700, 900].map((weight) => ensureFont(DEFAULT_FONT_ID, weight, false)));
  const columns = Math.ceil(STICKER_SIDE / step);
  const misses: Record<string, number> = {};
  const empty: string[] = [];
  let worst = 0;
  const items = STICKERS_CATEGORY.items() as readonly LibraryItem[];
  const started = performance.now();
  const film = stickerFilm(items);
  const rendered = await frames(film.doc, STICKER_SIDE, STICKER_SIDE, film.times);
  for (const [index, item] of items.entries()) {
    const video = rendered[index];
    const still = await board(stillBoard(item));
    let checked = 0;
    let missed = 0;
    let ink = 0;
    for (let y = 0; y < STICKER_SIDE; y += step) {
      for (let x = 0; x < STICKER_SIDE; x += step) {
        const v = ((y / step) * columns + x / step) * 3;
        const got = Array.from(video.slice(v, v + 3));
        checked += 1;
        if (got.some((value) => value > 40)) ink += 1;
        if (differs(got, still(x, y), STICKER_TOLERANCE)) missed += 1;
      }
    }
    const share = missed / checked;
    worst = Math.max(worst, share);
    if (share > MAX_STICKER_MISS) misses[item.id] = Number(share.toFixed(4));
    if (ink / checked < MIN_INK_SHARE) empty.push(item.id);
  }
  return { stickers: items.length, ms: Math.round(performance.now() - started), worst: Number(worst.toFixed(4)), misses, empty, stickerOk: Object.keys(misses).length === 0 && empty.length === 0 };
}
