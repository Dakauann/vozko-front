import type { AdDraftValidation } from "./draft-types";
import { withBudgetMinimum } from "./issues";
import { draftRowState, isEditableDraft } from "./manager-drafts";
import { publishBlockers, type PublishBlocker, type ValidationState } from "./publish";
import { readinessKey } from "./readiness";
import type { AdReadiness, AdSavedDraft } from "./types";

export type ReviewBlocker = PublishBlocker | "publishing";

export interface DraftSummary {
  name: string | null;
  existingCampaignId: string | null;
  adSets: number;
  ads: number;
}

export function draftValidationKey(draft: Pick<AdSavedDraft, "id" | "version">): string {
  return `${draft.id}:${draft.version}`;
}

export function reviewBlockers(
  draft: AdSavedDraft,
  readiness: Pick<AdReadiness, "ready" | "blocking"> | null,
  validation: ValidationState,
): ReviewBlocker[] {
  if (!isEditableDraft(draftRowState(draft.state))) return ["publishing"];
  return publishBlockers(readiness, validation, draftValidationKey(draft));
}

export function publishableDrafts(drafts: AdSavedDraft[], blockers: ReadonlyMap<string, ReviewBlocker[]>, chosen: ReadonlySet<string>): string[] {
  return drafts.filter((draft) => chosen.has(draft.id) && blockers.get(draft.id)?.length === 0).map((draft) => draft.id);
}

export function draftSummary(draft: AdSavedDraft, campaignNames: ReadonlyMap<string, string>): DraftSummary {
  const existingCampaignId = draft.draft.campaign.existingId || null;
  const campaignRow = draft.rows.find((row) => row.level === "campaign");
  const ownName = campaignRow?.name.trim() || draft.draft.campaign.name?.trim() || null;
  return {
    name: existingCampaignId ? (campaignNames.get(existingCampaignId) ?? null) : ownName,
    existingCampaignId,
    adSets: draft.rows.filter((row) => row.level === "adset").length,
    ads: draft.rows.filter((row) => row.level === "ad").length,
  };
}

export function validationDone(key: string, validation: AdDraftValidation): ValidationState {
  return {
    status: "done",
    key,
    issues: withBudgetMinimum(validation.issues ?? [], validation.budgetMinimum),
    fee: validation.fee ?? null,
  };
}

export function draftOnlyBlockers(blockers: ReviewBlocker[]): ReviewBlocker[] {
  return blockers.filter((blocker) => blocker !== "readinessUnchecked" && readinessKey(blocker) === null);
}
