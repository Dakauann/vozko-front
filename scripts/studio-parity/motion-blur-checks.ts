import { blurredPlan } from "@/lib/studio/blurred-plan";
import { canvasAspect, emptyVideoDocument, newMediaClip, videoCanvasSize, type CanvasSize, type Clip, type Transform, type VideoDocument } from "@/lib/studio/document";
import { boxMap, sampleTimes, shutterOf, shutterSpan, TRAIL_MAP_SIZE } from "@/lib/studio/motion-blur";
import { clipLookup } from "@/lib/studio/parenting";
import { heldLocalMs, poseAt } from "@/lib/studio/playback";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;

const DURATION_MS = 1000;
const TIMES = [150, 350, 500, 650, 850] as const;
const SWATCH = [0x99, 0x66, 0x33] as const;
const SIDE = 0.08;
const UNSURE_PX = 2;
const MAX_UNSURE_SHARE = 0.25;
const TOLERANCE = 8;
const SURE_TOLERANCE = 3;
const MAP_DRIFT_LIMIT = 1e-9;
const BLURRED_LOW = 0.15;
const BLURRED_HIGH = 0.85;
const PASS_SAMPLES = 64;

interface Shutters {
  angle?: number;
  phase?: number;
}

function film(shutter: Shutters): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.canvas.background = "#000000";
  if (shutter.angle !== undefined) doc.canvas.shutterAngle = shutter.angle;
  if (shutter.phase !== undefined) doc.canvas.shutterPhase = shutter.phase;
  const swatch: Clip = {
    ...newMediaClip("image", "swatch.png", 0, DURATION_MS),
    id: "swatch",
    motionBlur: true,
    transform: { x: 0.5, y: 0.5, w: SIDE, h: SIDE * canvasAspect(doc), rotation: 0, opacity: 1 },
    keyframes: {
      x: [
        { atMs: 0, value: 0.2, easing: "linear" },
        { atMs: DURATION_MS, value: 0.8, easing: "linear" },
      ],
      y: [
        { atMs: 0, value: 0.45, easing: "linear" },
        { atMs: DURATION_MS, value: 0.55, easing: "linear" },
      ],
      rotation: [
        { atMs: 0, value: 0, easing: "linear" },
        { atMs: DURATION_MS, value: 120, easing: "linear" },
      ],
    },
  };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [swatch] }];
  doc.durationMs = DURATION_MS;
  return doc;
}

function edgeDistancePx(pose: Transform, x: number, y: number, size: CanvasSize): number {
  const turn = (-pose.rotation * Math.PI) / 180;
  const rx = x - pose.x * size.width;
  const ry = y - pose.y * size.height;
  const lx = rx * Math.cos(turn) - ry * Math.sin(turn);
  const ly = rx * Math.sin(turn) + ry * Math.cos(turn);
  const dx = (pose.w * size.width) / 2 - Math.abs(lx);
  const dy = (pose.h * size.height) / 2 - Math.abs(ly);
  return dx >= 0 && dy >= 0 ? Math.min(dx, dy) : -Math.hypot(Math.max(0, -dx), Math.max(0, -dy));
}

interface FilmReport {
  frames: number;
  samples: number[];
  checked: number;
  wrong: number;
  worst: number;
  worstSure: number;
  blurred: number;
  sharpWouldMiss: number;
  mapDrift: number;
  firstWrong: string | null;
}

async function checkFilm(frames: Frames, step: number, shutter: Shutters): Promise<FilmReport & { rendered: Uint8Array[] }> {
  const doc = film(shutter);
  const size = videoCanvasSize(doc);
  const aspect = canvasAspect(doc);
  const lookup = clipLookup(doc);
  const clip = lookup.get("swatch")!;
  const pose = (at: number) => poseAt(lookup, clip, heldLocalMs(clip, at), aspect, size);
  const rendered = await frames(doc, size.width, size.height, TIMES);
  const columns = Math.ceil(size.width / step);
  const report: FilmReport = { frames: rendered.length, samples: [], checked: 0, wrong: 0, worst: 0, worstSure: 0, blurred: 0, sharpWouldMiss: 0, mapDrift: 0, firstWrong: null };
  rendered.forEach((frame, index) => {
    const ms = TIMES[index];
    const trail = blurredPlan(doc, ms, 1).find((item) => item.clipId === "swatch")?.trail;
    const count = trail ? trail.maps.length / TRAIL_MAP_SIZE : 0;
    report.samples.push(count);
    if (!trail) return;
    const center = pose(ms);
    const poses = sampleTimes(shutterSpan(shutterOf(doc.canvas), ms), count).map(pose);
    poses.forEach((sample, i) => {
      const map = boxMap(center, sample, size)!;
      map.forEach((value, k) => (report.mapDrift = Math.max(report.mapDrift, Math.abs(value - trail.maps[i * TRAIL_MAP_SIZE + k]))));
    });
    for (let y = 0; y < size.height; y += step) {
      for (let x = 0; x < size.width; x += step) {
        const distances = poses.map((sample) => edgeDistancePx(sample, x + 0.5, y + 0.5, size));
        const unsure = distances.filter((distance) => Math.abs(distance) <= UNSURE_PX).length / count;
        if (unsure > MAX_UNSURE_SHARE) continue;
        const coverage = distances.filter((distance) => distance > UNSURE_PX).length / count;
        const want = SWATCH.map((channel) => channel * coverage);
        const i = ((y / step) * columns + x / step) * 3;
        const got = [frame[i], frame[i + 1], frame[i + 2]];
        const diff = Math.max(...got.map((value, c) => Math.abs(value - want[c])));
        const allowed = TOLERANCE + 255 * unsure;
        report.checked += 1;
        report.worst = Math.max(report.worst, diff);
        if (unsure === 0) report.worstSure = Math.max(report.worstSure, diff);
        if (coverage > BLURRED_LOW && coverage < BLURRED_HIGH) report.blurred += 1;
        const sharp = edgeDistancePx(center, x + 0.5, y + 0.5, size) > 0 ? 1 : 0;
        if (Math.abs(sharp - coverage) * SWATCH[0] > allowed) report.sharpWouldMiss += 1;
        if (diff <= allowed) continue;
        report.wrong += 1;
        report.firstWrong ??= `frame at ${ms} ms, pixel ${x},${y}: got ${got.join(",")} expected ${want.map(Math.round).join(",")} with ${Math.round(coverage * 100)}% of ${count} samples`;
      }
    }
  });
  return { ...report, rendered };
}

function identical(a: readonly Uint8Array[], b: readonly Uint8Array[]): boolean {
  return a.length === b.length && a.every((frame, index) => frame.length === b[index].length && frame.every((value, i) => value === b[index][i]));
}

export async function motionBlurParity(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const { rendered, ...standard } = await checkFilm(frames, step, {});
  const { rendered: wideFrames, ...wide } = await checkFilm(frames, step, { angle: 720, phase: -360 });
  const again = await frames(film({}), videoCanvasSize(film({})).width, videoCanvasSize(film({})).height, TIMES);
  const filmOk = (report: FilmReport, frameCount: number) => report.frames === TIMES.length && frameCount === TIMES.length && report.samples.every((count) => count >= 2) && report.checked > 0 && report.wrong === 0 && report.worstSure <= SURE_TOLERANCE && report.blurred > 0 && report.sharpWouldMiss > 0 && report.mapDrift <= MAP_DRIFT_LIMIT;
  const repeatOk = identical(rendered, again);
  return {
    standard,
    wide,
    repeatOk,
    chunked: wide.samples.some((count) => count > PASS_SAMPLES),
    motionBlurOk: filmOk(standard, rendered.length) && filmOk(wide, wideFrames.length) && wide.samples.some((count) => count > PASS_SAMPLES),
  };
}
