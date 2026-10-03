import { apiClient } from "@/lib/api/browser-client";
import { settleAds } from "@/app/actions/advertising-result";
import type { AdsResult } from "@/app/actions/advertising";
import type { MetaAdDraft } from "@/lib/advertising/draft-types";
import { accountPath } from "@/lib/advertising/report-query";
import type { AdDraftList, AdPublishJob, AdSavedDraft } from "@/lib/advertising/types";

function draftPath(id: string): string {
  return `/ads/drafts/${encodeURIComponent(id)}`;
}

export async function listAdDraftsAction(accountId: string): Promise<AdsResult<AdDraftList>> {
  return settleAds(await apiClient<AdDraftList>(`${accountPath(accountId)}/drafts`, { method: "GET" }));
}

export async function getAdDraftAction(id: string): Promise<AdsResult<AdSavedDraft>> {
  return settleAds(await apiClient<AdSavedDraft>(draftPath(id), { method: "GET" }));
}

export async function createAdDraftAction(draft: MetaAdDraft): Promise<AdsResult<AdSavedDraft>> {
  return settleAds(await apiClient<AdSavedDraft>("/ads/drafts", { method: "POST", body: JSON.stringify({ draft }) }));
}

export async function updateAdDraftAction(id: string, draft: MetaAdDraft, version: number): Promise<AdsResult<AdSavedDraft>> {
  return settleAds(await apiClient<AdSavedDraft>(draftPath(id), { method: "PUT", body: JSON.stringify({ draft, version }) }));
}

export async function duplicateAdDraftAction(id: string, name: string): Promise<AdsResult<AdSavedDraft>> {
  return settleAds(await apiClient<AdSavedDraft>(`${draftPath(id)}/copies`, { method: "POST", body: JSON.stringify({ name }) }));
}

export async function deleteAdDraftAction(id: string): Promise<AdsResult<null>> {
  return settleAds(await apiClient<null>(draftPath(id), { method: "DELETE" }), null);
}

export async function discardAdDraftsAction(accountId: string): Promise<AdsResult<{ discarded: number }>> {
  return settleAds(await apiClient<{ discarded: number }>(`${accountPath(accountId)}/drafts/discard`, { method: "POST" }));
}

export async function publishAdDraftAction(id: string, version: number): Promise<AdsResult<AdPublishJob>> {
  return settleAds(await apiClient<AdPublishJob>(`${draftPath(id)}/publish`, { method: "POST", body: JSON.stringify({ version }) }));
}
