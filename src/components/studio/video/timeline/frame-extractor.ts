"use client";

import { fetchMediaFileAction } from "@/app/actions/medias";
import { LruCache } from "@/lib/studio/filmstrip";

const SEEK_TIMEOUT_MS = 6000;
const CACHE_SIZE = 600;
const JPEG_QUALITY = 0.72;

interface Job {
  assetId: string;
  sourceMs: number;
  heightPx: number;
  consumers: { signal: AbortSignal; resolve: (value: string | null) => void }[];
}

function waitFor(element: HTMLVideoElement, event: "loadeddata" | "seeked"): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(false), SEEK_TIMEOUT_MS);
    function finish(ok: boolean) {
      clearTimeout(timer);
      element.removeEventListener(event, onEvent);
      element.removeEventListener("error", onError);
      resolve(ok);
    }
    const onEvent = () => finish(true);
    const onError = () => finish(false);
    element.addEventListener(event, onEvent);
    element.addEventListener("error", onError);
  });
}

export class FrameExtractor {
  private readonly frames = new LruCache<string, string>(CACHE_SIZE);
  private readonly videos = new Map<string, Promise<HTMLVideoElement | null>>();
  private readonly queue: Job[] = [];
  private running = 0;
  private disposed = false;
  private readonly pending = new Map<string, Job>();

  constructor(private readonly concurrency: number = 1) {}

  cached(assetId: string, sourceMs: number, heightPx: number): string | undefined {
    return this.frames.get(this.key(assetId, sourceMs, heightPx));
  }

  request(assetId: string, sourceMs: number, heightPx: number, signal: AbortSignal): Promise<string | null> {
    if (this.disposed || signal.aborted) return Promise.resolve(null);
    const hit = this.cached(assetId, sourceMs, heightPx);
    if (hit) return Promise.resolve(hit);
    return new Promise((resolve) => {
      const key = this.key(assetId, sourceMs, heightPx);
      const existing = this.pending.get(key);
      if (existing) {
        existing.consumers.push({ signal, resolve });
        return;
      }
      const job: Job = { assetId, sourceMs, heightPx, consumers: [{ signal, resolve }] };
      this.pending.set(key, job);
      this.queue.push(job);
      this.pump();
    });
  }

  dispose(): void {
    this.disposed = true;
    this.queue.length = 0;
    for (const job of this.pending.values()) this.finish(job, null);
    this.pending.clear();
    for (const pending of this.videos.values()) {
      void pending.then((video) => {
        if (!video) return;
        URL.revokeObjectURL(video.src);
        video.removeAttribute("src");
        video.load();
      });
    }
    this.videos.clear();
  }

  private key(assetId: string, sourceMs: number, heightPx: number): string {
    return `${assetId}:${sourceMs}:${heightPx}`;
  }

  private pump(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      if (!this.needed(job)) {
        this.finish(job, null);
        continue;
      }
      this.running += 1;
      void this.extract(job)
        .then((url) => this.finish(job, url), () => this.finish(job, null))
        .finally(() => {
          this.running -= 1;
          this.pump();
        });
    }
  }

  private needed(job: Job): boolean {
    return !this.disposed && job.consumers.some(({ signal }) => !signal.aborted);
  }

  private finish(job: Job, value: string | null): void {
    this.pending.delete(this.key(job.assetId, job.sourceMs, job.heightPx));
    for (const consumer of job.consumers.splice(0)) consumer.resolve(consumer.signal.aborted ? null : value);
  }

  private video(assetId: string): Promise<HTMLVideoElement | null> {
    const existing = this.videos.get(assetId);
    if (existing) return existing;
    const loading = fetchMediaFileAction(assetId).then(async ({ data }) => {
      if (this.disposed || !data || !data.contentType.startsWith("video/")) return null;
      const element = document.createElement("video");
      element.muted = true;
      element.playsInline = true;
      element.preload = "auto";
      element.src = URL.createObjectURL(data.blob);
      if (await waitFor(element, "loadeddata")) return element;
      URL.revokeObjectURL(element.src);
      element.removeAttribute("src");
      element.load();
      return null;
    }).catch(() => null);
    this.videos.set(assetId, loading);
    void loading.then((value) => {
      if (!value) this.videos.delete(assetId);
    });
    return loading;
  }

  private async extract(job: Job): Promise<string | null> {
    const key = this.key(job.assetId, job.sourceMs, job.heightPx);
    const hit = this.frames.get(key);
    if (hit) return hit;
    const video = await this.video(job.assetId);
    if (!video || !this.needed(job) || !video.videoWidth || !video.videoHeight) return null;
    const target = Math.min(job.sourceMs / 1000, Math.max(0, video.duration - 0.05));
    if (Math.abs(video.currentTime - target) > 0.001) {
      video.currentTime = target;
      if (!(await waitFor(video, "seeked"))) return null;
    }
    if (!this.needed(job)) return null;
    const height = Math.max(8, Math.round(job.heightPx * 2));
    const width = Math.max(8, Math.round((height * video.videoWidth) / video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    // Encode asynchronously so thumbnail JPEGs do not block timeline interaction.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || !this.needed(job)) return null;
    const url = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.onabort = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!url || !this.needed(job)) return null;
    this.frames.set(key, url);
    return url;
  }
}
