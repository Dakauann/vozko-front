import { apiClient } from "@/lib/api/browser-client";
import type {
  AdApp,
  AdCatalog,
  AdDraftTargeting,
  AdDraftValidation,
  AdInstantExperience,
  AdOptimizationGoal,
  AdPagePost,
  AdPlacements,
  AdPostPlatform,
  AdReachEstimate,
  AdTargetingOption,
  AdTargetingSearchKind,
  AdsOptions,
  MetaAdDraft,
} from "@/lib/advertising/draft-types";
import { accountPath } from "@/lib/advertising/report-query";
import type { AdBudgetMinimum } from "@/lib/advertising/types";

import type { AdsResult } from "./advertising";
import { settleAds } from "./advertising-result";

const pagePath = (accountId: string, pageId: string) => `${accountPath(accountId)}/pages/${encodeURIComponent(pageId)}`;
const get = { method: "GET" } as const;

export async function getAdsOptionsAction(): Promise<AdsResult<AdsOptions>> {
  return settleAds(await apiClient<AdsOptions>("/ads/options", get));
}

export async function searchAdTargetingAction(
  accountId: string,
  kind: AdTargetingSearchKind,
  query: string,
): Promise<AdsResult<AdTargetingOption[]>> {
  const params = new URLSearchParams({ kind, q: query });
  return settleAds(await apiClient<AdTargetingOption[]>(`${accountPath(accountId)}/targeting?${params.toString()}`, get), []);
}

export interface ReachEstimateInput {
  targeting: AdDraftTargeting;
  placements: AdPlacements;
  goal?: AdOptimizationGoal;
}

export async function estimateAdReachAction(accountId: string, input: ReachEstimateInput): Promise<AdsResult<AdReachEstimate>> {
  return settleAds(
    await apiClient<AdReachEstimate>(`${accountPath(accountId)}/reach-estimate`, { method: "POST", body: JSON.stringify(input) }),
  );
}

export async function listAdAppsAction(accountId: string): Promise<AdsResult<AdApp[]>> {
  return settleAds(await apiClient<AdApp[]>(`${accountPath(accountId)}/apps`, get), []);
}

export async function listAdCatalogsAction(accountId: string): Promise<AdsResult<AdCatalog[]>> {
  return settleAds(await apiClient<AdCatalog[]>(`${accountPath(accountId)}/catalogs`, get), []);
}

export async function listAdPagePostsAction(accountId: string, pageId: string, platform: AdPostPlatform): Promise<AdsResult<AdPagePost[]>> {
  const params = new URLSearchParams({ platform });
  return settleAds(await apiClient<AdPagePost[]>(`${pagePath(accountId, pageId)}/posts?${params.toString()}`, get), []);
}

export async function listAdInstantExperiencesAction(accountId: string, pageId: string): Promise<AdsResult<AdInstantExperience[]>> {
  return settleAds(await apiClient<AdInstantExperience[]>(`${pagePath(accountId, pageId)}/instant-experiences`, get), []);
}

export async function validateMetaAdDraftAction(draft: MetaAdDraft): Promise<AdsResult<AdDraftValidation>> {
  return settleAds(await apiClient<AdDraftValidation>("/ads/drafts/validate", { method: "POST", body: JSON.stringify({ draft }) }));
}

export async function getAdPagePostAction(accountId: string, pageId: string, postId: string, platform: AdPostPlatform): Promise<AdsResult<AdPagePost>> {
  const path = `${accountPath(accountId)}/pages/${encodeURIComponent(pageId)}/posts/${encodeURIComponent(postId)}`;
  return settleAds(await apiClient<AdPagePost>(`${path}?${new URLSearchParams({ platform }).toString()}`, get));
}

export async function getAdBudgetMinimumAction(accountId: string, goal: AdOptimizationGoal, bidAmount: number): Promise<AdsResult<AdBudgetMinimum>> {
  const params = new URLSearchParams({ goal });
  if (bidAmount > 0) params.set("bidAmount", String(bidAmount));
  return settleAds(await apiClient<AdBudgetMinimum>(`${accountPath(accountId)}/budget-minimum?${params.toString()}`, get));
}
