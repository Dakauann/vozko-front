import { anchorAt, placementAt } from "@/lib/studio/clip-placement";
import { canvasAspect, emptyVideoDocument, newMediaClip, newNullClip, videoCanvasSize, type Clip, type Transform, type VideoDocument } from "@/lib/studio/document";
import { clipLookup, worldPlacementAt } from "@/lib/studio/parenting";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;

const DURATION_MS = 1000;
const TIMES = [0, 250, 500, 750, 999] as const;
const TURN = 180;
const GROWTH = 0.5;
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
  const side = 0.14;
  const rig: Clip = {
    ...newNullClip(0, DURATION_MS, 0.5, 0.5),
    id: "rig",
    keyframes: {
      rotation: [
        { atMs: 0, value: 0, easing: "linear" },
        { atMs: DURATION_MS, value: TURN, easing: "linear" },
      ],
      scale: [
        { atMs: 0, value: 1, easing: "linear" },
        { atMs: DURATION_MS, value: 1 + GROWTH, easing: "linear" },
      ],
    },
  };
  const child: Clip = {
    ...newMediaClip("image", "quad.png", 0, DURATION_MS),
    id: "child",
    parentId: "rig",
    transform: { x: 0.72, y: 0.4, w: side, h: side * canvasAspect(doc), rotation: 15, opacity: 1 },
    anchor: { x: 0.2, y: 0.8 },
  };
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [child] },
    { id: "v2", kind: "visual", clips: [rig] },
  ];
  doc.durationMs = DURATION_MS;
  return doc;
}

function composedByHand(local: Transform, ms: number, aspect: number): Transform {
  const progress = ms / DURATION_MS;
  const turn = TURN * progress;
  const scale = 1 + GROWTH * progress;
  const radians = (turn * Math.PI) / 180;
  const dx = (local.x - 0.5) * aspect * scale;
  const dy = (local.y - 0.5) * scale;
  return {
    x: 0.5 + (dx * Math.cos(radians) - dy * Math.sin(radians)) / aspect,
    y: 0.5 + dx * Math.sin(radians) + dy * Math.cos(radians),
    w: local.w * scale,
    h: local.h * scale,
    rotation: local.rotation + turn,
    opacity: local.opacity,
  };
}

function quadrantAt(u: number, v: number): number[] {
  return QUADRANTS[(v < 0.5 ? 0 : 2) + (u < 0.5 ? 0 : 1)];
}

function edgeDistancePx(local: { x: number; y: number }, inside: boolean, boxW: number, boxH: number): number {
  if (!inside) return Math.hypot(Math.max(0, -local.x, local.x - 1) * boxW, Math.max(0, -local.y, local.y - 1) * boxH);
  return Math.min(...[0, 0.5, 1].map((edge) => Math.abs(local.x - edge) * boxW), ...[0, 0.5, 1].map((edge) => Math.abs(local.y - edge) * boxH));
}

export async function parentingParity(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const doc = film();
  const aspect = canvasAspect(doc);
  const { width, height } = videoCanvasSize(doc);
  const lookup = clipLookup(doc);
  const child = lookup.get("child")!;
  const rendered = await frames(doc, width, height, TIMES);
  const columns = Math.ceil(width / step);
  let checked = 0;
  let wrong = 0;
  let worst = 0;
  let mathDrift = 0;
  let firstWrong: string | null = null;
  rendered.forEach((frame, index) => {
    const ms = TIMES[index];
    const expected = composedByHand(placementAt(child, ms, aspect), ms, aspect);
    const shared = worldPlacementAt(lookup, child, ms, aspect);
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
  return { frames: rendered.length, checked, wrong, worst, firstWrong, mathDrift, parentingOk: rendered.length === TIMES.length && checked > 0 && wrong === 0 && mathDrift <= MATH_DRIFT_LIMIT };
}
