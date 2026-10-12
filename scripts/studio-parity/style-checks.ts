import { emptyVideoDocument, newMediaClip, videoCanvasSize, type VideoDocument } from "@/lib/studio/document";
import type { Effect, StrokePaint } from "@/lib/studio/layer-paint";

type Report = Record<string, unknown>;
type Frames = (doc: VideoDocument, width: number, height: number, times?: readonly number[]) => Promise<Uint8Array[]>;

const DURATION_MS = 400;
const BOX = 0.4;
const STROKE_PX = 10;
const SPREAD_PX = 30;
const EDGE_PX = 3;
const TOLERANCE = 40;
const GLOW: Effect = { id: "glow", type: "outer-glow", color: "#00ff00", opacity: 1, x: 0, y: 0, blur: 0, spread: SPREAD_PX };
const OUTLINE: StrokePaint = { type: "solid", color: "#ffffff", opacity: 1, width: STROKE_PX, align: "outside" };
const WHITE = [255, 255, 255];
const GREEN = [0, 255, 0];
const BLACK = [0, 0, 0];

function film(): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  doc.tracks = [
    {
      id: "v1",
      kind: "visual",
      clips: [{ ...newMediaClip("video", "proxy.mp4", 0, DURATION_MS), id: "styled", fit: "cover", transform: { x: 0.5, y: 0.5, w: BOX, h: BOX, rotation: 0, opacity: 1 }, effects: [GLOW], strokes: [OUTLINE] }],
    },
  ];
  doc.durationMs = DURATION_MS;
  return doc;
}

function expectedAt(distance: number): number[] | null {
  if (distance <= 0) return null;
  if (Math.abs(distance - STROKE_PX) < EDGE_PX || Math.abs(distance - STROKE_PX - SPREAD_PX) < EDGE_PX || distance < EDGE_PX) return null;
  if (distance < STROKE_PX) return WHITE;
  return distance < STROKE_PX + SPREAD_PX ? GREEN : BLACK;
}

export async function clipStyleParity(frames: Frames, step: number): Promise<Report> {
  const doc = film();
  const { width, height } = videoCanvasSize(doc);
  const [frame] = await frames(doc, width, height, [DURATION_MS / 2]);
  const [again] = await frames(doc, width, height, [DURATION_MS / 2]);
  const columns = Math.ceil(width / step);
  const left = width * (0.5 - BOX / 2);
  const right = width * (0.5 + BOX / 2);
  const top = height * (0.5 - BOX / 2);
  const bottom = height * (0.5 + BOX / 2);
  let checked = 0;
  let wrong = 0;
  let insideGreen = 0;
  let firstWrong: string | null = null;
  const counts = { stroke: 0, glow: 0, clear: 0 };
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const dx = Math.max(left - cx, 0, cx - right);
      const dy = Math.max(top - cy, 0, cy - bottom);
      const i = ((y / step) * columns + x / step) * 3;
      const got = [frame[i], frame[i + 1], frame[i + 2]];
      if (dx === 0 && dy === 0) {
        if (cx > left + EDGE_PX && cx < right - EDGE_PX && cy > top + EDGE_PX && cy < bottom - EDGE_PX && got[1] > 200 && got[0] < 60 && got[2] < 60) insideGreen += 1;
        continue;
      }
      const want = expectedAt(Math.hypot(dx, dy));
      if (!want) continue;
      checked += 1;
      counts[want === WHITE ? "stroke" : want === GREEN ? "glow" : "clear"] += 1;
      if (got.every((value, c) => Math.abs(value - want[c]) <= TOLERANCE)) continue;
      wrong += 1;
      firstWrong ??= `${x},${y}: got ${got.join(",")} expected ${want.join(",")}`;
    }
  }
  const repeatOk = frame.every((value, index) => value === again[index]);
  return { checked, wrong, firstWrong, ...counts, insideGreen, repeatOk, styleOk: checked > 0 && wrong === 0 && counts.stroke > 0 && counts.glow > 0 && insideGreen === 0 && repeatOk };
}
