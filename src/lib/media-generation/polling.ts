import type { ImageGenerationJob } from "./types";

export const FIRST_POLL_MS = 1_500;
export const MAX_POLL_MS = 5_000;
export const POLL_BACKOFF = 1.5;
export const MAX_CONSECUTIVE_POLL_ERRORS = 3;
export const CLIENT_TIMEOUT_MS = 11 * 60_000;

export const MISSING_MEDIA = "missing_media";
export const UNKNOWN_FAILURE = "unknown";

export type ImageJobOutcome =
  | { kind: "done"; mediaId: string; mediaUrl: string }
  | { kind: "failed"; code: string }
  | { kind: "pending" };

export function isTerminalImageJob(status: string): boolean {
  return status === "done" || status === "failed";
}

export function nextPollDelay(previousMs: number | null): number {
  if (previousMs === null) return FIRST_POLL_MS;
  return Math.min(Math.round(previousMs * POLL_BACKOFF), MAX_POLL_MS);
}

export function imageJobOutcome(job: ImageGenerationJob): ImageJobOutcome {
  if (!isTerminalImageJob(job.status)) return { kind: "pending" };
  if (job.status === "failed") return { kind: "failed", code: job.failureCode || UNKNOWN_FAILURE };
  if (!job.mediaId || !job.mediaUrl) return { kind: "failed", code: MISSING_MEDIA };
  return { kind: "done", mediaId: job.mediaId, mediaUrl: job.mediaUrl };
}
