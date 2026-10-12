import { emptyVideoDocument, newOverlayClip, newPathLayer, type Clip, type VideoDocument } from "@/lib/studio/document";
import { morphPath } from "@/lib/studio/path-morph";
import { flattenSegment, pathToSubpaths, segmentCount } from "@/lib/studio/path-nodes";
import type { Point } from "@/lib/studio/viewport";

type Report = Record<string, unknown>;
type Frames = (doc: VideoDocument, width: number, height: number, times?: readonly number[]) => Promise<Uint8Array[]>;

const SIZE = 1080;
const DURATION_MS = 1000;
const MIDDLE_MS = 500;
const BOX = 0.8;
const SQUARE = "M0 0 L1 0 L1 1 L0 1 Z";
const STAR = "M0.5 0 L0.62 0.35 L1 0.35 L0.69 0.57 L0.81 0.91 L0.5 0.7 L0.19 0.91 L0.31 0.57 L0 0.35 L0.38 0.35 Z";
const EDGE_PX = 3;
const INK = 200;
const DARK = 55;
const CONTROL_TOLERANCE = 24;
const MAX_CONTROL_MISMATCH = 0.002;

function shapeFilm(clip: Partial<Clip>, path: string): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  const layer = { ...newPathLayer(path), fill: "#ffffff" };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newOverlayClip(layer, 0, DURATION_MS, { x: 0.5, y: 0.5, w: BOX, h: BOX, rotation: 0, opacity: 1 }), id: "shape", ...clip }] }];
  doc.durationMs = DURATION_MS;
  return doc;
}

function morphFilm(): VideoDocument {
  return shapeFilm(
    {
      keyframes: {
        path: [
          { atMs: 0, path: SQUARE, easing: "linear" },
          { atMs: DURATION_MS, path: STAR, easing: "linear" },
        ],
      },
    },
    SQUARE,
  );
}

function polygons(path: string): Point[][] {
  const margin = (1 - BOX) / 2;
  return pathToSubpaths(path).map((subpath) => {
    const points = [subpath.nodes[0], ...Array.from({ length: segmentCount(subpath) }, (_, s) => flattenSegment(subpath, s, 0.002)).flat()];
    return points.map((p) => ({ x: (margin + BOX * p.x) * SIZE, y: (margin + BOX * p.y) * SIZE }));
  });
}

function inside(rings: readonly Point[][], x: number, y: number): boolean {
  let hit = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [a, b] = [ring[j], ring[i]];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
    }
  }
  return hit;
}

function edgeDistance(rings: readonly Point[][], x: number, y: number): number {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [a, b] = [ring[j], ring[i]];
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / (ex * ex + ey * ey || 1)));
      best = Math.min(best, Math.hypot(x - a.x - ex * t, y - a.y - ey * t));
    }
  }
  return best;
}

export async function morphParity(frames: Frames, step: number): Promise<Report> {
  const expected = morphPath(SQUARE, STAR, MIDDLE_MS / DURATION_MS);
  const [morphed] = await frames(morphFilm(), SIZE, SIZE, [MIDDLE_MS]);
  const [control] = await frames(shapeFilm({}, expected), SIZE, SIZE, [MIDDLE_MS]);
  const [again] = await frames(morphFilm(), SIZE, SIZE, [MIDDLE_MS]);
  const rings = polygons(expected);
  const square = polygons(SQUARE);
  const columns = Math.ceil(SIZE / step);
  let checked = 0;
  let wrong = 0;
  let carved = 0;
  let mismatch = 0;
  let firstWrong: string | null = null;
  for (let y = 0; y < SIZE; y += step) {
    for (let x = 0; x < SIZE; x += step) {
      const i = ((y / step) * columns + x / step) * 3;
      const got = morphed[i];
      if (Math.abs(got - control[i]) > CONTROL_TOLERANCE) mismatch += 1;
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (edgeDistance(rings, cx, cy) < EDGE_PX) continue;
      const within = inside(rings, cx, cy);
      checked += 1;
      if (!within && inside(square, cx, cy)) carved += 1;
      if (within ? got >= INK : got <= DARK) continue;
      wrong += 1;
      firstWrong ??= `${x},${y}: got ${got}, expected ${within ? "ink" : "background"}`;
    }
  }
  const samples = columns * columns;
  const repeatOk = morphed.every((value, index) => value === again[index]);
  const controlShare = mismatch / samples;
  return {
    checked,
    wrong,
    firstWrong,
    controlMismatch: Number(controlShare.toFixed(5)),
    repeatOk,
    carved,
    morphOk: checked > 0 && wrong === 0 && carved > 0 && controlShare <= MAX_CONTROL_MISMATCH && repeatOk,
  };
}
