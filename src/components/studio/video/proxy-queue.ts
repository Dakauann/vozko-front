import { isActionError, type ActionResult } from "@/app/actions/action-result";
import { MAX_CONSECUTIVE_POLL_ERRORS, mediaJobOutcome, nextPollDelay, TOO_MANY_JOBS } from "@/lib/media-generation/polling";
import type { MediaGenerationInput, MediaGenerationJob } from "@/lib/media-generation/types";

export const BUSY_RETRY_MS = 30_000;
export const MAX_BUSY_RETRIES = 6;

export interface ProxyDeps {
  request: (input: MediaGenerationInput) => Promise<ActionResult<MediaGenerationJob>>;
  get: (id: string) => Promise<ActionResult<MediaGenerationJob>>;
  wait: (ms: number) => Promise<void>;
  onReady: (assetId: string, proxyMediaId: string) => void;
}

export class ProxyQueue {
  private readonly pending: string[] = [];
  private readonly seen = new Set<string>();
  private running: Promise<void> | null = null;
  private disposed = false;

  constructor(private readonly deps: ProxyDeps) {}

  want(assetIds: readonly string[]): void {
    if (this.disposed) return;
    for (const id of assetIds) {
      if (this.seen.has(id)) continue;
      this.seen.add(id);
      this.pending.push(id);
    }
    this.running ??= this.drain().finally(() => {
      this.running = null;
    });
  }

  idle(): Promise<void> {
    return this.running ?? Promise.resolve();
  }

  dispose(): void {
    this.disposed = true;
    this.pending.length = 0;
  }

  private async drain(): Promise<void> {
    while (this.pending.length > 0 && !this.disposed) await this.prepare(this.pending.shift()!);
  }

  private async prepare(assetId: string): Promise<void> {
    for (let attempt = 0; attempt <= MAX_BUSY_RETRIES && !this.disposed; attempt++) {
      const requested = await this.deps.request({ kind: "proxy", sourceMediaId: assetId });
      if (!isActionError(requested)) return this.follow(assetId, requested.data);
      if (requested.code !== TOO_MANY_JOBS) return;
      await this.deps.wait(BUSY_RETRY_MS);
    }
  }

  private async follow(assetId: string, job: MediaGenerationJob): Promise<void> {
    let current = job;
    let delay: number | null = null;
    let errors = 0;
    while (!this.disposed) {
      const outcome = mediaJobOutcome(current);
      if (outcome.kind === "done") {
        this.deps.onReady(assetId, outcome.mediaId);
        return;
      }
      if (outcome.kind === "failed") return;
      delay = nextPollDelay(delay);
      await this.deps.wait(delay);
      const next = await this.deps.get(current.id);
      if (isActionError(next)) {
        errors += 1;
        if (errors >= MAX_CONSECUTIVE_POLL_ERRORS) return;
        continue;
      }
      errors = 0;
      current = next.data;
    }
  }
}
