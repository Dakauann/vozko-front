import { ALL_FORMATS, BlobSource, CanvasSink, Input, VideoSampleSink, type InputVideoTrack, type VideoSample } from "mediabunny";

import { STILL_JPEG_QUALITY, stillSeconds } from "@/lib/studio/media/stills";
import type { Sample, SampleReader } from "@/lib/studio/media/stream-decoder";

export interface StillReader {
  grab(seconds: number, heightPx: number): Promise<Blob | null>;
  dispose(): void;
}

function sampleOf(sample: VideoSample, origin: number): Sample<VideoFrame> {
  return {
    timestamp: sample.timestamp - origin,
    duration: sample.duration,
    picture: () => sample.toVideoFrame(),
    close: () => sample.close(),
  };
}

async function readableTrack(input: Input, accept: (track: InputVideoTrack) => Promise<boolean>): Promise<InputVideoTrack | null> {
  const track = await input.getPrimaryVideoTrack();
  return track && (await accept(track)) && (await track.canDecode()) ? track : null;
}

async function openTrack<T>(blob: Blob, accept: (track: InputVideoTrack) => Promise<boolean>, use: (input: Input, track: InputVideoTrack) => Promise<T>): Promise<T | null> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const opened = await readableTrack(input, accept)
    .then((track) => (track ? use(input, track) : null))
    .catch(() => null);
  if (opened === null) input.dispose();
  return opened;
}

export function openVideoReader(blob: Blob): Promise<SampleReader<VideoFrame> | null> {
  return openTrack(
    blob,
    async (track) => (await track.getRotation()) === 0,
    async (input, track) => {
      const origin = await track.getFirstTimestamp();
      const sink = new VideoSampleSink(track);
      return {
        async *samples(fromSeconds: number) {
          for await (const sample of sink.samples(origin + fromSeconds)) yield sampleOf(sample, origin);
        },
        dispose: () => input.dispose(),
      };
    },
  );
}

export function openStillReader(blob: Blob): Promise<StillReader | null> {
  return openTrack(
    blob,
    async () => true,
    async (input, track) => {
      const origin = await track.getFirstTimestamp();
      const end = await input.computeDuration([track]);
      const sinks = new Map<number, CanvasSink>();
      const sinkFor = (heightPx: number) => {
        const known = sinks.get(heightPx);
        if (known) return known;
        const sink = new CanvasSink(track, { height: heightPx, poolSize: 1 });
        sinks.set(heightPx, sink);
        return sink;
      };
      return {
        async grab(seconds: number, heightPx: number) {
          const wrapped = await sinkFor(heightPx).getCanvas(origin + stillSeconds(seconds, end - origin));
          if (!(wrapped?.canvas instanceof OffscreenCanvas)) return null;
          return wrapped.canvas.convertToBlob({ type: "image/jpeg", quality: STILL_JPEG_QUALITY });
        },
        dispose: () => input.dispose(),
      };
    },
  );
}
