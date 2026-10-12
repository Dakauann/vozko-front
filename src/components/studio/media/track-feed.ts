import { VideoSampleSink, type InputVideoTrack } from "mediabunny";

import { frameJobOf, type BoxTrackRequest, type FrameSize } from "@/lib/studio/point-track";
import { lumaOfRgba } from "@/lib/studio/tracking/luma";
import type { TrackOutcome } from "@/lib/studio/tracking/track-outcome";
import { runTrack, type FeedFrame, type FrameFeed } from "@/lib/studio/tracking/track-run";

import { openTrack } from "./video-reader";

export const PATTERN_PIXELS = 40;
const END_SLACK_SEC = 0.001;

export function analysisSize(frame: FrameSize, patternPx: number): FrameSize {
  const scale = Math.min(1, PATTERN_PIXELS / Math.max(1, patternPx));
  return { width: Math.max(1, Math.round(frame.width * scale)), height: Math.max(1, Math.round(frame.height * scale)) };
}

function feedOf(track: InputVideoTrack, origin: number, size: FrameSize): FrameFeed {
  const canvas = new OffscreenCanvas(size.width, size.height);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.imageSmoothingQuality = "medium";
  const sink = new VideoSampleSink(track);
  return {
    width: size.width,
    height: size.height,
    async *frames(fromSec: number, toSec: number): AsyncGenerator<FeedFrame> {
      for await (const sample of sink.samples(origin + fromSec, origin + toSec + END_SLACK_SEC)) {
        try {
          sample.draw(context, 0, 0, size.width, size.height);
          const luma = lumaOfRgba(context.getImageData(0, 0, size.width, size.height).data, size.width, size.height);
          yield { timestamp: sample.timestamp - origin, duration: sample.duration, luma };
        } finally {
          sample.close();
        }
      }
    },
  };
}

export async function trackInWorker(blob: Blob, request: BoxTrackRequest, onProgress: (done: number) => void, signal: AbortSignal): Promise<TrackOutcome> {
  const opened = await openTrack(
    blob,
    async () => true,
    async (input, track) => ({ input, track, origin: await track.getFirstTimestamp(), frame: { width: await track.getDisplayWidth(), height: await track.getDisplayHeight() } }),
  );
  if (!opened) return { kind: "undecodable" };
  try {
    const job = frameJobOf(request, opened.frame);
    if (!job) return { kind: "outside" };
    const run = await runTrack(feedOf(opened.track, opened.origin, analysisSize(opened.frame, job.size * opened.frame.height)), job, { onProgress, signal });
    if (run.kind !== "tracked") return run;
    return { ...run, frameWidth: opened.frame.width, frameHeight: opened.frame.height, size: job.size };
  } finally {
    opened.input.dispose();
  }
}
