import { LruCache } from "@/lib/studio/filmstrip";
import { StreamDecoder } from "@/lib/studio/media/stream-decoder";

import type { MediaEvent, MediaRequest, StillRequest } from "./media-protocol";
import { openStillReader, openVideoReader, type StillReader } from "./video-reader";

const MAX_STILL_FILES = 3;

const streams = new Map<string, StreamDecoder<VideoFrame>>();
let stills: Promise<void> = Promise.resolve();
const stillReaders = new LruCache<string, Promise<StillReader | null>>(MAX_STILL_FILES, (reader) => void reader.then((opened) => opened?.dispose()));

function post(event: MediaEvent): void {
  if (event.kind === "frame") self.postMessage(event, { transfer: [event.picture] });
  else self.postMessage(event);
}

function stillReader(request: StillRequest): Promise<StillReader | null> {
  const known = stillReaders.get(request.file);
  if (known) return known;
  const opening = openStillReader(request.blob);
  stillReaders.set(request.file, opening);
  return opening;
}

async function still(request: StillRequest): Promise<void> {
  const reader = await stillReader(request);
  const image = reader ? await reader.grab(request.seconds, request.heightPx).catch(() => null) : null;
  post({ kind: "still", id: request.id, image, decodable: reader !== null });
}

function handle(request: MediaRequest): void {
  if (request.kind === "still") {
    stills = stills.then(() => still(request));
    return;
  }
  const decoder = streams.get(request.stream);
  switch (request.kind) {
    case "open":
      decoder?.close();
      streams.set(request.stream, new StreamDecoder(openVideoReader(request.blob), (event) => post({ stream: request.stream, ...event })));
      return;
    case "close":
      decoder?.close();
      streams.delete(request.stream);
      return;
    case "seek":
      decoder?.seek(request.generation, request.seconds);
      return;
    case "want":
      decoder?.want(request.seconds);
      return;
    case "release":
      decoder?.release(request.generation, request.count);
  }
}

self.addEventListener("message", (event: MessageEvent<MediaRequest>) => handle(event.data));
