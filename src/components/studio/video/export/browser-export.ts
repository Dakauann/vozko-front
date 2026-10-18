"use client";

import { isAnimation, isFrame, MP4_EXPORT, requestSpan, type Mp4ExportRequest, type VideoExportRequest } from "@/lib/studio/animated-export";
import { exportedDocument } from "@/lib/studio/organize";
import { videoCanvasSize, FRAMES_PER_SECOND, type VideoDocument } from "@/lib/studio/document";
import type { ExportPhase, LocalExport } from "@/lib/studio/export";
import { EXPORT_AUDIO_BITRATE, EXPORT_CHANNELS, EXPORT_SAMPLE_RATE, EXPORT_VIDEO_BITRATE, exportFrameUs, frameTimes, MAX_BROWSER_EXPORT_BYTES } from "@/lib/studio/export-encoding";
import { spanLength, type TimeSpan } from "@/lib/studio/work-area";

import { gpuRenderingWanted } from "../../render/gpu-preference";
import { decodeAudioFile } from "../audio-graph";
import { reactLevels } from "../react-levels";
import type { TrackLevels } from "@/lib/studio/behaviors";
import { exportAnimationInBrowser } from "./animated-encoders";
import { mixdown } from "./audio-mixdown";
import { exportFrameInBrowser } from "./frame-export";
import { renderFrames } from "./frame-loop";
import { failedExport, type BrowserExport } from "./export-result";
import { withRenderSession, type RenderSession } from "./render-session";
import { uploadExport } from "./upload-export";

type Mediabunny = typeof import("mediabunny");

interface BrowserEncoders {
  video: boolean;
  audio: boolean;
}

export async function browserEncoders(width: number, height: number): Promise<BrowserEncoders> {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") return { video: false, audio: false };
  const media = await import("mediabunny");
  const [video, audio] = await Promise.all([
    media.canEncodeVideo("avc", { width, height, bitrate: EXPORT_VIDEO_BITRATE, frameRate: FRAMES_PER_SECOND }),
    media.canEncodeAudio("aac", { numberOfChannels: EXPORT_CHANNELS, sampleRate: EXPORT_SAMPLE_RATE, bitrate: EXPORT_AUDIO_BITRATE }),
  ]);
  return { video, audio };
}

async function encodeMp4(media: Mediabunny, doc: VideoDocument, span: TimeSpan, session: RenderSession, onPhase: (phase: ExportPhase) => void, levels: TrackLevels): Promise<BrowserExport> {
  const target = new media.BufferTarget();
  const output = new media.Output({ format: new media.Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const video = new media.VideoSampleSource({ codec: "avc", bitrate: EXPORT_VIDEO_BITRATE });
  const audio = new media.AudioBufferSource({ codec: "aac", bitrate: EXPORT_AUDIO_BITRATE });
  output.addVideoTrack(video, { frameRate: FRAMES_PER_SECOND });
  output.addAudioTrack(audio);
  await output.start();
  await audio.add(await mixdown(doc, (assetId) => decodeAudioFile(assetId, EXPORT_SAMPLE_RATE), span));
  audio.close();
  const outcome = await renderFrames({
    doc,
    levels,
    times: frameTimes(spanLength(span)),
    originMs: span.startMs,
    videos: session.videos,
    renderer: session.renderer,
    wake: session.wake,
    emit: async (index) => {
      const frame = new VideoFrame(session.canvas, { timestamp: exportFrameUs(index), duration: exportFrameUs(index + 1) - exportFrameUs(index), alpha: "discard" });
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
    return failedExport(outcome);
  }
  video.close();
  await output.finalize();
  if (!target.buffer) return failedExport("failed");
  if (target.buffer.byteLength > MAX_BROWSER_EXPORT_BYTES) return failedExport("too_large");
  return { status: "done", file: new Blob([target.buffer], { type: "video/mp4" }) };
}

export async function exportInBrowser(edited: VideoDocument, onPhase: (phase: ExportPhase) => void, request: Mp4ExportRequest = MP4_EXPORT): Promise<BrowserExport> {
  const doc = exportedDocument(edited);
  const span = requestSpan(request, doc.durationMs);
  if (!span) return failedExport("out_of_range");
  if (!gpuRenderingWanted()) return failedExport("renderer_off");
  if (typeof VideoFrame === "undefined" || typeof OfflineAudioContext === "undefined") return failedExport("no_encoder");
  const size = videoCanvasSize(doc);
  const encoders = await browserEncoders(size.width, size.height);
  if (!encoders.video || !encoders.audio) return failedExport("no_encoder");
  const levels = await reactLevels.ready(doc);
  if (!levels) return failedExport("undecodable");
  return withRenderSession(size, async (session) => encodeMp4(await import("mediabunny"), doc, span, session, onPhase, levels));
}

function exportOf(doc: VideoDocument, request: VideoExportRequest, onPhase: (phase: ExportPhase) => void): Promise<BrowserExport> {
  if (isFrame(request)) return exportFrameInBrowser(doc, request, onPhase);
  if (isAnimation(request)) return exportAnimationInBrowser(doc, request, onPhase);
  return exportInBrowser(doc, onPhase, request);
}

export async function exportLocally(projectId: string, doc: VideoDocument, request: VideoExportRequest, onPhase: (phase: ExportPhase) => void): Promise<LocalExport> {
  const exported = await exportOf(doc, request, onPhase);
  if (exported.status === "failed") return exported;
  return uploadExport(projectId, exported.file, onPhase);
}
