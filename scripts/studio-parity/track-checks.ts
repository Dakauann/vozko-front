import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from "mediabunny";

import { loadMediaFile } from "@/components/studio/canvas/media-files";
import { trackAssetPoint } from "@/components/studio/media/point-tracker";
import { exportInBrowser } from "@/components/studio/video/export/browser-export";
import { canvasAspect, emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "@/lib/studio/document";
import { clipLookup, trackedPointIn } from "@/lib/studio/parenting";
import { planTrack } from "@/lib/studio/agent/track-ops";
import { attachToTracker, putTracker, stabilizeClip } from "@/lib/studio/track-edit";
import { trackerFromOutcome } from "@/lib/studio/tracking/track-outcome";

import { DOT_FILE, DOT_FPS, DOT_FRAMES, DOT_SIZE } from "./dot-fixture";

const SWATCH = [0x99, 0x66, 0x33] as const;
const SWATCH_TOLERANCE = 40;
const DOT_BRIGHT = 120;
const DOT_FLOOR = 40;
const MAX_TRACK_ERROR_PX = 1;
const MAX_FOLLOW_ERROR_PX = 2;
const MAX_STEADY_DRIFT_PX = 2;

async function dotCenters(): Promise<{ x: number; y: number }[]> {
  const file = await loadMediaFile(DOT_FILE);
  const input = new Input({ source: new BlobSource(file!.blob), formats: ALL_FORMATS });
  const track = (await input.getPrimaryVideoTrack())!;
  const width = await track.getDisplayWidth();
  const height = await track.getDisplayHeight();
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  const centers: { x: number; y: number }[] = [];
  for await (const sample of new VideoSampleSink(track).samples()) {
    sample.draw(probe, 0, 0, width, height);
    sample.close();
    const data = probe.getImageData(0, 0, width, height).data;
    let x = 0;
    let y = 0;
    let weight = 0;
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const value = data[(j * width + i) * 4];
        if (value < DOT_FLOOR) continue;
        x += (i + 0.5) * value;
        y += (j + 0.5) * value;
        weight += value;
      }
    }
    centers.push({ x: x / weight, y: y / weight });
  }
  input.dispose();
  return centers;
}

function film(): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.canvas.background = "#000000";
  const durationMs = Math.round((DOT_FRAMES * 1000) / DOT_FPS);
  const shot: Clip = { ...newMediaClip("video", DOT_FILE, 0, durationMs), id: "shot" };
  const side = 0.05;
  const chip: Clip = { ...newMediaClip("image", "swatch.png", 0, durationMs), id: "chip", transform: { x: 0.5, y: 0.5, w: side, h: side * canvasAspect(doc), rotation: 0, opacity: 1 } };
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [shot] },
    { id: "v2", kind: "visual", clips: [chip] },
  ];
  doc.durationMs = durationMs;
  return doc;
}

type Centroid = { x: number; y: number; count: number } | null;

function centroid(data: Uint8ClampedArray, width: number, height: number, match: (r: number, g: number, b: number) => boolean): Centroid {
  let x = 0;
  let y = 0;
  let count = 0;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const k = (j * width + i) * 4;
      if (!match(data[k], data[k + 1], data[k + 2])) continue;
      x += i + 0.5;
      y += j + 0.5;
      count += 1;
    }
  }
  return count > 0 ? { x: x / count, y: y / count, count } : null;
}

async function exportedFrames(doc: VideoDocument, each: (data: Uint8ClampedArray, width: number, height: number, ms: number) => void): Promise<number> {
  const result = await exportInBrowser(doc, () => undefined);
  if (result.status !== "done") return -1;
  const input = new Input({ source: new BlobSource(result.file), formats: ALL_FORMATS });
  const track = (await input.getPrimaryVideoTrack())!;
  const width = await track.getDisplayWidth();
  const height = await track.getDisplayHeight();
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  let frames = 0;
  for await (const sample of new VideoSampleSink(track).samples()) {
    const ms = sample.timestamp * 1000;
    sample.draw(probe, 0, 0, width, height);
    sample.close();
    each(probe.getImageData(0, 0, width, height).data, width, height, ms);
    frames += 1;
  }
  input.dispose();
  return frames;
}

export async function trackingParity(): Promise<Record<string, unknown>> {
  const base = film();
  const centers = await dotCenters();
  const start = centers[0];
  const plan = planTrack(base, { clipId: "shot", point: { x: start.x / DOT_SIZE.width, y: start.y / DOT_SIZE.height }, size: 0.12, atMs: 0, direction: "forward" });
  if (typeof plan === "string") return { status: plan };
  const begun = performance.now();
  const outcome = await trackAssetPoint(DOT_FILE, plan.request, {});
  const trackMs = performance.now() - begun;
  const made = trackerFromOutcome(outcome, { id: "dot", keepPartial: false });
  if (!made.ok) return { status: made.reason, loss: made.loss ?? null };
  const tracker = made.tracker;
  let trackError = 0;
  tracker.samples.forEach((sample) => {
    const frame = Math.round((sample.atMs * DOT_FPS) / 1000);
    const real = centers[frame];
    trackError = Math.max(trackError, Math.hypot(sample.x * tracker.frameWidth - real.x, sample.y * tracker.frameHeight - real.y));
  });
  const stored = putTracker(base, "shot", tracker);
  if (!stored.ok) return { status: stored.reason };
  const linked = attachToTracker(stored.document, ["chip"], "shot", "dot", { mode: "link", keepVisual: false, atMs: 0 });
  if (!linked.ok) return { status: linked.reason };
  const doc = linked.document;
  const lookup = clipLookup(doc);
  const aspect = canvasAspect(doc);
  let followError = 0;
  let followMissing = 0;
  const followFrames = await exportedFrames(doc, (data, width, height, ms) => {
    const want = trackedPointIn(lookup, lookup.get("shot")!, tracker, ms, aspect);
    const found = centroid(data, width, height, (r, g, b) => Math.abs(r - SWATCH[0]) + Math.abs(g - SWATCH[1]) + Math.abs(b - SWATCH[2]) < SWATCH_TOLERANCE);
    if (!found) followMissing += 1;
    else followError = Math.max(followError, Math.hypot(found.x - want.x * width, found.y - want.y * height));
  });
  const steadied = stabilizeClip(stored.document, "shot", { trackerId: "dot" });
  let steadyDrift = 0;
  let steadyFrames = -1;
  let zoom = 0;
  if (steadied.ok) {
    zoom = steadied.document.tracks[0].clips[0].stabilize!.zoom;
    const still = { ...steadied.document, tracks: steadied.document.tracks.slice(0, 1) };
    let first: Centroid = null;
    steadyFrames = await exportedFrames(still, (data, width, height) => {
      const found = centroid(data, width, height, (r, g, b) => r > DOT_BRIGHT && g > DOT_BRIGHT && b > DOT_BRIGHT);
      if (!found) return;
      first ??= found;
      steadyDrift = Math.max(steadyDrift, Math.hypot(found.x - first.x, found.y - first.y));
    });
  }
  const frames = tracker.samples.length;
  return {
    status: "done",
    frames,
    trackMs: Math.round(trackMs),
    framesPerSecond: Math.round((frames / Math.max(1, trackMs)) * 1000),
    meanConfidence: tracker.samples.reduce((sum, sample) => sum + sample.confidence, 0) / frames,
    trackError: Number(trackError.toFixed(3)),
    followFrames,
    followMissing,
    followError: Number(followError.toFixed(2)),
    steadyFrames,
    steadyDrift: Number(steadyDrift.toFixed(2)),
    zoom,
    trackOk: frames === DOT_FRAMES && trackError <= MAX_TRACK_ERROR_PX,
    followOk: followFrames === DOT_FRAMES && followMissing === 0 && followError <= MAX_FOLLOW_ERROR_PX,
    steadyOk: steadied.ok && steadyFrames === DOT_FRAMES && steadyDrift <= MAX_STEADY_DRIFT_PX,
  };
}
