"use client";

import { FrameStream } from "@/lib/studio/media/frame-stream";
import type { SceneVideo } from "@/lib/studio/scene/scene";

import type { LoadedMediaFile } from "../canvas/media-files";
import type { MediaEvent, MediaPort } from "./media-protocol";

export interface DecodeObserver {
  undecodable(): void;
  broken(): void;
}

const UNOBSERVED: DecodeObserver = { undecodable: () => undefined, broken: () => undefined };

interface Stream {
  id: string;
  clipId: string;
  file: string;
  frames: FrameStream<VideoFrame>;
  open: boolean;
  picture: VideoFrame | null;
}

export class DecodedVideos {
  private readonly byClip = new Map<string, Stream>();
  private readonly byId = new Map<string, Stream>();
  private readonly undecodable = new Set<string>();
  private broken = false;
  private opened = 0;

  constructor(
    private readonly port: MediaPort | null,
    private readonly files: (fileId: string) => Promise<LoadedMediaFile | null>,
    private readonly fileOf: (assetId: string) => string,
    private readonly onFrame: () => void,
    private readonly observer: DecodeObserver = UNOBSERVED,
  ) {
    port?.listen(
      (event) => this.receive(event),
      () => this.breakDown(),
    );
  }

  sync(clips: readonly SceneVideo[]): SceneVideo[] {
    const port = this.port;
    if (!port || this.broken) return [...clips];
    const fallback: SceneVideo[] = [];
    const present = new Set<string>();
    for (const clip of clips) {
      const file = this.fileOf(clip.source.assetId);
      if (this.undecodable.has(file)) {
        fallback.push(clip);
        continue;
      }
      present.add(clip.source.clipId);
      const stream = this.streamFor(clip.source.clipId, file);
      if (!stream.open) continue;
      const view = stream.frames.show(clip.source.sourceMs / 1000);
      stream.picture = view.picture;
      for (const request of view.requests) port.send({ stream: stream.id, ...request });
    }
    for (const clipId of [...this.byClip.keys()]) if (!present.has(clipId)) this.release(clipId);
    return fallback;
  }

  ready(clips: readonly SceneVideo[]): boolean {
    return clips.every((clip) => {
      const stream = this.byClip.get(clip.source.clipId);
      return stream !== undefined && stream.open && stream.frames.exact(clip.source.sourceMs / 1000);
    });
  }

  picture(clipId: string): VideoFrame | null {
    return this.byClip.get(clipId)?.picture ?? null;
  }

  dispose(): void {
    for (const clipId of [...this.byClip.keys()]) this.release(clipId);
    this.port?.close();
  }

  private streamFor(clipId: string, file: string): Stream {
    const existing = this.byClip.get(clipId);
    if (existing?.file === file) return existing;
    if (existing) this.release(clipId);
    this.opened += 1;
    const stream: Stream = { id: `${clipId}#${this.opened}`, clipId, file, frames: new FrameStream<VideoFrame>(), open: false, picture: null };
    this.byClip.set(clipId, stream);
    this.byId.set(stream.id, stream);
    void this.files(file).then((loaded) => this.open(stream, loaded));
    return stream;
  }

  private open(stream: Stream, loaded: LoadedMediaFile | null): void {
    if (this.byId.get(stream.id) !== stream || !this.port) return;
    if (!loaded || !loaded.contentType.startsWith("video/")) return this.giveUp(stream);
    this.port.send({ stream: stream.id, kind: "open", blob: loaded.blob });
    stream.open = true;
    this.onFrame();
  }

  private receive(event: MediaEvent): void {
    if (event.kind === "still") return;
    const stream = this.byId.get(event.stream);
    if (event.kind === "frame") {
      if (stream) stream.frames.receive(event);
      else event.picture.close();
      this.onFrame();
      return;
    }
    if (!stream) return;
    if (event.kind === "failed") return this.giveUp(stream);
    if (event.kind === "end") stream.frames.end(event.generation);
    else stream.frames.reset();
    this.onFrame();
  }

  private giveUp(stream: Stream): void {
    this.undecodable.add(stream.file);
    this.observer.undecodable();
    this.release(stream.clipId);
    this.onFrame();
  }

  private breakDown(): void {
    if (this.broken) return;
    this.broken = true;
    this.observer.broken();
    for (const clipId of [...this.byClip.keys()]) this.release(clipId);
    this.onFrame();
  }

  private release(clipId: string): void {
    const stream = this.byClip.get(clipId);
    if (!stream) return;
    this.byClip.delete(clipId);
    this.byId.delete(stream.id);
    stream.frames.dispose();
    stream.picture = null;
    if (stream.open && !this.broken) this.port?.send({ stream: stream.id, kind: "close" });
  }
}
