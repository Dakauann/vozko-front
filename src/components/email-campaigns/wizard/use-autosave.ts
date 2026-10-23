"use client";

import { useMemo } from "react";

import { createEmailCampaignAction, isEmailActionError, updateEmailCampaignAction, type EmailActionError } from "@/app/actions/email-campaigns";
import { useDraftAutosave, type DraftSaveResult, type SaveState as DraftSaveState } from "@/components/campaign-wizard/use-draft-autosave";
import { campaignRequest, requestFingerprint, type CampaignDraft } from "@/lib/email-campaigns/draft";
import type { Campaign, CampaignRequest } from "@/lib/email-campaigns/types";

export const AUTOSAVE_DELAY_MS = 1000;

export type SaveState = DraftSaveState<EmailActionError>;

interface AutosaveOptions {
  campaignId: string | null;
  baseline: string;
  draft: CampaignDraft;
  editable: boolean;
  onSaved: (campaign: Campaign, created: boolean) => void;
}

async function storeCampaign(id: string | null, request: CampaignRequest): Promise<DraftSaveResult<Campaign, EmailActionError>> {
  const result = id ? await updateEmailCampaignAction(id, request) : await createEmailCampaignAction(request);
  return isEmailActionError(result) ? { error: result } : { data: result.data };
}

const campaignIdOf = (campaign: Campaign) => campaign.id;

export function useCampaignAutosave({ campaignId, baseline, draft, editable, onSaved }: AutosaveOptions) {
  const request = useMemo(() => campaignRequest(draft), [draft]);
  const fingerprint = useMemo(() => requestFingerprint(request), [request]);
  return useDraftAutosave({
    recordId: campaignId,
    baseline,
    request,
    fingerprint,
    named: request.name !== "",
    editable,
    delayMs: AUTOSAVE_DELAY_MS,
    save: storeCampaign,
    idOf: campaignIdOf,
    onSaved,
  });
}
