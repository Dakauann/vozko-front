import { ALL_FORMATS, AudioSampleSink, BlobSource, Input, VideoSampleSink } from "mediabunny";

import { loadMediaFile } from "@/components/studio/canvas/media-files";
import { DecodedStills } from "@/components/studio/media/decoded-stills";
import { DecodedVideos } from "@/components/studio/media/decoded-videos";
import { openMediaWorker } from "@/components/studio/media/media-worker";
import { createPixiRenderer } from "@/components/studio/render/pixi-renderer";
import { studioRenderSources } from "@/components/studio/render/studio-sources";
import { exportInBrowser } from "@/components/studio/video/export/browser-export";
import { renderFrames, Wake } from "@/components/studio/video/export/frame-loop";
import { emptyVideoDocument, newMediaClip, newShapeLayer, newTextLayer, type VideoDocument } from "@/lib/studio/document";
import { overlayClip } from "@/lib/studio/media-clips";
import { stillSeconds } from "@/lib/studio/media/stills";
import { visualPlan } from "@/lib/studio/playback";
import { fitCamera } from "@/lib/studio/render/renderer";
import { videoSources } from "@/lib/studio/scene/scene";
import { videoScene } from "@/lib/studio/scene/video-scene";

const FPS = 30;
const CLIP_SECONDS = 4;
const PSNR_STEP = 4;

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

async function rendererFrames(doc: VideoDocument, width: number, height: number): Promise<Uint8Array[]> {
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
  await renderFrames({
    doc,
    videos,
    renderer,
    wake,
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

async function exported(): Promise<Report> {
  const doc = exportFilm();
  const started = performance.now();
  const result = await exportInBrowser(doc, () => undefined);
  if (result.status !== "done") return { status: result.status };
  const encodeMs = Math.round(performance.now() - started);
  const input = new Input({ source: new BlobSource(result.video), formats: ALL_FORMATS });
  const track = (await input.getPrimaryVideoTrack())!;
  const width = await track.getDisplayWidth();
  const height = await track.getDisplayHeight();
  const expected = await rendererFrames(doc, width, height);
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
    if (stripeIndex(data, width, Math.floor(height * 0.75)) !== index) wrongSource += 1;
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
    sizeKB: Math.round(result.video.size / 1024),
    codec: await track.getCodecParameterString(),
    audioCodec: audioTrack ? await audioTrack.getCodecParameterString() : null,
    frames,
    expectedFrames: expected.length,
    wrongSource,
    psnrMin: Number(scores[0]?.toFixed(1) ?? 0),
    psnrMedian: Number(scores[Math.floor(scores.length / 2)]?.toFixed(1) ?? 0),
    audioPeak: Number(peak.toFixed(3)),
  };
}

async function main() {
  report.proxy = await decoding("proxy.mp4");
  report.original = await decoding("original.mp4");
  report.stills = await stills("proxy.mp4");
  report.export = await exported();
  report.done = true;
}

main().catch((error: unknown) => {
  report.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
});
