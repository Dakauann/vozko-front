import type { Behavior } from "@/lib/studio/behaviors";
import { anchorAt } from "@/lib/studio/clip-placement";
import { canvasAspect, emptyVideoDocument, newMediaClip, videoCanvasSize, type Clip, type Transform, type VideoDocument } from "@/lib/studio/document";
import { clipLookup, worldPlacementAt } from "@/lib/studio/parenting";
import { noise1 } from "@/lib/studio/vfx";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;

const DURATION_MS = 2000;
const TIMES = [0, 400, 900, 1400, 1900] as const;
const TURN = 60;
const LOOP_MS = 1000;
const WIGGLE: Behavior = { id: "shake", kind: "wiggle", property: "x", frequency: 2.5, amount: 0.04, seed: 321 };
const WIGGLE_CHANNEL = 100;
const BASE_X = 0.5;
const EDGE_PX = 4;
const TOLERANCE = 12;
const MATH_DRIFT_LIMIT = 1e-9;
const QUADRANTS = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 255],
];

function film(): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.canvas.background = "#000000";
  const side = 0.22;
  const clip: Clip = {
    ...newMediaClip("image", "quad.png", 0, DURATION_MS),
    id: "behaved",
    transform: { x: BASE_X, y: 0.5, w: side, h: side * canvasAspect(doc), rotation: 0, opacity: 1 },
    keyframes: {
      rotation: [
        { atMs: 0, value: 0, easing: "linear" },
        { atMs: LOOP_MS, value: TURN, easing: "linear" },
      ],
    },
    behaviors: [WIGGLE, { id: "rock", kind: "loop", property: "rotation", mode: "pingpong", side: "out" }],
  };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [clip] }];
  doc.durationMs = DURATION_MS;
  return doc;
}

function wiggleByHand(ms: number): number {
  if (WIGGLE.kind !== "wiggle") return 0;
  const t = (ms / 1000) * WIGGLE.frequency;
  return WIGGLE.amount * (noise1(WIGGLE.seed, WIGGLE_CHANNEL, t) * 0.7 + noise1(WIGGLE.seed, WIGGLE_CHANNEL + 16, t * 2.3) * 0.3);
}

function rotationByHand(ms: number): number {
  if (ms <= LOOP_MS) return (TURN * ms) / LOOP_MS;
  const distance = ms - LOOP_MS;
  const turns = Math.floor(distance / LOOP_MS);
  const phase = distance - turns * LOOP_MS;
  return turns % 2 === 0 ? (TURN * (LOOP_MS - phase)) / LOOP_MS : (TURN * phase) / LOOP_MS;
}

function byHand(base: Transform, ms: number): Transform {
  return { ...base, x: BASE_X + wiggleByHand(ms), rotation: rotationByHand(ms) };
}

function quadrantAt(u: number, v: number): number[] {
  return QUADRANTS[(v < 0.5 ? 0 : 2) + (u < 0.5 ? 0 : 1)];
}

function edgeDistancePx(local: { x: number; y: number }, inside: boolean, boxW: number, boxH: number): number {
  if (!inside) return Math.hypot(Math.max(0, -local.x, local.x - 1) * boxW, Math.max(0, -local.y, local.y - 1) * boxH);
  return Math.min(...[0, 0.5, 1].map((edge) => Math.abs(local.x - edge) * boxW), ...[0, 0.5, 1].map((edge) => Math.abs(local.y - edge) * boxH));
}

function sameFrames(first: readonly Uint8Array[], second: readonly Uint8Array[]): number {
  let differing = 0;
  first.forEach((frame, index) => {
    const other = second[index];
    if (!other || other.length !== frame.length || frame.some((value, i) => value !== other[i])) differing += 1;
  });
  return differing + Math.abs(first.length - second.length);
}

export async function behaviorParity(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const doc = film();
  const aspect = canvasAspect(doc);
  const { width, height } = videoCanvasSize(doc);
  const lookup = clipLookup(doc);
  const clip = lookup.get("behaved")!;
  const rendered = await frames(doc, width, height, TIMES);
  const again = await frames(doc, width, height, TIMES);
  const columns = Math.ceil(width / step);
  let checked = 0;
  let wrong = 0;
  let worst = 0;
  let mathDrift = 0;
  let firstWrong: string | null = null;
  rendered.forEach((frame, index) => {
    const ms = TIMES[index];
    const shared = worldPlacementAt(lookup, clip, ms, aspect);
    const expected = byHand(clip.transform, ms);
    mathDrift = Math.max(mathDrift, ...(["x", "y", "w", "h", "rotation"] as const).map((key) => Math.abs(shared[key] - expected[key])));
    const boxW = expected.w * width;
    const boxH = expected.h * height;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const local = anchorAt(expected, { x: (x + 0.5) / width, y: (y + 0.5) / height }, aspect);
        const inside = local.x > 0 && local.x < 1 && local.y > 0 && local.y < 1;
        if (edgeDistancePx(local, inside, boxW, boxH) < EDGE_PX) continue;
        const want = inside ? quadrantAt(local.x, local.y) : [0, 0, 0];
        const i = ((y / step) * columns + x / step) * 3;
        const got = [frame[i], frame[i + 1], frame[i + 2]];
        const diff = Math.max(...got.map((value, c) => Math.abs(value - want[c])));
        checked += 1;
        worst = Math.max(worst, diff);
        if (diff <= TOLERANCE) continue;
        wrong += 1;
        firstWrong ??= `frame at ${ms} ms, pixel ${x},${y}: got ${got.join(",")} expected ${want.join(",")}`;
      }
    }
  });
  const differingFrames = sameFrames(rendered, again);
  const moved = new Set(TIMES.map((ms) => worldPlacementAt(lookup, clip, ms, aspect).x.toFixed(6))).size;
  return {
    frames: rendered.length,
    checked,
    wrong,
    worst,
    firstWrong,
    mathDrift,
    differingFrames,
    distinctPositions: moved,
    behaviorsOk: rendered.length === TIMES.length && checked > 0 && wrong === 0 && mathDrift <= MATH_DRIFT_LIMIT && moved > 1,
    repeatOk: rendered.length === TIMES.length && differingFrames === 0,
  };
}
