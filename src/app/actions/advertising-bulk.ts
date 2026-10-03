import { apiClient } from "@/lib/api/browser-client";
import { settleAds } from "@/app/actions/advertising-result";
import type { AdsResult } from "@/app/actions/advertising";
import type { AdBulkChange, AdBulkResult, AdObjectEdit } from "@/lib/advertising/types";

type BulkResponse = { results: AdBulkResult[] };

async function bulk(path: string, body: object): Promise<AdsResult<BulkResponse>> {
  return settleAds(await apiClient<BulkResponse>(`/ads/objects/bulk/${path}`, { method: "POST", body: JSON.stringify(body) }));
}

export async function bulkSetAdObjectsOnAction(metaIds: string[], on: boolean): Promise<AdsResult<BulkResponse>> {
  return bulk(on ? "activate" : "pause", { metaIds });
}

export async function bulkEditAdObjectsAction(metaIds: string[], change: AdBulkChange): Promise<AdsResult<BulkResponse>> {
  return bulk("edit", { metaIds, change });
}

export async function bulkApplyAdObjectsAction(metaIds: string[], edit: AdObjectEdit): Promise<AdsResult<BulkResponse>> {
  return bulk("apply", { metaIds, edit });
}
