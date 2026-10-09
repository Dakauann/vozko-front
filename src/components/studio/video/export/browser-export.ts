"use client";

import { videoCanvasSize, FRAMES_PER_SECOND, type VideoDocument } from "@/lib/studio/document";
import type { ExportFailure, ExportPhase, LocalExport } from "@/lib/studio/export";
import { EXPORT_AUDIO_BITRATE, EXPORT_CHANNELS, EXPORT_SAMPLE_RATE, exportFrameUs, MAX_BROWSER_EXPORT_BYTES } from "@/lib/studio/export-encoding";
import type { Renderer } from "@/lib/studio/render/renderer";

import { loadMediaFile } from "../../canvas/media-files";
import { DecodedVideos } from "../../media/decoded-videos";
import { openMediaWorker } from "../../media/media-worker";
import { gpuRenderingWanted } from "../../render/gpu-preference";
import { studioRenderSources } from "../../render/studio-sources";
import { decodeAudioFile } from "../audio-graph";
import { mixdown } from "./audio-mixdown";
import { renderFrames, Wake } from "./frame-loop";
import { uploadExport } from "./upload-export";

type Mediabunny = typeof import("mediabunny");

export type BrowserExport = { status: "done"; video: Blob } | { status: "failed"; reason: ExportFailure };

export interface BrowserEncoders {
  video: boolean;
  audio: boolean;
}

function failed(reason: ExportFailure): BrowserExport {
  return { status: "failed", reason };
}

export async function browserEncoders(width: number, height: number): Promise<BrowserEncoders> {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") return { video: false, audio: false };
  const media = await import("mediabunny");
  const [video, audio] = await Promise.all([
    media.canEncodeVideo("avc", { width, height, bitrate: media.QUALITY_HIGH, frameRate: FRAMES_PER_SECOND }),
    media.canEncodeAudio("aac", { numberOfChannels: EXPORT_CHANNELS, sampleRate: EXPORT_SAMPLE_RATE, bitrate: EXPORT_AUDIO_BITRATE }),
  ]);
  return { video, audio };
}

async function encode(media: Mediabunny, doc: VideoDocument, canvas: HTMLCanvasElement, videos: DecodedVideos, renderer: Renderer, wake: Wake, onPhase: (phase: ExportPhase) => void): Promise<BrowserExport> {
  const target = new media.BufferTarget();
  const output = new media.Output({ format: new media.Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const video = new media.VideoSampleSource({ codec: "avc", bitrate: media.QUALITY_HIGH });
  const audio = new media.AudioBufferSource({ codec: "aac", bitrate: EXPORT_AUDIO_BITRATE });
  output.addVideoTrack(video, { frameRate: FRAMES_PER_SECOND });
  output.addAudioTrack(audio);
  await output.start();
  await audio.add(await mixdown(doc, (assetId) => decodeAudioFile(assetId, EXPORT_SAMPLE_RATE)));
  audio.close();
  const outcome = await renderFrames({
    doc,
    videos,
    renderer,
    wake,
    emit: async (index) => {
      const frame = new VideoFrame(canvas, { timestamp: exportFrameUs(index), duration: exportFrameUs(index + 1) - exportFrameUs(index), alpha: "discard" });
      const sample = new media.VideoSample(frame);
      try {
        await video.add(sample);
      } finally {
        sample.close();
        frame.close();
      }
    },
    onProgress: (done, total) => onPhase({ phase: "encoding", done, total }),
  });
  if (outcome !== "complete") {
    await output.cancel();
    return failed(outcome);
  }
  video.close();
  await output.finalize();
  if (!target.buffer) return failed("failed");
  if (target.buffer.byteLength > MAX_BROWSER_EXPORT_BYTES) return failed("too_large");
  return { status: "done", video: new Blob([target.buffer], { type: "video/mp4" }) };
}

export async function exportInBrowser(doc: VideoDocument, onPhase: (phase: ExportPhase) => void): Promise<BrowserExport> {
  if (!gpuRenderingWanted()) return failed("renderer_off");
  if (typeof VideoFrame === "undefined" || typeof OfflineAudioContext === "undefined") return failed("no_encoder");
  const { width, height } = videoCanvasSize(doc);
  const encoders = await browserEncoders(width, height);
  if (!encoders.video || !encoders.audio) return failed("no_encoder");
  const port = openMediaWorker();
  if (!port) return failed("undecodable");
  const wake = new Wake();
  const videos = new DecodedVideos(port, loadMediaFile, (assetId) => assetId, () => wake.notify());
  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let renderer: Renderer | null = null;
  try {
    const media = await import("mediabunny");
    const { createPixiRenderer } = await import("../../render/pixi-renderer");
    renderer = await createPixiRenderer(canvas, { width, height, resolution: 1 }, studioRenderSources(videos), () => wake.notify());
    return await encode(media, doc, canvas, videos, renderer, wake, onPhase);
  } catch {
    return failed("failed");
  } finally {
    renderer?.destroy();
    videos.dispose();
  }
}

export async function exportLocally(projectId: string, doc: VideoDocument, onPhase: (phase: ExportPhase) => void): Promise<LocalExport> {
  const exported = await exportInBrowser(doc, onPhase);
  if (exported.status === "failed") return exported;
  return uploadExport(projectId, exported.video, onPhase);
}
