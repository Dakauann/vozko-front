import type { MetaAdDraft } from "@/lib/advertising/draft-types";
import { jobOutcome } from "@/lib/advertising/publish";
import type { AdPublishJob } from "@/lib/advertising/types";

export type EditorStatus = "draft" | "publishing" | "failed";

export type SaveFailure = "changed" | "publishing" | "other";

type FollowedJob = Pick<AdPublishJob, "status"> | null | undefined;

export function draftStatus(state: string, job: FollowedJob): EditorStatus {
  if (job) {
    const outcome = jobOutcome(job.status);
    return outcome === "failed" || outcome === "needsReview" ? "failed" : "publishing";
  }
  if (state === "editing") return "draft";
  if (state === "failed") return "failed";
  return "publishing";
}

export function draftEditable(state: string, job: FollowedJob): boolean {
  return draftStatus(state, job) !== "publishing";
}

export function saveFailure(error: { code?: string; status?: number }): SaveFailure {
  if (error.code === "draft_changed") return "changed";
  if (error.code === "draft_publishing") return "publishing";
  return "other";
}

export function validationKey(draft: MetaAdDraft): string {
  return JSON.stringify({ ...draft, keepPaused: undefined });
}
