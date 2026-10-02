import { jobStatusKey } from "@/lib/advertising/delivery";
import type { WizardForm } from "@/lib/advertising/draft";
import type { AdDraftFee } from "@/lib/advertising/draft-types";
import { accountIsReady, readinessKey } from "@/lib/advertising/readiness";
import type { AdJobProgress, AdPublishJob, AdReadiness, AdReadinessKey } from "@/lib/advertising/types";
import type { DraftIssue } from "@/lib/advertising/wizard-issues";

export type ValidationState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "failed"; message: string; code?: string }
  | { status: "done"; key: string; issues: DraftIssue[]; fee: AdDraftFee | null };

export type DraftBlocker = "notValidated" | "validating" | "validationFailed" | "stale" | "issues" | "noFee";

export type PublishBlocker = AdReadinessKey | "readinessUnchecked" | DraftBlocker;

function readinessBlockers(readiness: Pick<AdReadiness, "ready" | "blocking"> | null): PublishBlocker[] {
  if (accountIsReady(readiness)) return [];
  const known = (readiness?.blocking ?? []).map(readinessKey);
  const blockers: PublishBlocker[] = known.filter((key): key is AdReadinessKey => key !== null);
  return blockers.length === known.length && blockers.length > 0 ? blockers : [...blockers, "readinessUnchecked"];
}

export function publishBlockers(
  readiness: Pick<AdReadiness, "ready" | "blocking"> | null,
  validation: ValidationState,
  draftKey: string,
): PublishBlocker[] {
  const blockers = readinessBlockers(readiness);
  switch (validation.status) {
    case "idle":
      return [...blockers, "notValidated"];
    case "validating":
      return [...blockers, "validating"];
    case "failed":
      return [...blockers, "validationFailed"];
  }
  if (validation.key !== draftKey) return [...blockers, "stale"];
  if (validation.issues.length > 0) return [...blockers, "issues"];
  if (!validation.fee) return [...blockers, "noFee"];
  return blockers;
}

export type JobStepKey = "campaign" | "adSet" | "ads" | "activate";

export interface JobStep {
  key: JobStepKey;
  done: boolean;
  created?: number;
  total?: number;
}

export interface JobPlan {
  newCampaign: boolean;
  newAdSet: boolean;
  ads: number;
  activates: boolean;
}

export function jobPlan(form: WizardForm): JobPlan {
  return {
    newCampaign: form.mode === "new",
    newAdSet: form.mode === "new" || form.mode === "campaign",
    ads: form.ads.length,
    activates: !form.keepPaused,
  };
}

export function jobSteps(progress: AdJobProgress | null | undefined, plan: JobPlan): JobStep[] {
  const current = progress ?? {};
  const steps: JobStep[] = [];
  if (plan.newCampaign) steps.push({ key: "campaign", done: !!current.campaignId });
  if (plan.newAdSet) steps.push({ key: "adSet", done: !!current.adSetId });
  const created = Object.keys(current.ads ?? {}).length;
  steps.push({ key: "ads", done: plan.ads > 0 && created >= plan.ads, created, total: plan.ads });
  if (plan.activates) steps.push({ key: "activate", done: !!current.activated });
  return steps;
}

export type JobOutcome = "working" | "published" | "failed" | "needsReview";

export function jobOutcome(status: string): JobOutcome {
  switch (jobStatusKey(status)) {
    case "PUBLISHED":
      return "published";
    case "FAILED":
      return "failed";
    case "NEEDS_REVIEW":
      return "needsReview";
  }
  return "working";
}

export function publishedCampaignId(job: Pick<AdPublishJob, "progress">, existingCampaignId: string | undefined): string | null {
  return job.progress?.campaignId || existingCampaignId || null;
}

export function canSwitchOnLater(job: Pick<AdPublishJob, "status" | "progress">): boolean {
  return job.status === "PUBLISHED" && job.progress?.activated !== true;
}

export function needsStructureRefresh(campaignIds: string[], publishedId: string | null): boolean {
  return !!publishedId && !campaignIds.includes(publishedId);
}
