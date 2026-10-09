"use client";

import { ElementStills, type StillSource } from "@/components/studio/media/stills";
import { LruCache } from "@/lib/studio/filmstrip";

const CACHE_SIZE = 600;
const MIN_STILL_PX = 8;
const STILL_DENSITY = 2;

interface Job {
  assetId: string;
  sourceMs: number;
  heightPx: number;
  consumers: { signal: AbortSignal; resolve: (value: string | null) => void }[];
}

function dataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.onabort = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

export class FrameExtractor {
  private readonly frames = new LruCache<string, string>(CACHE_SIZE);
  private readonly queue: Job[] = [];
  private running = 0;
  private disposed = false;
  private readonly pending = new Map<string, Job>();

  constructor(
    private readonly concurrency: number = 1,
    private readonly fileOf: (assetId: string) => string = (assetId) => assetId,
    private readonly stills: StillSource = new ElementStills(),
  ) {}

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
    this.stills.dispose();
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

  private async extract(job: Job): Promise<string | null> {
    const key = this.key(job.assetId, job.sourceMs, job.heightPx);
    const hit = this.frames.get(key);
    if (hit) return hit;
    const heightPx = Math.max(MIN_STILL_PX, Math.round(job.heightPx * STILL_DENSITY));
    const blob = await this.stills.grab(this.fileOf(job.assetId), job.sourceMs / 1000, heightPx);
    if (!blob || !this.needed(job)) return null;
    const url = await dataUrl(blob);
    if (!url || !this.needed(job)) return null;
    this.frames.set(key, url);
    return url;
  }
}
