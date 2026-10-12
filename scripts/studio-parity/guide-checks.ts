import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from "mediabunny";

import { exportInBrowser } from "@/components/studio/video/export/browser-export";
import { exportFrameInBrowser } from "@/components/studio/video/export/frame-export";
import { emptyVideoDocument, newMediaClip, videoCanvasSize, type Clip, type VideoDocument } from "@/lib/studio/document";

type Frames = (doc: VideoDocument, width: number, height: number, times: readonly number[]) => Promise<Uint8Array[]>;
type Channels = (file: Blob) => Promise<{ channels: Float32Array[]; rate: number }>;
type Level = (channel: Float32Array, rate: number, fromMs: number, toMs: number) => number;

const DURATION_MS = 2000;
const AT_MS = 1000;
const SWATCH = [0x99, 0x66, 0x33];
const TOLERANCE = 14;
const SILENCE_BELOW_DB = 40;
const LEVEL_WINDOW_MS = 300;

function film(): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  doc.canvas.background = "#000000";
  const picture: Clip = { ...newMediaClip("image", "swatch.png", 0, DURATION_MS), id: "picture" };
  const guide: Clip = { ...newMediaClip("image", "quad.png", 0, DURATION_MS), id: "guide", guide: true };
  const reference: Clip = { ...newMediaClip("audio", "tone-b.m4a", DURATION_MS, DURATION_MS), id: "reference" };
  const guideTone: Clip = { ...newMediaClip("audio", "tone-a.m4a", 0, DURATION_MS), id: "guide-tone", guide: true };
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [picture] },
    { id: "v2", kind: "visual", clips: [guide] },
    { id: "a1", kind: "audio", clips: [reference] },
    { id: "a2", kind: "audio", clips: [guideTone] },
  ];
  doc.durationMs = DURATION_MS * 2;
  return doc;
}

function swatchShare(pixels: ArrayLike<number>, stride: number): number {
  let matching = 0;
  let total = 0;
  for (let i = 0; i + 2 < pixels.length; i += stride) {
    total += 1;
    if (SWATCH.every((value, c) => Math.abs(pixels[i + c] - value) <= TOLERANCE)) matching += 1;
  }
  return total === 0 ? 0 : matching / total;
}

async function imagePixels(file: Blob, width: number, height: number): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(file);
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  probe.drawImage(bitmap, 0, 0, width, height);
  return probe.getImageData(0, 0, width, height).data;
}

async function videoFramePixels(file: Blob, width: number, height: number, atMs: number): Promise<Uint8ClampedArray | null> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) return null;
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  probe.canvas.width = width;
  probe.canvas.height = height;
  let found: Uint8ClampedArray | null = null;
  for await (const sample of new VideoSampleSink(track).samples()) {
    if (found === null && sample.timestamp * 1000 >= atMs - 1) {
      sample.draw(probe, 0, 0, width, height);
      found = probe.getImageData(0, 0, width, height).data;
    }
    sample.close();
  }
  return found;
}

export async function guideParity(frames: Frames, channelsOf: Channels, level: Level): Promise<Record<string, unknown>> {
  const doc = film();
  const { width, height } = videoCanvasSize(doc);
  const [preview] = await frames(doc, width, height, [AT_MS]);
  const previewSwatch = swatchShare(preview, 3);
  const still = await exportFrameInBrowser(doc, { format: "png", atMs: AT_MS }, () => undefined);
  const stillSwatch = still.status === "done" ? swatchShare(await imagePixels(still.file, width, height), 4) : 0;
  const movie = await exportInBrowser(doc, () => undefined);
  if (movie.status !== "done") return { status: movie.status, previewSwatch, stillSwatch };
  const moviePixels = await videoFramePixels(movie.file, width, height, AT_MS);
  const movieSwatch = moviePixels ? swatchShare(moviePixels, 4) : 0;
  const { channels, rate } = await channelsOf(movie.file);
  const around = (ms: number) => level(channels[0], rate, ms - LEVEL_WINDOW_MS, ms + LEVEL_WINDOW_MS);
  const guideDb = around(AT_MS);
  const referenceDb = around(DURATION_MS + AT_MS);
  const round = (value: number) => Number(value.toFixed(3));
  return {
    status: "done",
    previewSwatch: round(previewSwatch),
    stillSwatch: round(stillSwatch),
    movieSwatch: round(movieSwatch),
    guideDb: round(guideDb),
    referenceDb: round(referenceDb),
    guideOk: previewSwatch < 0.05 && stillSwatch > 0.98 && movieSwatch > 0.95 && guideDb < referenceDb - SILENCE_BELOW_DB,
  };
}
