import { anchorAt, placementAt } from "@/lib/studio/clip-placement";
import { fadeLevel } from "@/lib/studio/clip-time";
import { canvasAspect, emptyVideoDocument, fullFrame, newMediaClip, videoCanvasSize, type Clip, type VideoDocument } from "@/lib/studio/document";
import { exportInBrowser } from "@/components/studio/video/export/browser-export";
import { groupTimeline, type GroupClip } from "@/lib/studio/group-scope";
import { maskCoverage, masksAt, newMask } from "@/lib/studio/masks";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;
type Channels = (file: Blob) => Promise<{ channels: Float32Array[]; rate: number }>;
type Level = (channel: Float32Array, rate: number, fromMs: number, toMs: number) => number;

const DURATION_MS = 1000;
const TIMES = [100, 500, 900] as const;
const EDGE_PX = 6;
const TOLERANCE = 12;
const OPACITY = 0.7;
const MASK_RADIUS = 0.4;
const GROUP_VOLUME = 0.5;
const LEVEL_WINDOW_MS = 200;
const LEVEL_TOLERANCE_DB = 0.75;
const SILENCE_BELOW_DB = 40;

function quadGroup(): GroupClip {
  const inner: Clip = { ...newMediaClip("image", "quad.png", 0, DURATION_MS), id: "group-quad" };
  const mask = { ...newMask("ellipse", "group-mask"), w: MASK_RADIUS * 2, h: MASK_RADIUS * 2 };
  return {
    id: "group",
    type: "group",
    startMs: 0,
    durationMs: DURATION_MS,
    trimInMs: 0,
    volume: 1,
    fadeInMs: 400,
    fadeOutMs: 0,
    transform: { x: 0.55, y: 0.45, w: 0.6, h: 0.6, rotation: 20, opacity: OPACITY },
    keyframes: { rotation: [{ atMs: 0, value: 20, easing: "linear" }, { atMs: DURATION_MS, value: 60, easing: "linear" }] },
    masks: [mask],
    tracks: [{ id: "group-inner", kind: "visual", clips: [inner] }],
  };
}

function film(group: GroupClip): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.canvas.background = "#000000";
  doc.tracks = [{ id: "group-track", kind: "visual", clips: [group] }];
  doc.durationMs = DURATION_MS;
  return doc;
}

function at(frame: Uint8Array, columns: number, step: number, x: number, y: number): number[] {
  const i = (Math.round(y / step) * columns + Math.round(x / step)) * 3;
  return [frame[i], frame[i + 1], frame[i + 2]];
}

export async function groupParity(frames: Frames, step: number): Promise<Record<string, unknown>> {
  const group = quadGroup();
  const doc = film(group);
  const aspect = canvasAspect(doc);
  const { width, height } = videoCanvasSize(doc);
  const inner = { ...groupTimeline(doc, group), canvas: doc.canvas };
  const [outer, composed] = [await frames(doc, width, height, TIMES), await frames(inner, width, height, TIMES)];
  const columns = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  let checked = 0;
  let wrong = 0;
  let worst = 0;
  let firstWrong: string | null = null;
  outer.forEach((frame, index) => {
    const ms = TIMES[index];
    const placed = placementAt(group, ms, aspect);
    const level = placed.opacity * fadeLevel(group, ms);
    const masks = masksAt(group.masks ?? [], ms);
    const boxW = placed.w * width;
    const boxH = placed.h * height;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const local = anchorAt(placed, { x: (x + 0.5) / width, y: (y + 0.5) / height }, aspect);
        const radius = Math.hypot((local.x - 0.5) / MASK_RADIUS, (local.y - 0.5) / MASK_RADIUS);
        if (Math.abs(radius - 1) * MASK_RADIUS * Math.min(boxW, boxH) < EDGE_PX) continue;
        if (Math.abs(local.x - 0.5) * boxW < EDGE_PX || Math.abs(local.y - 0.5) * boxH < EDGE_PX) continue;
        const sx = local.x * width;
        const sy = local.y * height;
        const inside = sx >= step && sy >= step && Math.round(sx / step) < columns - 1 && Math.round(sy / step) < rows - 1;
        const source = inside ? at(composed[index], columns, step, sx, sy) : [0, 0, 0];
        const coverage = inside ? maskCoverage(masks, local.x, local.y, boxW, boxH) : 0;
        const want = source.map((value) => value * level * coverage);
        const got = at(frame, columns, step, x, y);
        const diff = Math.max(...got.map((value, c) => Math.abs(value - want[c])));
        checked += 1;
        worst = Math.max(worst, diff);
        if (diff <= TOLERANCE) continue;
        wrong += 1;
        firstWrong ??= `frame at ${ms} ms, pixel ${x},${y}: got ${got.join(",")} expected ${want.map(Math.round).join(",")}`;
      }
    }
  });
  return { frames: outer.length, checked, wrong, worst, firstWrong, groupOk: outer.length === TIMES.length && checked > 0 && wrong === 0 };
}

function soundFilm(): VideoDocument {
  const doc = emptyVideoDocument("square");
  const tone = (id: string, startMs: number, durationMs: number): Clip => ({ ...newMediaClip("audio", "low.m4a", startMs, durationMs), id, transform: fullFrame() });
  const group: GroupClip = {
    id: "sound-group",
    type: "group",
    startMs: 1000,
    durationMs: 2000,
    trimInMs: 0,
    volume: GROUP_VOLUME,
    fadeInMs: 0,
    fadeOutMs: 0,
    transform: fullFrame(),
    tracks: [{ id: "sound-group-inner", kind: "audio", clips: [tone("inner-tone", 0, 3000)] }],
  };
  doc.tracks = [
    { id: "sound-visual", kind: "visual", clips: [group] },
    { id: "sound-reference", kind: "audio", clips: [tone("reference-tone", 4000, 2000)] },
  ];
  doc.durationMs = 6500;
  return doc;
}

export async function groupSoundParity(channelsOf: Channels, level: Level): Promise<Record<string, unknown>> {
  const result = await exportInBrowser(soundFilm(), () => undefined);
  if (result.status !== "done") return { status: result.status };
  const { channels, rate } = await channelsOf(result.file);
  const left = channels[0];
  const around = (ms: number) => level(left, rate, ms - LEVEL_WINDOW_MS, ms + LEVEL_WINDOW_MS);
  const grouped = around(2000);
  const reference = around(5000);
  const before = around(500);
  const after = around(3500);
  const wantDb = 20 * Math.log10(GROUP_VOLUME);
  const round = (value: number) => Number(value.toFixed(2));
  return {
    status: "done",
    groupDb: round(grouped - reference),
    wantDb: round(wantDb),
    beforeDb: round(before - reference),
    afterDb: round(after - reference),
    soundOk: Math.abs(grouped - reference - wantDb) <= LEVEL_TOLERANCE_DB && before < reference - SILENCE_BELOW_DB && after < reference - SILENCE_BELOW_DB,
  };
}
