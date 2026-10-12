import { ADVERTISING_PATH, objectEditorHref } from "@/lib/advertising/connect";
import type { AdMediaKind, AdMediaRef } from "@/lib/advertising/draft-types";

const CREATE_PARAM = "create";
const MEDIA_PARAM = "media";
const MEDIA_KIND_PARAM = "mediaKind";
const MEDIA_KINDS: readonly AdMediaKind[] = ["image", "video"];
const SAFE_MEDIA_ID = /^[A-Za-z0-9_-]{1,100}$/;

export const CREATE_MEDIA_PARAMS = [MEDIA_PARAM, MEDIA_KIND_PARAM] as const;

export interface CreateRequest {
  accountId?: string | null;
  campaignId?: string | null;
  adSetId?: string | null;
  media?: AdMediaRef | null;
}

export function createDialogHref(request: CreateRequest): string {
  const params = new URLSearchParams({ [CREATE_PARAM]: "1" });
  if (request.accountId) params.set("account", request.accountId);
  if (request.campaignId) params.set("campaignId", request.campaignId);
  if (request.adSetId) params.set("adSetId", request.adSetId);
  if (request.media) {
    params.set(MEDIA_PARAM, request.media.mediaId);
    params.set(MEDIA_KIND_PARAM, request.media.kind);
  }
  return `${ADVERTISING_PATH}?${params.toString()}`;
}

export function requestedMedia(params: URLSearchParams): AdMediaRef | null {
  const mediaId = params.get(MEDIA_PARAM) ?? "";
  const kind = params.get(MEDIA_KIND_PARAM) as AdMediaKind | null;
  if (!SAFE_MEDIA_ID.test(mediaId) || !kind || !MEDIA_KINDS.includes(kind)) return null;
  return { kind, mediaId };
}

export function newRouteTarget(params: URLSearchParams): string {
  const accountId = params.get("accountId") || params.get("account");
  const adId = params.get("adId");
  if (adId && accountId) return objectEditorHref(accountId, adId);
  return createDialogHref({ accountId, campaignId: params.get("campaignId"), adSetId: params.get("adSetId"), media: requestedMedia(params) });
}
