import { accountPath } from "@/lib/advertising/report-query";
import { apiClient } from "@/lib/api/browser-client";
import type {
  Audience,
  AudienceList,
  CustomerListDraft,
  CustomerListResult,
  LookalikeDraft,
  SavedAudience,
  SavedAudienceInput,
} from "@/lib/advertising/audiences";

import type { AdsResult } from "./advertising";
import { settleAds, withAccount } from "./advertising-result";

const savedPath = (id: string) => `/ads/saved-audiences/${encodeURIComponent(id)}`;

export async function listAudiencesAction(accountId: string): Promise<AdsResult<AudienceList>> {
  return settleAds(await apiClient<AudienceList>(`${accountPath(accountId)}/audiences`, { method: "GET" }));
}

export async function createCustomerListAction(draft: CustomerListDraft): Promise<AdsResult<CustomerListResult>> {
  return settleAds(await apiClient<CustomerListResult>("/ads/audiences/customer-list", { method: "POST", body: JSON.stringify(draft) }));
}

export async function createLookalikeAction(draft: LookalikeDraft): Promise<AdsResult<Audience>> {
  return settleAds(await apiClient<Audience>("/ads/audiences/lookalike", { method: "POST", body: JSON.stringify(draft) }));
}

export async function deleteAudienceAction(metaId: string, accountId: string): Promise<AdsResult<null>> {
  return settleAds(
    await apiClient<null>(withAccount(`/ads/audiences/${encodeURIComponent(metaId)}`, accountId), { method: "DELETE" }),
    null,
  );
}

export async function listSavedAudiencesAction(): Promise<AdsResult<SavedAudience[]>> {
  return settleAds(await apiClient<SavedAudience[]>("/ads/saved-audiences", { method: "GET" }), []);
}

export async function createSavedAudienceAction(input: SavedAudienceInput): Promise<AdsResult<SavedAudience>> {
  return settleAds(await apiClient<SavedAudience>("/ads/saved-audiences", { method: "POST", body: JSON.stringify(input) }));
}

export async function updateSavedAudienceAction(id: string, input: SavedAudienceInput): Promise<AdsResult<SavedAudience>> {
  return settleAds(await apiClient<SavedAudience>(savedPath(id), { method: "PUT", body: JSON.stringify(input) }));
}

export async function deleteSavedAudienceAction(id: string): Promise<AdsResult<null>> {
  return settleAds(await apiClient<null>(savedPath(id), { method: "DELETE" }), null);
}
