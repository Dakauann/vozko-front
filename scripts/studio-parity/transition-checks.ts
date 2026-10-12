import { edgeThumbnails, cutThumbnails } from "@/components/studio/video/panels/transition-thumbnails";
import { emptyVideoDocument, newShapeLayer, type Clip, type Transform, type VideoDocument } from "@/lib/studio/document";
import { EDGE_TRANSITION_KINDS } from "@/lib/studio/edge-transitions";
import { overlayClip } from "@/lib/studio/media-clips";
import { revealCoverage, revealValue } from "@/lib/studio/reveal-field";
import { transitionLook } from "@/lib/studio/transition-effects";
import { edgeSample, transitionSample } from "@/lib/studio/transition-samples";
import { addTransition, findTransition, TRANSITION_KINDS, type TransitionInput } from "@/lib/studio/transitions";
import { EFFECT_SAMPLE_SIZE } from "@/lib/studio/vfx-samples";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;
type Still = (doc: VideoDocument, atMs: number, width: number, height: number) => Promise<Uint8Array>;
type Decode = (url: string, width: number, height: number) => Promise<Uint8Array>;
type Report = Record<string, unknown>;

const SIZE = 1080;
const TOLERANCE = 8;
const EDGE_MARGIN = 0.03;
const GRID_PX = 40;
const CUT_MS = 1000;
const RED = [255, 0, 0];
const BLUE = [0, 0, 255];
const BLACK = [0, 0, 0];
const FULL: Transform = { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 };
const HALF: Transform = { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 };

function swatch(id: string, fill: string, startMs: number, transform: Transform = FULL): Clip {
  return { ...overlayClip({ ...newShapeLayer("rect"), id: `l-${id}`, fill }, 0, transform), id, startMs, durationMs: CUT_MS };
}

function film(clips: Clip[], durationMs: number): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  doc.tracks = [{ id: "v1", kind: "visual", clips }];
  doc.durationMs = durationMs;
  return doc;
}

function cut(input: Omit<TransitionInput, "fromClipId" | "toClipId">): VideoDocument {
  const placed = addTransition(film([swatch("red", "#ff0000", 0), swatch("blue", "#0000ff", CUT_MS)], 2 * CUT_MS), { fromClipId: "red", toClipId: "blue", durationMs: 600, easing: "linear", ...input });
  if (!placed.ok) throw new Error(placed.reason);
  return placed.document;
}

function pixelAt(frame: Uint8Array, step: number, x: number, y: number): number[] {
  const columns = Math.ceil(SIZE / step);
  const i = (Math.floor(y / step) * columns + Math.floor(x / step)) * 3;
  return [frame[i], frame[i + 1], frame[i + 2]];
}

function near(got: number[], want: number[]): boolean {
  return got.every((value, i) => Math.abs(value - want[i]) <= TOLERANCE);
}

async function fieldMatch(frames: Frames, step: number, input: Omit<TransitionInput, "fromClipId" | "toClipId">): Promise<{ checked: number; wrong: number; firstWrong: string | null }> {
  const doc = cut(input);
  const transition = doc.tracks[0].transitions![0];
  const reveal = transitionLook(findTransition(doc, transition.id)!.transition, "to", 0.5, false).reveal;
  if (reveal?.kind !== "field") throw new Error(`${input.kind} has no field reveal`);
  const [frame] = await frames(doc, SIZE, SIZE, [CUT_MS]);
  let checked = 0;
  let wrong = 0;
  let firstWrong: string | null = null;
  for (let y = 0; y < SIZE; y += GRID_PX) {
    for (let x = 0; x < SIZE; x += GRID_PX) {
      const value = revealValue(reveal.field, { u: (x + 0.5) / SIZE, v: (y + 0.5) / SIZE, width: SIZE, height: SIZE });
      if (Math.abs(value - reveal.progress) < EDGE_MARGIN) continue;
      const want = revealCoverage(value, reveal.progress, reveal.softness) >= 0.5 ? BLUE : RED;
      const got = pixelAt(frame, step, x, y);
      checked += 1;
      if (near(got, want)) continue;
      wrong += 1;
      firstWrong ??= `${input.kind} at ${x},${y}: got ${got.join(",")} expected ${want.join(",")}`;
    }
  }
  return { checked, wrong, firstWrong };
}

export async function edgeTransitionParity(frames: Frames, step: number): Promise<Report> {
  const boxed = film([{ ...swatch("logo", "#ff0000", 0, HALF), transitionIn: { kind: "wipe", durationMs: CUT_MS, easing: "linear", angle: 0 } }], CUT_MS);
  const [entering] = await frames(boxed, SIZE, SIZE, [250]);
  const inside = pixelAt(entering, step, SIZE * 0.3, SIZE / 2);
  const ahead = pixelAt(entering, step, SIZE * 0.45, SIZE / 2);
  const outside = pixelAt(entering, step, SIZE * 0.1, SIZE / 2);
  const closing = film([{ ...swatch("cover", "#0000ff", 0), transitionOut: { kind: "iris", durationMs: CUT_MS, easing: "linear" } }], CUT_MS);
  const [leaving] = await frames(closing, SIZE, SIZE, [500]);
  const middle = pixelAt(leaving, step, SIZE / 2, SIZE / 2);
  const corner = pixelAt(leaving, step, SIZE * 0.05, SIZE * 0.05);
  const fields = [
    await fieldMatch(frames, step, { kind: "venetianBlinds", angle: 30, size: 0.1, softness: 0 }),
    await fieldMatch(frames, step, { kind: "blockDissolve", size: 0.08, softness: 0 }),
    await fieldMatch(frames, step, { kind: "radialWipe", angle: 45, originX: 0.3, originY: 0.6, softness: 0 }),
    await fieldMatch(frames, step, { kind: "gradientWipe", map: "clouds", softness: 0 }),
    await fieldMatch(frames, step, { kind: "gradientWipe", map: "diamond", originX: 0.7, softness: 0 }),
  ];
  const [mapped] = await frames(cut({ kind: "gradientWipe", mapAssetId: "quad.png", softness: 0 }), SIZE, SIZE, [CUT_MS]);
  const quadrants = [pixelAt(mapped, step, SIZE / 4, SIZE / 4), pixelAt(mapped, step, (SIZE * 3) / 4, SIZE / 4), pixelAt(mapped, step, SIZE / 4, (SIZE * 3) / 4), pixelAt(mapped, step, (SIZE * 3) / 4, (SIZE * 3) / 4)];
  return {
    entering: [inside, ahead, outside].map((value) => value.join(",")).join(" | "),
    leaving: [middle, corner].map((value) => value.join(",")).join(" | "),
    fields: fields.map((field) => `${field.wrong}/${field.checked}`).join("; "),
    firstWrong: fields.find((field) => field.firstWrong)?.firstWrong ?? null,
    quadrants: quadrants.map((value) => value.join(",")).join(" | "),
    boxOk: near(inside, RED) && near(ahead, BLACK) && near(outside, BLACK),
    inverseOk: near(middle, BLACK) && near(corner, BLUE),
    fieldsOk: fields.every((field) => field.checked > 0 && field.wrong === 0),
    imageMapOk: near(quadrants[0], BLUE) && near(quadrants[1], RED) && near(quadrants[2], BLUE) && near(quadrants[3], RED),
  };
}

function differs(pixels: Uint8Array, plain: Uint8Array, change: number): boolean {
  return pixels.some((value, i) => Math.abs(value - plain[i]) > change);
}

export async function transitionPreviewParity(still: Still, decode: Decode, change: number): Promise<Report> {
  const { width, height } = EFFECT_SAMPLE_SIZE;
  const cuts = await cutThumbnails();
  const edges = await edgeThumbnails();
  const sample = transitionSample("wipe").doc;
  const plain = { ...sample, tracks: sample.tracks.map((track) => ({ ...track, transitions: undefined })) };
  const from = await still(plain, 100, width, height);
  const to = await still(plain, 1900, width, height);
  const edge = edgeSample("wipe").doc;
  const backdrop = await still({ ...edge, tracks: edge.tracks.slice(0, 1) }, 100, width, height);
  const rest = await still(edge, 990, width, height);
  const missing: string[] = [];
  const flat: string[] = [];
  for (const kind of TRANSITION_KINDS) {
    const url = cuts.get(kind);
    if (!url) missing.push(`cut:${kind}`);
    else if (!(differs(await decode(url, width, height), from, change) && differs(await decode(url, width, height), to, change))) flat.push(`cut:${kind}`);
  }
  for (const kind of EDGE_TRANSITION_KINDS) {
    const url = edges.get(kind);
    if (!url) missing.push(`edge:${kind}`);
    else if (!(differs(await decode(url, width, height), backdrop, change) && differs(await decode(url, width, height), rest, change))) flat.push(`edge:${kind}`);
  }
  return { missing: missing.join(", "), flat: flat.join(", "), previewsOk: missing.length === 0 && flat.length === 0 && (await cutThumbnails()) === cuts };
}
