import { ADVERTISING_PATH, objectEditorHref } from "@/lib/advertising/connect";

const CREATE_PARAM = "create";

export interface CreateRequest {
  accountId?: string | null;
  campaignId?: string | null;
  adSetId?: string | null;
}

export function createDialogHref(request: CreateRequest): string {
  const params = new URLSearchParams({ [CREATE_PARAM]: "1" });
  if (request.accountId) params.set("account", request.accountId);
  if (request.campaignId) params.set("campaignId", request.campaignId);
  if (request.adSetId) params.set("adSetId", request.adSetId);
  return `${ADVERTISING_PATH}?${params.toString()}`;
}

export function newRouteTarget(params: URLSearchParams): string {
  const accountId = params.get("accountId") || params.get("account");
  const adId = params.get("adId");
  if (adId && accountId) return objectEditorHref(accountId, adId);
  return createDialogHref({ accountId, campaignId: params.get("campaignId"), adSetId: params.get("adSetId") });
}
