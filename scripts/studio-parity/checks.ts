import { ALL_FORMATS, AudioSampleSink, BlobSource, Input, VideoSampleSink } from "mediabunny";

import { loadMediaFile } from "@/components/studio/canvas/media-files";
import { DecodedStills } from "@/components/studio/media/decoded-stills";
import { DecodedVideos } from "@/components/studio/media/decoded-videos";
import { openMediaWorker } from "@/components/studio/media/media-worker";
import { createPixiRenderer } from "@/components/studio/render/pixi-renderer";
import { studioRenderSources } from "@/components/studio/render/studio-sources";
import { exportInBrowser } from "@/components/studio/video/export/browser-export";
import { reactLevels } from "@/components/studio/video/react-levels";
import { vfxPackParity } from "./vfx-pack-checks";
import { exportAnimationInBrowser } from "@/components/studio/video/export/animated-encoders";
import { exportFrameInBrowser } from "@/components/studio/video/export/frame-export";
import { spanLength, type TimeSpan } from "@/lib/studio/work-area";
import { animationSize, defaultVideoExport, type AnimationExportRequest } from "@/lib/studio/animated-export";
import { drawWhenReady, renderFrames, Wake } from "@/components/studio/video/export/frame-loop";
import { BLEND_MODES, emptyArtboard, emptyVideoDocument, fullFrame, newImageLayer, newMediaClip, newShapeLayer, newTextLayer, videoCanvasSize, canvasAspect, type Artboard, type Clip,type BlendMode, type Layer, type VideoDocument } from "@/lib/studio/document";
import { blendColor, type Rgb } from "@/lib/studio/blend-modes";
import { sourceAt } from "@/lib/studio/clip-time";
import { anchorAt, anchorOf, placedPivot, placementAt, pivotFrom } from "@/lib/studio/clip-placement";
import { positionAt } from "@/lib/studio/position-path";
import { gradePixel, type ColorGrade } from "@/lib/studio/color-grade";
import { gradientMapLut, mapGradientPixels, type GradientMap } from "@/lib/studio/gradient-map";
import { artboardScenes, imageScene } from "@/lib/studio/scene/image-scene";
import { layoutSurface } from "@/lib/studio/auto-layout";
import { createHugMeasure } from "@/components/studio/canvas/hug-measure";
import { ensureFont } from "@/components/studio/canvas/ensure-font";
import { rasterizeRegion } from "@/components/studio/canvas/rasterize";
import { newPaintLayer, type StrokeOp } from "@/lib/studio/pixel-surface";
import type { Scene } from "@/lib/studio/scene/scene";
import { parseColor } from "@/lib/studio/color";
import { exportFrameMs, frameTimes } from "@/lib/studio/export-encoding";
import { colorAt, type ColorKeyframe } from "@/lib/studio/keyframes";
import { addTransition } from "@/lib/studio/transitions";
import { crossfadeLevel } from "@/lib/studio/audio-crossfade";
import { panGains } from "@/lib/studio/audio-pan";
import { chromaPixel, newChromaKey } from "@/lib/studio/chroma-key";
import { newMask } from "@/lib/studio/masks";
import { lumaAlpha, newLumaKey } from "@/lib/studio/luma-key";
import { matteWeight, type Matte } from "@/lib/studio/matte";
import { newEffectClip, newVfx, shakeAt, VFX_KINDS, vfxLook, vignetteWeight, type Vfx } from "@/lib/studio/vfx";
import { overlayClip } from "@/lib/studio/media-clips";
import { EFFECT_SAMPLE_SIZE, plainSample } from "@/lib/studio/vfx-samples";
import { effectThumbnails, PLAIN_PREVIEW } from "@/components/studio/video/panels/effect-thumbnails";
import { stillSeconds } from "@/lib/studio/media/stills";
import { visualPlan } from "@/lib/studio/playback";
import { fitCamera } from "@/lib/studio/render/renderer";
import { videoSources } from "@/lib/studio/scene/scene";
import { videoScene } from "@/lib/studio/scene/video-scene";

import { textGlyphs } from "./text-checks";
import { colorFinishParity, remapParity } from "./color-checks";
import { animatorUnits } from "./animator-checks";
import { richTextRuns } from "./rich-text-checks";
import { parentingParity } from "./parent-checks";
import { groupParity, groupSoundParity } from "./group-checks";
import { trackingParity } from "./track-checks";
import { behaviorParity } from "./behavior-checks";
import { morphParity } from "./morph-checks";
import { clipStyleParity } from "./style-checks";
import { guideParity } from "./guide-checks";
import { motionBlurParity } from "./motion-blur-checks";
import { tiltParity } from "./tilt-checks";
import { cameraParity, maskedCurvesParity } from "./adjustment-checks";
import { chartParity } from "./chart-checks";
import { generatedParity } from "./generated-checks";
import { pathOpParity, repeaterParity } from "./path-op-checks";
import { edgeTransitionParity, transitionPreviewParity } from "./transition-checks";
import { stillVfxParity } from "./still-vfx-checks";
import { frameParity, stickerParity } from "./library-checks";
import { lottieParity } from "./lottie-checks";

const FPS = 30;
const CLIP_SECONDS = 4;
const PSNR_STEP = 4;
const PAINT_SIZE = 1080;
const PAINT_TOLERANCE = 4;

type Report = Record<string, unknown>;

const report: Report = {};
(window as unknown as { parity: Report }).parity = report;

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

function stripeIndex(data: Uint8ClampedArray, width: number, row: number): number {
  let index = 0;
  for (let k = 0; k < 8; k++) if (data[(row * width + Math.floor((k + 0.5) * (width / 8))) * 4] > 128) index += 2 ** k;
  return index;
}

function expectedFrame(ms: number): number {
  return Math.floor((ms * FPS) / 1000 + 1e-6);
}

function singleClip(file: string, seconds: number): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", file, 0, seconds * 1000), id: "clip" }] }];
  doc.durationMs = seconds * 1000;
  return doc;
}

async function decoding(file: string): Promise<Report> {
  const width = 320;
  const height = 180;
  const doc = singleClip(file, CLIP_SECONDS);
  const videos = new DecodedVideos(openMediaWorker(), loadMediaFile, (id) => id, () => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = await createPixiRenderer(canvas, { width, height, resolution: 1 }, studioRenderSources(videos), () => undefined);
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  const show = (ms: number): number | null => {
    const scene = videoScene(doc, visualPlan(doc, ms));
    videos.sync(videoSources(scene));
    renderer.render([scene], fitCamera(scene, { width }));
    if (!videos.picture("clip")) return null;
    probe.drawImage(canvas, 0, 0);
    return stripeIndex(probe.getImageData(0, 0, width, height).data, width, height / 2);
  };
  const settle = async (ms: number) => {
    const started = performance.now();
    while (performance.now() - started < 4000) {
      if (show(ms) === expectedFrame(ms)) return performance.now() - started;
      await nextFrame();
    }
    return null;
  };
  const random = seeded(7);
  const targets = [1000, 500, 3900, 100, 2000, ...Array.from({ length: 10 }, (_, n) => ((15 + n) * 1000) / FPS + 1), ...Array.from({ length: 25 }, () => Math.round(random() * 3900))];
  const waits: number[] = [];
  let wrong = 0;
  for (const ms of targets) {
    const waited = await settle(ms);
    if (waited === null) wrong += 1;
    else waits.push(waited);
  }
  waits.sort((a, b) => a - b);
  const startedAt = performance.now();
  let renders = 0;
  let late = 0;
  let blank = 0;
  while (performance.now() - startedAt < 2000) {
    const ms = Math.min(3990, performance.now() - startedAt + 200);
    const got = show(ms);
    renders += 1;
    if (got === null) blank += 1;
    else if (expectedFrame(ms) - got > 1) late += 1;
    await nextFrame();
  }
  renderer.destroy();
  videos.dispose();
  return { checked: targets.length, wrong, medianWaitMs: Math.round(waits[Math.floor(waits.length / 2)] ?? 0), renders, late, blank };
}

async function stills(file: string): Promise<Report> {
  let fallbacks = 0;
  const fallback = {
    grab: async () => {
      fallbacks += 1;
      return null;
    },
    dispose: () => undefined,
  };
  const source = new DecodedStills(openMediaWorker, fallback, loadMediaFile);
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  let wrong = 0;
  const times = [0, 1, 2.5, 3.9, 0.5, 3.1, 1.75, 2.2, 0.03, 3.98];
  const started = performance.now();
  for (const seconds of times) {
    const image = await source.grab(file, seconds, 90);
    if (!image) {
      wrong += 1;
      continue;
    }
    const bitmap = await createImageBitmap(image);
    probe.canvas.width = bitmap.width;
    probe.canvas.height = bitmap.height;
    probe.drawImage(bitmap, 0, 0);
    const found = stripeIndex(probe.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.width, Math.floor(bitmap.height / 2));
    if (found !== expectedFrame(stillSeconds(seconds, CLIP_SECONDS) * 1000)) wrong += 1;
  }
  source.dispose();
  return { checked: times.length, wrong, fallbacks, averageMs: Math.round((performance.now() - started) / times.length) };
}

function exportFilm(): VideoDocument {
  const doc = singleClip("proxy.mp4", 2);
  const title = {
    ...overlayClip({ ...newTextLayer("Paridade 123", "heading"), id: "l1", fill: "#ffffff", fontWeight: 800, shadow: { color: "#000000aa", blur: 18, x: 0, y: 8 } }, 0, { x: 0.35, y: 0.18, w: 0.6, h: 0.2, rotation: 0, opacity: 1 }),
    id: "title",
    startMs: 0,
    durationMs: 2000,
    fadeInMs: 400,
  };
  const badge = {
    ...overlayClip({ ...newShapeLayer("rect"), id: "l2", fill: "#22c55e", radius: 0.3 }, 0, { x: 0.85, y: 0.18, w: 0.12, h: 0.18, rotation: 12, opacity: 0.9 }),
    id: "badge",
    startMs: 0,
    durationMs: 2000,
    keyframes: { scale: [{ atMs: 0, value: 1, easing: "linear" as const }, { atMs: 2000, value: 1.5, easing: "linear" as const }] },
  };
  doc.tracks.push(
    { id: "v2", kind: "visual", clips: [title, badge] },
    { id: "a1", kind: "audio", clips: [{ ...newMediaClip("audio", "tone-a.m4a", 0, 2000), id: "ta" }] },
    { id: "a2", kind: "audio", clips: [{ ...newMediaClip("audio", "tone-b.m4a", 0, 2000), id: "tb" }] },
  );
  return doc;
}

function sampled(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const out = new Uint8Array(Math.ceil(width / PSNR_STEP) * Math.ceil(height / PSNR_STEP) * 3);
  let o = 0;
  for (let y = 0; y < height; y += PSNR_STEP) {
    for (let x = 0; x < width; x += PSNR_STEP) {
      const i = (y * width + x) * 4;
      out[o++] = data[i];
      out[o++] = data[i + 1];
      out[o++] = data[i + 2];
    }
  }
  return out;
}

function psnr(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return sum === 0 ? 99 : 10 * Math.log10((255 * 255) / (sum / a.length));
}

async function rendererFrames(doc: VideoDocument, width: number, height: number, times: readonly number[] = frameTimes(doc.durationMs)): Promise<Uint8Array[]> {
  const frames: Uint8Array[] = [];
  const wake = new Wake();
  const videos = new DecodedVideos(openMediaWorker(), loadMediaFile, (id) => id, () => wake.notify());
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = await createPixiRenderer(canvas, { width, height, resolution: 1 }, studioRenderSources(videos), () => wake.notify());
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  const levels = (await reactLevels.ready(doc)) ?? undefined;
  await renderFrames({
    doc,
    times,
    videos,
    renderer,
    wake,
    levels,
    emit: async () => {
      probe.drawImage(canvas, 0, 0);
      frames.push(sampled(probe.getImageData(0, 0, width, height).data, width, height));
    },
    onProgress: () => undefined,
  });
  renderer.destroy();
  videos.dispose();
  return frames;
}

const PAINT_KEYS: ColorKeyframe[] = [
  { atMs: 0, color: "#ff0000", easing: "linear" },
  { atMs: 500, color: "#00ff00", easing: "easeInOut" },
  { atMs: 1000, color: "#0000ff", easing: "linear" },
];

function paintFilm(): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  const swatch = {
    ...overlayClip({ ...newShapeLayer("rect"), id: "l3", fill: "#ff0000" }, 0, { x: 0.5, y: 0.5, w: 0.6, h: 0.6, rotation: 0, opacity: 1 }),
    id: "swatch",
    startMs: 0,
    durationMs: 1000,
    keyframes: { fill: PAINT_KEYS },
  };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [swatch] }];
  doc.durationMs = 1000;
  return doc;
}

async function paint(): Promise<Report> {
  const frames = await rendererFrames(paintFilm(), PAINT_SIZE, PAINT_SIZE);
  const columns = Math.ceil(PAINT_SIZE / PSNR_STEP);
  const center = (Math.floor(PAINT_SIZE / 2 / PSNR_STEP) * columns + Math.floor(PAINT_SIZE / 2 / PSNR_STEP)) * 3;
  let worst = 0;
  let wrong = 0;
  let firstWrong: string | null = null;
  frames.forEach((frame, index) => {
    const expected = parseColor(colorAt(PAINT_KEYS, exportFrameMs(index)))!;
    const got = [frame[center], frame[center + 1], frame[center + 2]];
    const diff = Math.max(Math.abs(got[0] - expected.r), Math.abs(got[1] - expected.g), Math.abs(got[2] - expected.b));
    worst = Math.max(worst, diff);
    if (diff <= PAINT_TOLERANCE) return;
    wrong += 1;
    firstWrong ??= `frame ${index}: got ${got.join(",")} expected ${expected.r},${expected.g},${expected.b}`;
  });
  return { frames: frames.length, wrong, worst, firstWrong };
}

function swatch(id: string, fill: string, startMs: number) {
  return { ...overlayClip({ ...newShapeLayer("rect"), id: `l-${id}`, fill }, 0, { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }), id, startMs, durationMs: 1000 };
}

function transitionFilm(kind: "wipe" | "dissolve"): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  doc.tracks = [{ id: "v1", kind: "visual", clips: [swatch("red", "#ff0000", 0), swatch("blue", "#0000ff", 1000)] }];
  doc.durationMs = 2000;
  const result = addTransition(doc, { fromClipId: "red", toClipId: "blue", kind, durationMs: 600 });
  if (!result.ok) throw new Error(result.reason);
  return result.document;
}

function pixel(frame: Uint8Array, x: number, y: number): number[] {
  const columns = Math.ceil(PAINT_SIZE / PSNR_STEP);
  const i = (Math.floor(y / PSNR_STEP) * columns + Math.floor(x / PSNR_STEP)) * 3;
  return [frame[i], frame[i + 1], frame[i + 2]];
}

function near(got: number[], want: number[], tolerance: number): boolean {
  return got.every((value, i) => Math.abs(value - want[i]) <= tolerance);
}

async function transitions(): Promise<Report> {
  const middle = Math.round(1000 / (1000 / FPS));
  const wipe = await rendererFrames(transitionFilm("wipe"), PAINT_SIZE, PAINT_SIZE);
  const dissolve = await rendererFrames(transitionFilm("dissolve"), PAINT_SIZE, PAINT_SIZE);
  const left = pixel(wipe[middle], PAINT_SIZE * 0.25, PAINT_SIZE / 2);
  const right = pixel(wipe[middle], PAINT_SIZE * 0.75, PAINT_SIZE / 2);
  const mixed = pixel(dissolve[middle], PAINT_SIZE / 2, PAINT_SIZE / 2);
  return {
    wipeLeft: left.join(","),
    wipeRight: right.join(","),
    dissolve: mixed.join(","),
    wipeOk: near(left, [0, 0, 255], 6) && near(right, [255, 0, 0], 6),
    dissolveOk: near(mixed, [64, 0, 128], 8),
  };
}

function textFilm(): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  const layer = { ...newTextLayer("MM MM"), id: "l-text", fill: "#ffffff", fontSize: 0.15, align: "center" as const };
  const title = { ...overlayClip(layer, 0, { x: 0.5, y: 0.5, w: 0.9, h: 0.3, rotation: 0, opacity: 1 }), id: "title", startMs: 0, durationMs: 1500 };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...title, textIn: { unit: "word" as const, style: "fade" as const, durationMs: 100, staggerMs: 600, easing: "linear" as const } }] }];
  doc.durationMs = 1500;
  return doc;
}

function litPixels(frame: Uint8Array, fromX: number, toX: number): number {
  let lit = 0;
  for (let y = PAINT_SIZE * 0.35; y < PAINT_SIZE * 0.65; y += PSNR_STEP) {
    for (let x = fromX; x < toX; x += PSNR_STEP) if (pixel(frame, x, y)[0] > 128) lit += 1;
  }
  return lit;
}

async function textUnits(): Promise<Report> {
  const frames = await rendererFrames(textFilm(), PAINT_SIZE, PAINT_SIZE);
  const at = (ms: number) => frames[Math.round(ms / (1000 / FPS))];
  const half = PAINT_SIZE / 2;
  const early = { left: litPixels(at(300), 0, half), right: litPixels(at(300), half, PAINT_SIZE) };
  const late = { left: litPixels(at(1000), 0, half), right: litPixels(at(1000), half, PAINT_SIZE) };
  return {
    early: `${early.left}/${early.right}`,
    late: `${late.left}/${late.right}`,
    staggerOk: early.left > 0 && early.right === 0 && late.right > 0 && Math.abs(late.left - late.right) <= late.left * 0.2,
  };
}

async function stripeFrames(doc: VideoDocument, width: number, height: number): Promise<number[]> {
  const found: number[] = [];
  const wake = new Wake();
  const videos = new DecodedVideos(openMediaWorker(), loadMediaFile, (id) => id, () => wake.notify());
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = await createPixiRenderer(canvas, { width, height, resolution: 1 }, studioRenderSources(videos), () => wake.notify());
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  await renderFrames({
    doc,
    times: frameTimes(doc.durationMs),
    videos,
    renderer,
    wake,
    emit: async () => {
      probe.drawImage(canvas, 0, 0);
      found.push(stripeIndex(probe.getImageData(0, 0, width, height).data, width, height / 2));
    },
    onProgress: () => undefined,
  });
  renderer.destroy();
  videos.dispose();
  return found;
}

async function speed(): Promise<Report> {
  const fast = singleClip("proxy.mp4", 1.5);
  fast.tracks[0].clips[0] = { ...fast.tracks[0].clips[0], speed: 2 };
  const backward = singleClip("proxy.mp4", 2);
  backward.tracks[0].clips[0] = { ...backward.tracks[0].clips[0], trimInMs: 1000, reverse: true };
  const size = videoCanvasSize(fast);
  const fastFrames = await stripeFrames(fast, size.width, size.height);
  const backFrames = await stripeFrames(backward, size.width, size.height);
  const fastWrong = fastFrames.filter((got, i) => got !== expectedFrame(sourceAt(fast.tracks[0].clips[0], exportFrameMs(i)))).length;
  const backWrong = backFrames.filter((got, i) => got !== expectedFrame(sourceAt(backward.tracks[0].clips[0], exportFrameMs(i)))).length;
  return { fastFrames: fastFrames.length, fastWrong, backFrames: backFrames.length, backWrong };
}

const GRADIENT_MAP: GradientMap = { stops: [{ at: 0, color: "#1b1464" }, { at: 0.6, color: "#e8505b" }, { at: 1, color: "#ffd166" }], intensity: 0.8 };

async function renderedBoard(board: Artboard, scene: Scene = imageScene(board, { hidden: new Set(), overrides: new Map() })): Promise<(x: number, y: number) => number[]> {
  const data = await boardPixels(board, scene);
  const { width } = board.canvas;
  return (x, y) => {
    const i = (Math.floor(y) * width + Math.floor(x)) * 4;
    return Array.from(data.slice(i, i + 3));
  };
}

async function boardPixels(board: Artboard, scene: Scene = imageScene(board, { hidden: new Set(), overrides: new Map() })): Promise<Uint8ClampedArray> {
  const { width, height } = board.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = await createPixiRenderer(canvas, { width, height, resolution: 1 }, studioRenderSources(null), () => undefined);
  const camera = fitCamera(scene, { width });
  renderer.render([scene], camera);
  for (let tries = 0; renderer.busy && tries < 300; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    renderer.render([scene], camera);
  }
  renderer.render([scene], camera);
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  probe.drawImage(canvas, 0, 0);
  renderer.destroy();
  return probe.getImageData(0, 0, width, height).data;
}

const PIXEL_SIZE = 200;
const PIXEL_GRID = 2;
const PIXEL_TOLERANCE = 3;

async function pixels(): Promise<Report> {
  const stroke: StrokeOp = { kind: "stroke", id: "paint", mode: "paint", color: "#ff0000", size: 30, hardness: 0.6, opacity: 1, points: [20, 100, 180, 100] };
  const erase: StrokeOp = { kind: "stroke", id: "erase", mode: "erase", size: 20, hardness: 1, opacity: 1, points: [150, 60, 150, 140] };
  const hide: StrokeOp = { kind: "stroke", id: "hide", mode: "hide", size: 100, hardness: 1, opacity: 1, points: [50, 0, 50, 200] };
  const photo: Layer = { ...newImageLayer("swatch.png", fullFrame()), id: "photo", mask: { width: PIXEL_SIZE, height: PIXEL_SIZE, ops: [hide] } };
  const ink: Layer = { ...newPaintLayer({ width: PIXEL_SIZE, height: PIXEL_SIZE }), id: "ink", surface: { width: PIXEL_SIZE, height: PIXEL_SIZE, ops: [stroke, erase] } };
  const board: Artboard = { ...emptyArtboard({ width: PIXEL_SIZE, height: PIXEL_SIZE }, "#0000ff"), layers: [photo, ink] };
  const gpu = await renderedBoard(board);
  const exported = (await rasterizeRegion(board.layers, PIXEL_SIZE, PIXEL_SIZE, { x: 0, y: 0, width: PIXEL_SIZE, height: PIXEL_SIZE }, { background: board.canvas.background })).getContext("2d")!.getImageData(0, 0, PIXEL_SIZE, PIXEL_SIZE).data;
  let worst = 0;
  let off = 0;
  for (let y = 0; y < PIXEL_SIZE; y += PIXEL_GRID) {
    for (let x = 0; x < PIXEL_SIZE; x += PIXEL_GRID) {
      const want = Array.from(exported.slice((y * PIXEL_SIZE + x) * 4, (y * PIXEL_SIZE + x) * 4 + 3));
      const diff = Math.max(...gpu(x, y).map((value, k) => Math.abs(value - want[k])));
      worst = Math.max(worst, diff);
      if (diff > PIXEL_TOLERANCE) off += 1;
    }
  }
  const samples = { stroke: gpu(110, 100), erased: gpu(150, 100), hidden: gpu(50, 30), photo: gpu(150, 30) };
  const expected = { stroke: [255, 0, 0], erased: [0x99, 0x66, 0x33], hidden: [0, 0, 255], photo: [0x99, 0x66, 0x33] };
  const wrong = (Object.keys(expected) as (keyof typeof expected)[]).filter((key) => !near(samples[key], expected[key], 12));
  return { worst, off, samples: Object.fromEntries(Object.entries(samples).map(([key, rgb]) => [key, rgb.join(",")])), wrong, pixelsOk: wrong.length === 0 && off === 0 };
}

const COMPONENT_HOST = 400;
const COMPONENT_STEP = 8;

async function components(): Promise<Report> {
  const pill: Layer = { ...newShapeLayer("rect", { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }), id: "pill", fill: "#ff0000", radius: 0.4 };
  const dot: Layer = { ...newShapeLayer("ellipse", { x: 0.85, y: 0.5, w: 0.1, h: 0.4, rotation: 0, opacity: 1 }), id: "dot", fill: "#00ff00" };
  const component: Artboard = { ...emptyArtboard({ width: 200, height: 100 }, ""), id: "cta", component: true, x: 0, y: -300, layers: [pill, dot] };
  const instance: Layer = { id: "inst", type: "instance", componentId: "cta", transform: { x: 0.5, y: 0.5, w: 0.75, h: 0.5, rotation: 0, opacity: 1 }, overrides: [{ layerId: "dot", fill: "#0000ff" }] };
  const host: Artboard = { ...emptyArtboard({ width: COMPONENT_HOST, height: COMPONENT_HOST }, "#ffffff"), id: "post", layers: [instance] };
  const byHand: Artboard = {
    ...host,
    layers: [
      { ...pill, id: "pill-by-hand", transform: { x: 0.5, y: 0.5, w: 0.75, h: 0.375, rotation: 0, opacity: 1 } },
      { ...dot, id: "dot-by-hand", fill: "#0000ff", transform: { x: 0.7625, y: 0.5, w: 0.075, h: 0.15, rotation: 0, opacity: 1 } },
    ],
  };
  const [scene] = artboardScenes({ schema: "studio.image", version: 2, artboards: [host, component] }, { hidden: new Set(), overrides: new Map() });
  const drawn = await renderedBoard(host, scene);
  const expected = await renderedBoard(byHand);
  let total = 0;
  let mismatched = 0;
  for (let y = COMPONENT_STEP / 2; y < COMPONENT_HOST; y += COMPONENT_STEP) {
    for (let x = COMPONENT_STEP / 2; x < COMPONENT_HOST; x += COMPONENT_STEP) {
      total += 1;
      if (!near(drawn(x, y), expected(x, y), 12)) mismatched += 1;
    }
  }
  const samples = { pill: drawn(120, 200), dot: drawn(305, 200), outside: drawn(200, 60) };
  const colorsOk = near(samples.pill, [255, 0, 0], 12) && near(samples.dot, [0, 0, 255], 12) && near(samples.outside, [255, 255, 255], 12);
  return { total, mismatched, samples: Object.fromEntries(Object.entries(samples).map(([key, rgb]) => [key, rgb.join(",")])), componentOk: colorsOk && mismatched <= total * 0.01 };
}

const HUG_BOARD = 400;

async function autoLayout(): Promise<Report> {
  await ensureFont("inter", 700, false);
  const base: Layer = { ...newShapeLayer("rect", { x: 0.1, y: 0.5, w: 0.1, h: 0.1, rotation: 0, opacity: 1 }), id: "base", fill: "#ffffff", groupId: "row" };
  const label: Layer = { ...newTextLayer("Compre agora", "heading"), id: "label", fontId: "inter", fontWeight: 700, fontSize: 0.1, align: "left", fill: "#000000", groupId: "row", layoutItem: { width: "hug", height: "hug" }, transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.1, rotation: 0, opacity: 1 } };
  const board: Artboard = { ...emptyArtboard({ width: HUG_BOARD, height: HUG_BOARD }, "#ffffff"), layers: [base, label], groups: [{ id: "row", baseId: "base", layout: { direction: "horizontal", width: "hug", height: "hug" } }] };
  const laid = layoutSurface(board, createHugMeasure(() => undefined));
  if (!laid) return { autoLayoutOk: false, reason: "layout refused" };
  const t = laid.layers.find((layer) => layer.id === "label")!.transform;
  const box = { left: (t.x - t.w / 2) * HUG_BOARD, right: (t.x + t.w / 2) * HUG_BOARD, top: (t.y - t.h / 2) * HUG_BOARD, bottom: (t.y + t.h / 2) * HUG_BOARD };
  const at = await renderedBoard(laid);
  let inkLeft = Infinity;
  let inkRight = -Infinity;
  for (let y = Math.max(0, Math.floor(box.top)); y < Math.min(HUG_BOARD, Math.ceil(box.bottom)); y += 2) {
    for (let x = 0; x < HUG_BOARD; x++) {
      if (at(x, y)[0] > 128) continue;
      inkLeft = Math.min(inkLeft, x);
      inkRight = Math.max(inkRight, x);
    }
  }
  const width = box.right - box.left;
  const autoLayoutOk = inkLeft >= box.left - 1.5 && inkRight <= box.right + 1.5 && inkRight - inkLeft >= width * 0.85 && t.w * HUG_BOARD !== 80;
  return { box: [box.left, box.right].map((v) => Math.round(v)).join("-"), ink: `${inkLeft}-${inkRight}`, autoLayoutOk };
}

async function gradientMap(): Promise<Report> {
  const photo = { ...newImageLayer("swatch.png", fullFrame()), id: "photo" };
  const plain = await renderedBoard({ ...emptyArtboard({ width: PAINT_SIZE, height: PAINT_SIZE }), layers: [photo] });
  const at = await renderedBoard({ ...emptyArtboard({ width: PAINT_SIZE, height: PAINT_SIZE }), layers: [{ ...photo, gradientMap: GRADIENT_MAP }] });
  const got = at(PAINT_SIZE / 2, PAINT_SIZE / 2);
  const want = new Uint8ClampedArray([...plain(PAINT_SIZE / 2, PAINT_SIZE / 2), 255]);
  mapGradientPixels(want, gradientMapLut(GRADIENT_MAP), GRADIENT_MAP.intensity);
  const expected = Array.from(want.slice(0, 3));
  return { got: got.join(","), want: expected.join(","), gradientMapOk: near(got, expected, 2) };
}

const LAYER_PAINT_SIZE = 400;

async function repeats(): Promise<Report> {
  const mirrored: Layer = { ...newShapeLayer("triangle", { x: 0.25, y: 0.5, w: 0.1, h: 0.1, rotation: 0, opacity: 1 }), id: "half", fill: "#ff0000", groupId: "mirror" };
  const tiled: Layer = { ...newShapeLayer("rect", { x: 0.75, y: 0.2, w: 0.05, h: 0.05, rotation: 0, opacity: 1 }), id: "tile", fill: "#00ff00", groupId: "grid" };
  const board: Artboard = {
    ...emptyArtboard({ width: LAYER_PAINT_SIZE, height: LAYER_PAINT_SIZE }, "#0000ff"),
    layers: [mirrored, tiled],
    groups: [
      { id: "mirror", repeat: { mode: "mirror", angle: 90, gap: 20 } },
      { id: "grid", repeat: { mode: "grid", rows: 2, columns: 2, gapX: 20, gapY: 20 } },
    ],
  };
  const at = await renderedBoard(board);
  const samples = { source: at(100, 210), copy: at(160, 210), axis: at(130, 210), cell: at(340, 120), gap: at(320, 100) };
  const expected = { source: [255, 0, 0], copy: [255, 0, 0], axis: [0, 0, 255], cell: [0, 255, 0], gap: [0, 0, 255] };
  const wrong = (Object.keys(expected) as (keyof typeof expected)[]).filter((key) => !near(samples[key], expected[key], 12));
  return { samples: Object.fromEntries(Object.entries(samples).map(([key, rgb]) => [key, rgb.join(",")])), wrong, repeatOk: wrong.length === 0 };
}

async function layerPaint(): Promise<Report> {
  const outlined: Layer = {
    ...newShapeLayer("rect", { x: 0.3, y: 0.5, w: 0.3, h: 0.5, rotation: 0, opacity: 1 }),
    id: "outlined",
    fill: undefined,
    fills: [{ type: "solid", color: "#ffffff", opacity: 1 }],
    strokes: [{ type: "solid", color: "#ff0000", opacity: 1, width: 10, align: "outside" }],
    effects: [{ id: "drop", type: "drop-shadow", color: "#000000", opacity: 1, x: 40, y: 0, blur: 0, spread: 0 }],
  };
  const striped: Layer = { ...newShapeLayer("rect", { x: 0.8, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 1 }), id: "striped", fill: "#ffffff", pattern: { source: "preset", presetId: "stripes", color: "#000000", size: 40, opacity: 1 } };
  const at = await renderedBoard({ ...emptyArtboard({ width: LAYER_PAINT_SIZE, height: LAYER_PAINT_SIZE }, "#0000ff"), layers: [outlined, striped] });
  const samples = { fill: at(120, 200), stroke: at(185, 200), shadow: at(215, 200), ground: at(260, 200), ink: at(320, 190), paper: at(320, 210) };
  const expected = { fill: [255, 255, 255], stroke: [255, 0, 0], shadow: [0, 0, 0], ground: [0, 0, 255], ink: [0, 0, 0], paper: [255, 255, 255] };
  const wrong = (Object.keys(expected) as (keyof typeof expected)[]).filter((key) => !near(samples[key], expected[key], 12));
  return { samples: Object.fromEntries(Object.entries(samples).map(([key, rgb]) => [key, rgb.join(",")])), wrong, layerPaintOk: wrong.length === 0 };
}

const GRADE: ColorGrade = { exposure: 0.6, contrast: 25, shadows: 30, highlights: -20, temperature: 30, tint: -10, saturation: 15, vibrance: 20 };

async function grade(): Promise<Report> {
  const doc = emptyVideoDocument("square");
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "swatch.png", 0, 200), id: "swatch", fit: "cover" as const, color: GRADE }] }];
  doc.durationMs = 200;
  const frames = await rendererFrames(doc, PAINT_SIZE, PAINT_SIZE);
  const got = pixel(frames[0], PAINT_SIZE / 2, PAINT_SIZE / 2);
  const want = gradePixel([0x99 / 255, 0x66 / 255, 0x33 / 255], GRADE).map((v) => Math.round(v * 255));
  return { got: got.join(","), want: want.join(","), gradeOk: near(got, want, 3) };
}

async function masks(): Promise<Report> {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  const ellipse = { ...newMask("ellipse", "m"), w: 0.5, h: 0.5, keyframes: { opacity: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 900, value: 1, easing: "linear" as const }] } };
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...swatch("base", "#ff0000", 0), masks: [ellipse] }] },
    { id: "v2", kind: "visual", clips: [{ ...swatch("matte", "#0000ff", 0), matte: true }] },
  ];
  doc.durationMs = 1000;
  const frames = await rendererFrames(doc, PAINT_SIZE, PAINT_SIZE);
  const last = frames[frames.length - 1];
  const start = pixel(frames[0], PAINT_SIZE / 2, PAINT_SIZE / 2);
  const center = pixel(last, PAINT_SIZE / 2, PAINT_SIZE / 2);
  const outside = pixel(last, PAINT_SIZE * 0.15, PAINT_SIZE / 2);
  return {
    start: start.join(","),
    center: center.join(","),
    outside: outside.join(","),
    maskOk: near(start, [0, 0, 0], 6) && near(center, [0, 0, 255], 6) && near(outside, [0, 0, 0], 6),
  };
}

function vfxFilm(vfx: Vfx[], base = swatch("base", "#808080", 0)): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [base] },
    { id: "v2", kind: "visual", clips: [{ ...newEffectClip(vfx, 0, 1000), id: "fx" }] },
  ];
  doc.durationMs = 1000;
  return doc;
}

const VFX_STACK: Vfx[] = [
  { ...newVfx("glitch", "glitch", 11), params: { frequency: 12, amount: 1 } },
  { ...newVfx("particles", "dust", 12), params: { count: 200, size: 8 } },
  { ...newVfx("lightLeak", "leak", 13) },
  { ...newVfx("lensFlare", "flare", 14) },
  { ...newVfx("chromaticAberration", "fringe", 16) },
  { ...newVfx("vignette", "edges", 17) },
  { ...newVfx("grain", "grain", 15), params: { amount: 0.6 } },
];

function sameFrames(a: readonly Uint8Array[], b: readonly Uint8Array[]): boolean {
  return a.length === b.length && a.every((frame, i) => frame.length === b[i].length && frame.every((value, k) => value === b[i][k]));
}

function vignetteWant(vfx: Vfx, x: number, y: number, box: { left: number; top: number; size: number }): number[] {
  const weight = vignetteWeight(vfxLook(vfx, 0), (x + 0.5 - box.left) / box.size, (y + 0.5 - box.top) / box.size, box.size, box.size);
  const level = Math.round(128 * (1 - weight * (vfx.params?.amount ?? 0)));
  return [level, level, level];
}

function brightCenter(frame: Uint8Array): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (let y = 0; y < PAINT_SIZE; y += PSNR_STEP) {
    for (let x = 0; x < PAINT_SIZE; x += PSNR_STEP) {
      if (pixel(frame, x, y)[0] < 128) continue;
      sx += x + PSNR_STEP / 2;
      sy += y + PSNR_STEP / 2;
      count += 1;
    }
  }
  return { x: sx / Math.max(1, count), y: sy / Math.max(1, count) };
}

async function vfx(): Promise<Report> {
  const vignette: Vfx = { ...newVfx("vignette", "v", 1), params: { amount: 0.8, size: 0.3, softness: 0.6 } };
  const [adjusted] = await rendererFrames(vfxFilm([vignette]), PAINT_SIZE, PAINT_SIZE, [0]);
  const full = { left: 0, top: 0, size: PAINT_SIZE };
  const points: [number, number][] = [[540, 540], [160, 540], [100, 100], [320, 760], [1000, 900]];
  const adjustWrong = points.filter(([x, y]) => !near(pixel(adjusted, x, y), vignetteWant(vignette, x, y, full), 3));
  const half = { ...swatch("half", "#808080", 0), transform: { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }, vfx: [vignette] };
  const clipDoc = vfxFilm([], half);
  clipDoc.tracks = [clipDoc.tracks[0]];
  const [clipped] = await rendererFrames(clipDoc, PAINT_SIZE, PAINT_SIZE, [0]);
  const box = { left: 270, top: 270, size: 540 };
  const clipPoints: [number, number][] = [[540, 540], [300, 300], [780, 560], [400, 760]];
  const clipWrong = clipPoints.filter(([x, y]) => !near(pixel(clipped, x, y), vignetteWant(vignette, x, y, box), 3));
  const stackDoc = vfxFilm(VFX_STACK);
  const first = await rendererFrames(stackDoc, PAINT_SIZE, PAINT_SIZE);
  const second = await rendererFrames(stackDoc, PAINT_SIZE, PAINT_SIZE);
  const times = frameTimes(stackDoc.durationMs);
  const shuffled = times.map((ms, i) => ({ ms, key: (i * 7919) % times.length })).sort((a, b) => a.key - b.key);
  const scattered = await rendererFrames(stackDoc, PAINT_SIZE, PAINT_SIZE, shuffled.map((entry) => entry.ms));
  const reordered = shuffled.map((entry, i) => ({ index: times.indexOf(entry.ms), frame: scattered[i] })).sort((a, b) => a.index - b.index).map((entry) => entry.frame);
  const grainDoc = vfxFilm([{ ...newVfx("grain", "g", 3), params: { amount: 1, rate: 10 } }]);
  const grain = await rendererFrames(grainDoc, PAINT_SIZE, PAINT_SIZE, [0, 33, 67, 100]);
  const shake: Vfx = { ...newVfx("shake", "s", 5), params: { amount: 1, rotation: 0 } };
  const dot = { ...swatch("dot", "#ffffff", 0), transform: { x: 0.5, y: 0.5, w: 0.1, h: 0.1, rotation: 0, opacity: 1 } };
  const [shaken] = await rendererFrames(vfxFilm([shake], dot), PAINT_SIZE, PAINT_SIZE, [400]);
  const offset = shakeAt(vfxLook(shake, 400), PAINT_SIZE, PAINT_SIZE);
  const center = brightCenter(shaken);
  const shakeError = Math.hypot(center.x - (540 + offset.dx), center.y - (540 + offset.dy));
  return {
    adjustWrong: adjustWrong.map(([x, y]) => `${x},${y}=${pixel(adjusted, x, y).join("/")} want ${vignetteWant(vignette, x, y, full).join("/")}`).join("; "),
    clipWrong: clipWrong.map(([x, y]) => `${x},${y}=${pixel(clipped, x, y).join("/")} want ${vignetteWant(vignette, x, y, box).join("/")}`).join("; "),
    shakeError: Number(shakeError.toFixed(2)),
    vignetteOk: adjustWrong.length === 0 && clipWrong.length === 0,
    repeatOk: sameFrames(first, second),
    seekOk: sameFrames(first, reordered),
    grainOk: sameFrames([grain[0], grain[1], grain[2]], [grain[1], grain[2], grain[0]]) && !sameFrames([grain[0]], [grain[3]]),
    shakeOk: shakeError <= 3,
  };
}

async function vfxExported(): Promise<Report> {
  return exportedPsnr(vfxFilm(VFX_STACK.filter((entry) => entry.kind !== "grain")));
}

async function exportedPsnr(doc: VideoDocument): Promise<Report> {
  const result = await exportInBrowser(doc, () => undefined);
  if (result.status !== "done") return { status: result.status };
  const input = new Input({ source: new BlobSource(result.file), formats: ALL_FORMATS });
  const track = (await input.getPrimaryVideoTrack())!;
  const width = await track.getDisplayWidth();
  const height = await track.getDisplayHeight();
  const expected = await rendererFrames(doc, width, height);
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  const scores: number[] = [];
  for await (const sample of new VideoSampleSink(track).samples()) {
    const index = Math.round(sample.timestamp * FPS);
    sample.draw(probe, 0, 0, width, height);
    sample.close();
    if (expected[index]) scores.push(psnr(sampled(probe.getImageData(0, 0, width, height).data, width, height), expected[index]));
  }
  scores.sort((a, b) => a - b);
  return { status: result.status, frames: scores.length, expectedFrames: expected.length, psnrMin: Number(scores[0]?.toFixed(1) ?? 0), psnrMedian: Number(scores[Math.floor(scores.length / 2)]?.toFixed(1) ?? 0) };
}

const BLEND_BACKDROP = "#407090";
const BLEND_SOURCE = "#c06030";
const BLEND_GRID = 4;

function blendTile(mode: BlendMode, index: number, fill: string) {
  const at = (cell: number) => (cell + 0.5) / BLEND_GRID;
  const transform = { x: at(index % BLEND_GRID), y: at(Math.floor(index / BLEND_GRID)), w: 0.6 / BLEND_GRID, h: 0.6 / BLEND_GRID, rotation: 0, opacity: 1 };
  return { ...overlayClip({ ...newShapeLayer("rect"), id: `l-${mode}`, fill, blendMode: mode }, 0, transform), id: `blend-${mode}`, startMs: 0, durationMs: 200 };
}

function rgbOf(color: string): Rgb {
  const parsed = parseColor(color)!;
  return [parsed.r / 255, parsed.g / 255, parsed.b / 255];
}

async function blend(): Promise<Report> {
  const modes = BLEND_MODES.filter((mode) => mode !== "normal");
  const doc = emptyVideoDocument("square");
  doc.tracks = [
    { id: "base", kind: "visual", clips: [{ ...swatch("backdrop", BLEND_BACKDROP, 0), durationMs: 200 }] },
    ...modes.map((mode, i) => ({ id: `t-${mode}`, kind: "visual" as const, clips: [blendTile(mode, i, BLEND_SOURCE)] })),
  ];
  doc.durationMs = 200;
  const [frame] = await rendererFrames(doc, PAINT_SIZE, PAINT_SIZE, [0]);
  const wrong = modes.flatMap((mode, i) => {
    const got = pixel(frame, ((i % BLEND_GRID) + 0.5) * (PAINT_SIZE / BLEND_GRID), (Math.floor(i / BLEND_GRID) + 0.5) * (PAINT_SIZE / BLEND_GRID));
    const want = blendColor(mode, rgbOf(BLEND_BACKDROP), rgbOf(BLEND_SOURCE)).map((v) => Math.round(v * 255));
    return near(got, want, 3) ? [] : [`${mode} got ${got.join(",")} want ${want.join(",")}`];
  });
  const gray = emptyVideoDocument("square");
  gray.tracks = [
    { id: "base", kind: "visual", clips: [{ ...swatch("backdrop", "#404040", 0), durationMs: 200 }] },
    { id: "over", kind: "visual", clips: [{ ...blendTile("overlay", 0, "#ffffff"), transform: { x: 0.25, y: 0.5, w: 0.5, h: 1, rotation: 0, opacity: 1 } }] },
    { id: "diff", kind: "visual", clips: [{ ...blendTile("difference", 1, "#ffffff"), transform: { x: 0.75, y: 0.5, w: 0.5, h: 1, rotation: 0, opacity: 1 } }] },
  ];
  gray.durationMs = 200;
  const [plain] = await rendererFrames(gray, PAINT_SIZE, PAINT_SIZE, [0]);
  const overlay = pixel(plain, PAINT_SIZE * 0.25, PAINT_SIZE / 2);
  const difference = pixel(plain, PAINT_SIZE * 0.75, PAINT_SIZE / 2);
  return {
    overlay: overlay.join(","),
    difference: difference.join(","),
    wrong: wrong.join("; "),
    blendOk: wrong.length === 0 && near(overlay, [128, 128, 128], 3) && near(difference, [191, 191, 191], 3),
  };
}

const CLIP_BLENDS: readonly BlendMode[] = ["add", "multiply", "screen"];
const SWATCH_RGB: Rgb = [0x99 / 255, 0x66 / 255, 0x33 / 255];

async function clipBlend(): Promise<Report> {
  const doc = emptyVideoDocument("square");
  doc.tracks = [
    { id: "base", kind: "visual", clips: [{ ...swatch("backdrop", BLEND_BACKDROP, 0), durationMs: 200 }] },
    ...CLIP_BLENDS.map((mode, i) => ({
      id: `m-${mode}`,
      kind: "visual" as const,
      clips: [{ ...newMediaClip("image", "swatch.png", 0, 200), id: `media-${mode}`, fit: "cover" as const, blendMode: mode, transform: { x: (i + 0.5) / CLIP_BLENDS.length, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } }],
    })),
  ];
  doc.durationMs = 200;
  const [frame] = await rendererFrames(doc, PAINT_SIZE, PAINT_SIZE, [0]);
  const wrong = CLIP_BLENDS.flatMap((mode, i) => {
    const got = pixel(frame, ((i + 0.5) / CLIP_BLENDS.length) * PAINT_SIZE, PAINT_SIZE / 2);
    const want = blendColor(mode, rgbOf(BLEND_BACKDROP), SWATCH_RGB).map((v) => Math.round(v * 255));
    return near(got, want, 3) ? [] : [`${mode} got ${got.join(",")} want ${want.join(",")}`];
  });
  return { wrong: wrong.join("; "), clipBlendOk: wrong.length === 0 };
}

const QUAD_COLORS: readonly [number, number, Rgb][] = [
  [0.25, 0.25, [1, 0, 0]],
  [0.75, 0.25, [0, 1, 0]],
  [0.25, 0.75, [0, 0, 1]],
  [0.75, 0.75, [1, 1, 1]],
];

function mixedRgb(under: Rgb, over: Rgb, weight: number): number[] {
  return under.map((u, c) => Math.round((u * (1 - weight) + over[c] * weight) * 255));
}

function quadFilm(member: Partial<Clip>, background = "#000000"): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = background;
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "quad.png", 0, 200), id: "quad", fit: "cover" as const, ...member }] }];
  doc.durationMs = 200;
  return doc;
}

async function mattes(): Promise<Report> {
  const lumaMatte: Matte = { channel: "luma", invert: false };
  const luma = quadFilm({});
  luma.tracks.push({ id: "v2", kind: "visual", clips: [{ ...swatch("over", "#ffff00", 0), durationMs: 200, matte: true, matteChannel: "luma" }] });
  const [lumaFrame] = await rendererFrames(luma, PAINT_SIZE, PAINT_SIZE, [0]);
  const lumaWrong = QUAD_COLORS.flatMap(([u, v, rgb]) => {
    const got = pixel(lumaFrame, u * PAINT_SIZE, v * PAINT_SIZE);
    const want = mixedRgb(rgb, [1, 1, 0], matteWeight(lumaMatte, [rgb[0], rgb[1], rgb[2], 1]));
    return near(got, want, 4) ? [] : [`luma at ${u},${v} got ${got.join(",")} want ${want.join(",")}`];
  });
  const inverted = emptyVideoDocument("square");
  inverted.canvas.background = "#000000";
  inverted.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...swatch("half", "#0000ff", 0), durationMs: 200, transform: { x: 0.25, y: 0.5, w: 0.5, h: 1, rotation: 0, opacity: 1 } }] },
    { id: "v2", kind: "visual", clips: [{ ...swatch("outside", "#ff0000", 0), durationMs: 200, matte: true, matteInvert: true }] },
  ];
  inverted.durationMs = 200;
  const [invertedFrame] = await rendererFrames(inverted, PAINT_SIZE, PAINT_SIZE, [0]);
  const inside = pixel(invertedFrame, PAINT_SIZE * 0.25, PAINT_SIZE / 2);
  const outside = pixel(invertedFrame, PAINT_SIZE * 0.75, PAINT_SIZE / 2);
  return {
    lumaWrong: lumaWrong.join("; "),
    inside: inside.join(","),
    outside: outside.join(","),
    lumaMatteOk: lumaWrong.length === 0,
    invertedMatteOk: near(inside, [0, 0, 255], 4) && near(outside, [255, 0, 0], 4),
  };
}

async function lumaKey(): Promise<Report> {
  const key = { ...newLumaKey("dark"), threshold: 0.1, softness: 0.2 };
  const background: Rgb = [1, 0, 1];
  const [frame] = await rendererFrames(quadFilm({ lumaKey: key }, "#ff00ff"), PAINT_SIZE, PAINT_SIZE, [0]);
  const wrong = QUAD_COLORS.flatMap(([u, v, rgb]) => {
    const got = pixel(frame, u * PAINT_SIZE, v * PAINT_SIZE);
    const want = mixedRgb(background, rgb, lumaAlpha(key, rgb));
    return near(got, want, 4) ? [] : [`at ${u},${v} got ${got.join(",")} want ${want.join(",")}`];
  });
  return { wrong: wrong.join("; "), lumaKeyOk: wrong.length === 0 };
}

const THUMBNAIL_CHANGE = 32;

async function decodedPixels(url: string, width: number, height: number): Promise<Uint8Array> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  probe.drawImage(image, 0, 0);
  return sampled(probe.getImageData(0, 0, width, height).data, width, height);
}

async function scaledFrame(doc: VideoDocument, atMs: number, width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const wake = new Wake();
  const renderer = await createPixiRenderer(canvas, { width, height, resolution: 1 }, studioRenderSources(null), () => wake.notify());
  await drawWhenReady(videoScene(doc, visualPlan(doc, atMs)), { videos: { sync: () => [], ready: () => true }, renderer, wake, viewWidth: width });
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  probe.drawImage(canvas, 0, 0);
  renderer.destroy();
  return sampled(probe.getImageData(0, 0, width, height).data, width, height);
}

async function thumbnails(): Promise<Report> {
  const { width, height } = EFFECT_SAMPLE_SIZE;
  const found = await effectThumbnails();
  const again = await effectThumbnails();
  const { doc, atMs } = plainSample();
  const plain = await scaledFrame(doc, atMs, width, height);
  const plainUrl = found.get(PLAIN_PREVIEW);
  const plainShown = plainUrl ? await decodedPixels(plainUrl, width, height) : null;
  const plainGap = plainShown ? plainShown.reduce((most, value, i) => Math.max(most, Math.abs(value - plain[i])), 0) : -1;
  const changes = await Promise.all(
    VFX_KINDS.map(async (kind) => {
      const url = found.get(kind);
      if (!url) return [kind, -1, 0] as const;
      const pixels = await decodedPixels(url, width, height);
      return [kind, pixels.reduce((most, value, i) => Math.max(most, Math.abs(value - plain[i])), 0), Math.max(...pixels) - Math.min(...pixels)] as const;
    }),
  );
  return {
    changes: changes.map(([kind, change, spread]) => `${kind} ${change}/${spread}`).join("; "),
    plainGap,
    thumbnailsOk: found.size === VFX_KINDS.length + 1 && plainGap >= 0 && plainGap <= 2 && changes.every(([, change, spread]) => change > THUMBNAIL_CHANGE && spread > THUMBNAIL_CHANGE * 2) && again === found,
  };
}

const LINE_BOX = { x: 0.5, y: 0.5, w: 0.8, h: 0.2, rotation: 0, opacity: 1 };
const LINE_WAVE = { amount: 60, wavelength: 400 };

function lineFilm(): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#000000";
  const layer = { ...newShapeLayer("line"), id: "l-line", stroke: "#ffffff", strokeWidth: 20 };
  const clip = {
    ...overlayClip(layer, 0, LINE_BOX),
    id: "line",
    startMs: 0,
    durationMs: 1000,
    line: { trim: { start: 0, end: 1, offset: 0 }, wave: { mode: "bend" as const, ...LINE_WAVE, speed: 0, phase: 0 } },
    keyframes: { trimEnd: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 1000, value: 1, easing: "linear" as const }] },
  };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [clip] }];
  doc.durationMs = 1000;
  return doc;
}

function onWave(s: number, side = 1): [number, number] {
  const left = (LINE_BOX.x - LINE_BOX.w / 2) * PAINT_SIZE;
  return [left + s, LINE_BOX.y * PAINT_SIZE + side * LINE_WAVE.amount * Math.sin((2 * Math.PI * s) / LINE_WAVE.wavelength)];
}

async function lineAnimation(): Promise<Report> {
  const times = [500, 900];
  const first = await rendererFrames(lineFilm(), PAINT_SIZE, PAINT_SIZE, times);
  const second = await rendererFrames(lineFilm(), PAINT_SIZE, PAINT_SIZE, times);
  const crest = onWave(100);
  const trough = onWave(300);
  const mirrored = onWave(100, -1);
  const pastHalf = onWave(600);
  const samples: [string, Uint8Array, [number, number], boolean][] = [
    ["crest", first[0], crest, true],
    ["trough", first[0], trough, true],
    ["mirrored", first[0], mirrored, false],
    ["pastTrimEnd", first[0], pastHalf, false],
    ["drawnLater", first[1], pastHalf, true],
  ];
  const wrong = samples.filter(([, frame, [x, y], lit]) => (lit ? pixel(frame, x, y)[0] < 200 : pixel(frame, x, y)[0] > 30));
  return {
    samples: samples.map(([name, frame, [x, y]]) => `${name} ${Math.round(x)},${Math.round(y)}=${pixel(frame, x, y)[0]}`).join("; "),
    wrong: wrong.map(([name]) => name).join(","),
    lineOk: wrong.length === 0,
    repeatOk: sameFrames(first, second),
  };
}

const CHROMA_EDGE_TOLERANCE = 4;

async function chroma(): Promise<Report> {
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#0000ff";
  const key = newChromaKey();
  doc.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "green-screen.png", 0, 200), id: "screen", fit: "cover" as const, chromaKey: key }] }];
  doc.durationMs = 200;
  const frames = await rendererFrames(doc, PAINT_SIZE, PAINT_SIZE);
  const keyed = pixel(frames[0], PAINT_SIZE * 0.25, PAINT_SIZE / 2);
  const subject = pixel(frames[0], PAINT_SIZE * 0.75, PAINT_SIZE / 2);
  const want = chromaPixel(key, [0x99 / 255, 0x66 / 255, 0x33 / 255]).rgb.map((v) => Math.round(v * 255));
  const layer = { ...newImageLayer("green-screen.png", fullFrame()), id: "screen", chromaKey: key };
  const board = await renderedBoard({ ...emptyArtboard({ width: PAINT_SIZE, height: PAINT_SIZE }, "#0000ff"), layers: [layer] });
  const layerKeyed = board(PAINT_SIZE * 0.25, PAINT_SIZE / 2);
  const layerSubject = board(PAINT_SIZE * 0.75, PAINT_SIZE / 2);
  const edge = Array.from({ length: 13 }, (_, i) => PAINT_SIZE / 2 - 24 + i * PSNR_STEP);
  const edgeGap = Math.max(...edge.map((x) => Math.max(...pixel(frames[0], x, PAINT_SIZE / 2).map((v, c) => Math.abs(v - board(x, PAINT_SIZE / 2)[c])))));
  return {
    keyed: keyed.join(","),
    subject: subject.join(","),
    want: want.join(","),
    layerKeyed: layerKeyed.join(","),
    layerSubject: layerSubject.join(","),
    edgeGpu: edge.map((x) => pixel(frames[0], x, PAINT_SIZE / 2).join("/")).join(" "),
    edgeLayer: edge.map((x) => board(x, PAINT_SIZE / 2).join("/")).join(" "),
    edgeGap,
    chromaOk: near(keyed, [0, 0, 255], 4) && near(subject, want, 3),
    layerChromaOk: near(layerKeyed, [0, 0, 255], 4) && near(layerSubject, want, 3) && edgeGap <= CHROMA_EDGE_TOLERANCE,
  };
}

const EXPORT_RANGE: TimeSpan = { startMs: 500, endMs: 1500 };
const FRAME_AT_MS = 1234;

async function exported(range?: TimeSpan): Promise<Report> {
  const doc = exportFilm();
  const span = range ?? { startMs: 0, endMs: doc.durationMs };
  const firstFrame = expectedFrame(span.startMs);
  const started = performance.now();
  const result = await exportInBrowser(doc, () => undefined, range ? { format: "mp4", range } : undefined);
  if (result.status !== "done") return { status: result.status };
  const encodeMs = Math.round(performance.now() - started);
  const input = new Input({ source: new BlobSource(result.file), formats: ALL_FORMATS });
  const track = (await input.getPrimaryVideoTrack())!;
  const width = await track.getDisplayWidth();
  const height = await track.getDisplayHeight();
  const expected = await rendererFrames(doc, width, height, frameTimes(spanLength(span)).map((ms) => span.startMs + ms));
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  const scores: number[] = [];
  let frames = 0;
  let wrongSource = 0;
  for await (const sample of new VideoSampleSink(track).samples()) {
    const index = Math.round(sample.timestamp * FPS);
    sample.draw(probe, 0, 0, width, height);
    sample.close();
    const data = probe.getImageData(0, 0, width, height).data;
    if (stripeIndex(data, width, Math.floor(height * 0.75)) !== firstFrame + index) wrongSource += 1;
    if (expected[index]) scores.push(psnr(sampled(data, width, height), expected[index]));
    frames += 1;
  }
  let peak = 0;
  const audioTrack = await input.getPrimaryAudioTrack();
  if (audioTrack) {
    for await (const sample of new AudioSampleSink(audioTrack).samples()) {
      const buffer = sample.toAudioBuffer();
      for (let c = 0; c < buffer.numberOfChannels; c++) for (const value of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(value));
      sample.close();
    }
  }
  scores.sort((a, b) => a - b);
  return {
    status: result.status,
    encodeMs,
    sizeKB: Math.round(result.file.size / 1024),
    codec: await track.getCodecParameterString(),
    audioCodec: audioTrack ? await audioTrack.getCodecParameterString() : null,
    frames,
    expectedFrames: expected.length,
    durationMs: Math.round((await track.computeDuration()) * 1000),
    spanMs: spanLength(span),
    wrongSource,
    psnrMin: Number(scores[0]?.toFixed(1) ?? 0),
    psnrMedian: Number(scores[Math.floor(scores.length / 2)]?.toFixed(1) ?? 0),
    audioPeak: Number(peak.toFixed(3)),
  };
}

const SOUND_TOLERANCE_DB = 0.5;
const SILENT_SIDE_DB = -40;
const SOUND_WINDOW_MS = 100;

function soundFilm(): VideoDocument {
  const doc = emptyVideoDocument("square");
  const tone = (id: string, file: string, startMs: number, extra: Partial<Clip> = {}): Clip => ({ ...newMediaClip("audio", file, startMs, 2000), id, ...extra });
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...swatch("bg", "#303030", 0), durationMs: 9000 }] },
    { id: "a1", kind: "audio", clips: [tone("pa", "low.m4a", 0), tone("pb", "high.m4a", 2000, { trimInMs: 1000 }), tone("ga", "low.m4a", 4000), tone("gb", "high.m4a", 6000, { trimInMs: 1000 })] },
    { id: "a2", kind: "audio", clips: [tone("left", "low.m4a", 8000, { durationMs: 500, pan: -1 }), tone("right", "low.m4a", 8500, { durationMs: 500, pan: 0.5 })] },
  ];
  doc.durationMs = 9000;
  let next = doc;
  for (const [fromClipId, toClipId, kind] of [["pa", "pb", "constantPower"], ["ga", "gb", "constantGain"]] as const) {
    const result = addTransition(next, { fromClipId, toClipId, kind, durationMs: 1000 });
    if (!result.ok) throw new Error(result.reason);
    next = result.document;
  }
  return next;
}

function rmsDb(channel: Float32Array, rate: number, fromMs: number, toMs: number): number {
  const from = Math.round((fromMs * rate) / 1000);
  const to = Math.min(channel.length, Math.round((toMs * rate) / 1000));
  let sum = 0;
  for (let i = from; i < to; i++) sum += channel[i] * channel[i];
  return 10 * Math.log10(Math.max(1e-12, sum / Math.max(1, to - from)));
}

async function exportedChannels(file: Blob): Promise<{ channels: Float32Array[]; rate: number }> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryAudioTrack();
  if (!track) return { channels: [], rate: 0 };
  const pieces: { at: number; data: Float32Array[] }[] = [];
  let rate = 0;
  for await (const sample of new AudioSampleSink(track).samples()) {
    const buffer = sample.toAudioBuffer();
    rate = buffer.sampleRate;
    pieces.push({ at: Math.round(sample.timestamp * rate), data: Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c).slice()) });
    sample.close();
  }
  const length = Math.max(0, ...pieces.map((piece) => piece.at + piece.data[0].length));
  const channels = Array.from({ length: pieces[0]?.data.length ?? 0 }, () => new Float32Array(length));
  for (const piece of pieces) piece.data.forEach((data, c) => channels[c].set(data, Math.max(0, piece.at)));
  return { channels, rate };
}

async function sound(): Promise<Report> {
  const result = await exportInBrowser(soundFilm(), () => undefined);
  if (result.status !== "done") return { status: result.status };
  const { channels, rate } = await exportedChannels(result.file);
  if (channels.length !== 2) return { status: "done", channels: channels.length };
  const [left, right] = channels;
  const level = (side: Float32Array, centerMs: number) => rmsDb(side, rate, centerMs - SOUND_WINDOW_MS, centerMs + SOUND_WINDOW_MS);
  const centred = (low: number, high: number) => ({ low: level(left, low), high: level(left, high) });
  const sum = (kind: "constantPower" | "constantGain", reference: { low: number; high: number }) =>
    10 * Math.log10(crossfadeLevel(kind, "linear", "from", 0.5) ** 2 * 10 ** (reference.low / 10) + crossfadeLevel(kind, "linear", "to", 0.5) ** 2 * 10 ** (reference.high / 10));
  const steady = centred(700, 3300);
  const powerGot = level(left, 2000);
  const powerWant = sum("constantPower", steady);
  const gainSteady = centred(4700, 7300);
  const gainGot = level(left, 6000);
  const gainWant = sum("constantGain", gainSteady);
  const hardLeft = panGains(-1, 0, 1);
  const halfRight = panGains(0.5, 0, 1);
  const centre = steady.low;
  const leftGot = { left: level(left, 8250) - centre, right: level(right, 8250) - centre };
  const rightGot = { left: level(left, 8750) - centre, right: level(right, 8750) - centre };
  const rightWant = { left: 20 * Math.log10(halfRight.left), right: 20 * Math.log10(halfRight.right) };
  const close = (got: number, want: number) => Math.abs(got - want) <= SOUND_TOLERANCE_DB;
  const round = (value: number) => Number(value.toFixed(2));
  return {
    status: "done",
    powerDipDb: round(powerGot - (steady.low + steady.high) / 2),
    powerWantDb: round(powerWant - (steady.low + steady.high) / 2),
    gainDipDb: round(gainGot - (gainSteady.low + gainSteady.high) / 2),
    gainWantDb: round(gainWant - (gainSteady.low + gainSteady.high) / 2),
    hardLeftDb: `${round(leftGot.left)} / ${round(leftGot.right)}`,
    halfRightDb: `${round(rightGot.left)} / ${round(rightGot.right)}`,
    halfRightWantDb: `${round(rightWant.left)} / ${round(rightWant.right)}`,
    crossfadeOk: close(powerGot, powerWant) && close(gainGot, gainWant),
    panOk: close(leftGot.left, 20 * Math.log10(hardLeft.left)) && leftGot.right <= SILENT_SIDE_DB && close(rightGot.left, rightWant.left) && close(rightGot.right, rightWant.right),
  };
}

async function animated(format: AnimationExportRequest["format"], range?: TimeSpan): Promise<Report> {
  const doc = exportFilm();
  const span = range ?? { startMs: 0, endMs: doc.durationMs };
  const canvas = videoCanvasSize(doc);
  const request = { ...defaultVideoExport(format, canvas), width: 320, fps: 15, ...(format === "gif" ? { dither: "none" } : {}), ...(range ? { range } : {}) } as AnimationExportRequest;
  const result = await exportAnimationInBrowser(doc, request, () => undefined);
  if (result.status !== "done") return { status: result.reason };
  const size = animationSize(canvas, request.width);
  const times = frameTimes(spanLength(span), request.fps).map((ms) => span.startMs + ms);
  const decoder = new ImageDecoder({ data: await result.file.arrayBuffer(), type: result.file.type });
  await decoder.tracks.ready;
  const track = decoder.tracks.selectedTrack!;
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = size.width;
  probe.canvas.height = size.height;
  let wrong = 0;
  let totalUs = 0;
  for (let i = 0; i < track.frameCount; i++) {
    const { image } = await decoder.decode({ frameIndex: i });
    totalUs += image.duration ?? 0;
    probe.drawImage(image, 0, 0, size.width, size.height);
    image.close();
    if (stripeIndex(probe.getImageData(0, 0, size.width, size.height).data, size.width, Math.floor(size.height * 0.75)) !== expectedFrame(times[i] ?? -1) % 256) wrong += 1;
  }
  decoder.close();
  return { status: "done", sizeKB: Math.round(result.file.size / 1024), frames: track.frameCount, expectedFrames: times.length, wrong, durationMs: Math.round(totalUs / 1000), filmMs: spanLength(span) };
}

async function exportedFrame(doc: VideoDocument, atMs: number, width: number, height: number): Promise<Uint8Array | null> {
  const result = await exportFrameInBrowser(doc, { format: "png", atMs }, () => undefined);
  if (result.status !== "done") return null;
  const bitmap = await createImageBitmap(result.file);
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  probe.drawImage(bitmap, 0, 0, width, height);
  return sampled(probe.getImageData(0, 0, width, height).data, width, height);
}

async function frameExported(): Promise<Report> {
  const doc = exportFilm();
  const result = await exportFrameInBrowser(doc, { format: "png", atMs: FRAME_AT_MS }, () => undefined);
  if (result.status !== "done") return { status: result.reason };
  const { width, height } = videoCanvasSize(doc);
  const bitmap = await createImageBitmap(result.file);
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  probe.drawImage(bitmap, 0, 0, width, height);
  const shown = stripeIndex(probe.getImageData(0, 0, width, height).data, width, Math.floor(height * 0.75));
  return { status: "done", type: result.file.type, width: bitmap.width, height: bitmap.height, shown, expected: expectedFrame(FRAME_AT_MS) };
}

const QUADRANTS = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 255],
];
const PLACEMENT_EDGE_PX = 4;
const PLACEMENT_TOLERANCE = 12;
const PATH_DRIFT_LIMIT = 1e-9;

function placementFilm(): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.canvas.background = "#000000";
  const side = 0.16;
  const placed: Clip = {
    ...newMediaClip("image", "quad.png", 0, 1000),
    id: "placed",
    transform: { x: 0.5, y: 0.5, w: side, h: side * canvasAspect(doc), rotation: 20, opacity: 1 },
    anchor: { x: 0.2, y: 0.8 },
    flipX: true,
    autoOrient: true,
    keyframes: {
      scaleX: [
        { atMs: 0, value: 1.4, easing: "easeInOut" },
        { atMs: 1000, value: 0.8, easing: "linear" },
      ],
      scaleY: [
        { atMs: 0, value: 0.7, easing: "linear" },
        { atMs: 1000, value: 1.2, easing: "linear" },
      ],
      position: [
        { atMs: 0, x: 0.25, y: 0.65, easing: "easeInOut", spatial: "auto" },
        { atMs: 500, x: 0.5, y: 0.3, easing: "easeOut", spatial: "smooth", in: { x: -0.15, y: 0 }, out: { x: 0.15, y: 0 } },
        { atMs: 1000, x: 0.75, y: 0.6, easing: "linear", spatial: "auto" },
      ],
    },
  };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [placed] }];
  doc.durationMs = 1000;
  return doc;
}

function quadrantAt(u: number, v: number): number[] {
  return QUADRANTS[(v < 0.5 ? 0 : 2) + (u < 0.5 ? 0 : 1)];
}

function edgeDistancePx(local: { x: number; y: number }, inside: boolean, boxW: number, boxH: number): number {
  if (!inside) return Math.hypot(Math.max(0, -local.x, local.x - 1) * boxW, Math.max(0, -local.y, local.y - 1) * boxH);
  return Math.min(...[0, 0.5, 1].map((edge) => Math.abs(local.x - edge) * boxW), ...[0, 0.5, 1].map((edge) => Math.abs(local.y - edge) * boxH));
}

async function placement(): Promise<Report> {
  const doc = placementFilm();
  const clip = doc.tracks[0].clips[0];
  const path = clip.keyframes?.position ?? [];
  const aspect = canvasAspect(doc);
  const { width, height } = videoCanvasSize(doc);
  const frames = await rendererFrames(doc, width, height);
  const columns = Math.ceil(width / PSNR_STEP);
  let checked = 0;
  let wrong = 0;
  let worst = 0;
  let pathDrift = 0;
  let firstWrong: string | null = null;
  frames.forEach((frame, index) => {
    const ms = exportFrameMs(index);
    const placed = placementAt(clip, ms, aspect);
    const pivot = placedPivot(placed, anchorOf(clip), aspect);
    const traced = pivotFrom(clip, positionAt(path, ms, aspect));
    pathDrift = Math.max(pathDrift, Math.hypot(pivot.x - traced.x, pivot.y - traced.y));
    const boxW = placed.w * width;
    const boxH = placed.h * height;
    for (let y = 0; y < height; y += PSNR_STEP) {
      for (let x = 0; x < width; x += PSNR_STEP) {
        const local = anchorAt(placed, { x: (x + 0.5) / width, y: (y + 0.5) / height }, aspect);
        const inside = local.x > 0 && local.x < 1 && local.y > 0 && local.y < 1;
        if (edgeDistancePx(local, inside, boxW, boxH) < PLACEMENT_EDGE_PX) continue;
        const want = inside ? quadrantAt(clip.flipX ? 1 - local.x : local.x, clip.flipY ? 1 - local.y : local.y) : [0, 0, 0];
        const i = ((y / PSNR_STEP) * columns + x / PSNR_STEP) * 3;
        const got = [frame[i], frame[i + 1], frame[i + 2]];
        const diff = Math.max(...got.map((value, c) => Math.abs(value - want[c])));
        checked += 1;
        worst = Math.max(worst, diff);
        if (diff <= PLACEMENT_TOLERANCE) continue;
        wrong += 1;
        firstWrong ??= `frame ${index} at ${x},${y}: got ${got.join(",")} expected ${want.join(",")}`;
      }
    }
  });
  return { frames: frames.length, checked, wrong, worst, firstWrong, pathDrift, placementOk: frames.length > 0 && checked > 0 && wrong === 0 && pathDrift <= PATH_DRIFT_LIMIT };
}

async function main() {
  report.proxy = await decoding("proxy.mp4");
  report.original = await decoding("original.mp4");
  report.stills = await stills("proxy.mp4");
  report.export = await exported();
  report.sound = await sound();
  report.gif = await animated("gif");
  report.webp = await animated("webp");
  report.rangeMp4 = await exported(EXPORT_RANGE);
  report.rangeGif = await animated("gif", EXPORT_RANGE);
  report.rangeWebp = await animated("webp", EXPORT_RANGE);
  report.frame = await frameExported();
  report.paint = await paint();
  report.transitions = await transitions();
  report.edgeTransitions = await edgeTransitionParity(rendererFrames, PSNR_STEP);
  report.transitionPreviews = await transitionPreviewParity(scaledFrame, decodedPixels, THUMBNAIL_CHANGE);
  report.text = await textUnits();
  report.speed = await speed();
  report.grade = await grade();
  report.colorFinish = await colorFinishParity(rendererFrames, PSNR_STEP);
  report.remap = await remapParity(stripeFrames, rendererFrames, PSNR_STEP);
  report.gradientMap = await gradientMap();
  report.layerPaint = await layerPaint();
  report.repeats = await repeats();
  report.components = await components();
  report.autoLayout = await autoLayout();
  report.masks = await masks();
  report.placement = await placement();
  report.chroma = await chroma();
  report.line = await lineAnimation();
  report.pathOps = await pathOpParity(rendererFrames, PSNR_STEP, (board) => renderedBoard(board));
  report.repeater = await repeaterParity(rendererFrames, PSNR_STEP);
  report.thumbnails = await thumbnails();
  report.blend = await blend();
  report.clipBlend = await clipBlend();
  report.mattes = await mattes();
  report.lumaKey = await lumaKey();
  report.vfx = await vfx();
  report.vfxExport = await vfxExported();
  report.stillVfx = await stillVfxParity({ boardPixels, sampled, psnr });
  report.vfxPack = await vfxPackParity({ rendererFrames, exportedPsnr });
  report.pixels = await pixels();
  report.glyphs = await textGlyphs(rendererFrames, PSNR_STEP);
  report.animators = await animatorUnits(rendererFrames, PSNR_STEP);
  report.richText = await richTextRuns(rendererFrames, PSNR_STEP);
  report.parenting = await parentingParity(rendererFrames, PSNR_STEP);
  report.groups = await groupParity(rendererFrames, PSNR_STEP);
  report.groupSound = await groupSoundParity(exportedChannels, rmsDb);
  report.tracking = await trackingParity();
  report.behaviors = await behaviorParity(rendererFrames, PSNR_STEP);
  report.morph = await morphParity(rendererFrames, PSNR_STEP);
  report.clipStyle = await clipStyleParity(rendererFrames, PSNR_STEP);
  report.motionBlur = await motionBlurParity(rendererFrames, PSNR_STEP);
  report.tilt = await tiltParity(rendererFrames, PSNR_STEP);
  report.adjustmentMask = await maskedCurvesParity(rendererFrames, PSNR_STEP);
  report.adjustmentCamera = await cameraParity(rendererFrames, PSNR_STEP);
  report.guides = await guideParity(rendererFrames, exportedChannels, rmsDb);
  report.frames = await frameParity(rendererFrames, renderedBoard, PSNR_STEP);
  report.stickers = await stickerParity(rendererFrames, renderedBoard, PSNR_STEP);
  report.charts = await chartParity(renderedBoard, rendererFrames, PSNR_STEP);
  report.lottie = await lottieParity(rendererFrames, exportedFrame, PSNR_STEP);
  report.generated = await generatedParity(renderedBoard, rendererFrames, PSNR_STEP);
  report.done = true;
}

main().catch((error: unknown) => {
  report.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
});
