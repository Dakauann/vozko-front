import type { MediaGenerationJob } from "./types";

export { FIRST_POLL_MS, MAX_CONSECUTIVE_POLL_ERRORS, MAX_POLL_MS,  nextPollDelay } from "@/lib/polling";
export const CLIENT_TIMEOUT_MS = 11 * 60_000;

const MISSING_MEDIA = "missing_media";
export const TOO_MANY_JOBS = "too_many_jobs";
const UNKNOWN_FAILURE = "unknown";

type MediaJobOutcome =
  | { kind: "done"; mediaId: string; mediaUrl: string }
  | { kind: "failed"; code: string }
  | { kind: "pending"; settling: boolean };

export function isTerminalMediaJob(status: string): boolean {
  return status === "done" || status === "failed";
}

export function mediaJobOutcome(job: MediaGenerationJob): MediaJobOutcome {
  if (!isTerminalMediaJob(job.status)) return { kind: "pending", settling: job.status === "settling" };
  if (job.status === "failed") return { kind: "failed", code: job.failureCode || UNKNOWN_FAILURE };
  if (!job.mediaId || !job.mediaUrl) return { kind: "failed", code: MISSING_MEDIA };
  return { kind: "done", mediaId: job.mediaId, mediaUrl: job.mediaUrl };
}
