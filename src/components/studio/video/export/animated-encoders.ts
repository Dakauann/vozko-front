"use client";

import {
  animationSize,
  createFrameHold,
  gifDelaysCs,
  gifRepeat,
  MAX_GIF_DELAY_CS,
  MAX_WEBP_DELAY_MS,
  PaletteSample,
  paletteSampleTimes,
  requestSpan,
  samePixels,
  webpDelaysMs,
  type AnimationExportRequest,
  type GifExportRequest,
  type WebpExportRequest,
} from "@/lib/studio/animated-export";
import { videoCanvasSize, type VideoDocument } from "@/lib/studio/document";
import { exportedDocument } from "@/lib/studio/organize";
import type { ExportPhase } from "@/lib/studio/export";
import { frameTimes, MAX_BROWSER_EXPORT_BYTES } from "@/lib/studio/export-encoding";
import { createNearestIndex, indexPixels } from "@/lib/studio/gif-palette";
import { muxAnimatedWebp, readStillWebp, type WebpFrame } from "@/lib/studio/webp-mux";
import { spanLength, type TimeSpan } from "@/lib/studio/work-area";

import { renderFrames, type FrameLoopDeps } from "./frame-loop";
import { reactLevels } from "../react-levels";
import type { TrackLevels } from "@/lib/studio/behaviors";
import { failedExport, type BrowserExport } from "./export-result";
import { withRenderSession, type RenderSession } from "./render-session";

const WEBP_TYPE = "image/webp";

class ExportTooLarge extends Error {}
class EncoderMissing extends Error {}

interface FrameReader {
  canvas: HTMLCanvasElement;
  read: () => Uint8ClampedArray;
}

export type Progress = (phase: ExportPhase) => void;

export function frameReader(session: RenderSession): FrameReader | null {
  const canvas = window.document.createElement("canvas");
  canvas.width = session.size.width;
  canvas.height = session.size.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  return {
    canvas,
    read: () => {
      context.drawImage(session.canvas, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    },
  };
}

export function loopOf(doc: VideoDocument, session: RenderSession, originMs: number, levels: TrackLevels): Omit<FrameLoopDeps, "times" | "emit" | "onProgress"> {
  return { doc, levels, originMs, viewWidth: session.size.width, videos: session.videos, renderer: session.renderer, wake: session.wake };
}

export function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function webpEncodable(): Promise<boolean> {
  const probe = window.document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const blob = await canvasBlob(probe, WEBP_TYPE, 1);
  return blob?.type === WEBP_TYPE;
}

async function encodeGif(doc: VideoDocument, request: GifExportRequest, span: TimeSpan, session: RenderSession, reader: FrameReader, onPhase: Progress, levels: TrackLevels): Promise<BrowserExport> {
  const { GIFEncoder, quantize } = await import("gifenc");
  const { width, height } = session.size;
  const times = frameTimes(spanLength(span), request.fps);
  const samples = paletteSampleTimes(times);
  const total = samples.length + times.length;
  const sample = new PaletteSample(samples.length, width * height);
  const sampled = await renderFrames({
    ...loopOf(doc, session, span.startMs, levels),
    times: samples,
    emit: async () => sample.add(reader.read()),
    onProgress: (done) => onPhase({ phase: "encoding", done, total }),
  });
  if (sampled !== "complete") return failedExport(sampled);
  const palette = quantize(sample.pixels(), request.colors, { format: "rgb565" });
  const nearest = createNearestIndex(palette);
  const delays = gifDelaysCs(times, spanLength(span));
  const gif = GIFEncoder();
  let first = true;
  const hold = createFrameHold<Uint8Array>((indices, delayCs) => {
    gif.writeFrame(indices, width, height, { palette: first ? palette : undefined, delay: delayCs * 10, repeat: gifRepeat(request.loop) });
    first = false;
    if (gif.bytesView().byteLength > MAX_BROWSER_EXPORT_BYTES) throw new ExportTooLarge();
  }, MAX_GIF_DELAY_CS);
  let previous: Uint8ClampedArray | null = null;
  const outcome = await renderFrames({
    ...loopOf(doc, session, span.startMs, levels),
    times,
    emit: async (index) => {
      const pixels = reader.read();
      if (samePixels(pixels, previous)) hold.extend(delays[index]);
      else hold.add(indexPixels(pixels, width, height, palette, request.dither, nearest), delays[index]);
      previous = pixels;
    },
    onProgress: (done) => onPhase({ phase: "encoding", done: samples.length + done, total }),
  });
  if (outcome !== "complete") return failedExport(outcome);
  hold.flush();
  gif.finish();
  return { status: "done", file: new Blob([gif.bytesView().slice()], { type: "image/gif" }) };
}

async function stillFrame(reader: FrameReader, quality: number, width: number, height: number) {
  const blob = await canvasBlob(reader.canvas, WEBP_TYPE, quality);
  if (!blob || blob.type !== WEBP_TYPE) throw new EncoderMissing();
  const still = readStillWebp(new Uint8Array(await blob.arrayBuffer()));
  if (!still || still.width !== width || still.height !== height) throw new EncoderMissing();
  return still;
}

async function encodeWebp(doc: VideoDocument, request: WebpExportRequest, span: TimeSpan, session: RenderSession, reader: FrameReader, onPhase: Progress, levels: TrackLevels): Promise<BrowserExport> {
  const { width, height } = session.size;
  const times = frameTimes(spanLength(span), request.fps);
  const delays = webpDelaysMs(times, spanLength(span));
  const frames: WebpFrame[] = [];
  let bytes = 0;
  let alpha = false;
  const hold = createFrameHold<Uint8Array>((payload, durationMs) => {
    frames.push({ payload, durationMs });
    bytes += payload.length;
    if (bytes > MAX_BROWSER_EXPORT_BYTES) throw new ExportTooLarge();
  }, MAX_WEBP_DELAY_MS);
  let previous: Uint8ClampedArray | null = null;
  const outcome = await renderFrames({
    ...loopOf(doc, session, span.startMs, levels),
    times,
    emit: async (index) => {
      const pixels = reader.read();
      if (samePixels(pixels, previous)) hold.extend(delays[index]);
      else {
        const still = await stillFrame(reader, request.quality, width, height);
        alpha ||= still.alpha;
        hold.add(still.payload, delays[index]);
      }
      previous = pixels;
    },
    onProgress: (done, total) => onPhase({ phase: "encoding", done, total }),
  });
  if (outcome !== "complete") return failedExport(outcome);
  hold.flush();
  const file = muxAnimatedWebp(session.size, request.loop, alpha, frames);
  if (file.byteLength > MAX_BROWSER_EXPORT_BYTES) return failedExport("too_large");
  return { status: "done", file: new Blob([file], { type: WEBP_TYPE }) };
}

export async function exportAnimationInBrowser(edited: VideoDocument, request: AnimationExportRequest, onPhase: Progress): Promise<BrowserExport> {
  const doc = exportedDocument(edited);
  const span = requestSpan(request, doc.durationMs);
  if (!span) return failedExport("out_of_range");
  if (request.format === "webp" && !(await webpEncodable())) return failedExport("no_encoder");
  const levels = await reactLevels.ready(doc);
  if (!levels) return failedExport("undecodable");
  return withRenderSession(animationSize(videoCanvasSize(doc), request.width), async (session) => {
    const reader = frameReader(session);
    if (!reader) return failedExport("no_encoder");
    try {
      return request.format === "gif" ? await encodeGif(doc, request, span, session, reader, onPhase, levels) : await encodeWebp(doc, request, span, session, reader, onPhase, levels);
    } catch (error) {
      if (error instanceof ExportTooLarge) return failedExport("too_large");
      if (error instanceof EncoderMissing) return failedExport("no_encoder");
      throw error;
    }
  });
}
