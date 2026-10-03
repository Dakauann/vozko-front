"use client";

import { getAdEditableObjectAction, isAdsError, type AdsResult } from "@/app/actions/advertising";
import { getAdPagePostAction } from "@/app/actions/advertising-create";
import { getMediaAction } from "@/app/actions/medias";
import { parentFromRow, type ParentSummary } from "@/lib/advertising/draft";
import type { AdPagePost } from "@/lib/advertising/draft-types";
import { draftMediaIds, draftPostRefs, type DraftPostRef, type FormContext } from "@/lib/advertising/editor-form";
import type { AdSavedDraft } from "@/lib/advertising/types";

import { useAdsResource } from "../wizard/use-ads-resource";

export type DraftExtras = Pick<FormContext, "campaignParent" | "adSetParent" | "mediaUrls" | "posts">;

async function loadParent(metaId: string | undefined): Promise<AdsResult<{ parent: ParentSummary | null; campaignId?: string }>> {
  if (!metaId) return { data: { parent: null } };
  const result = await getAdEditableObjectAction(metaId);
  if (isAdsError(result)) return result;
  return { data: { parent: parentFromRow(result.data.row), campaignId: result.data.row.campaignId } };
}

async function loadMediaUrls(ids: string[]): Promise<Record<string, string>> {
  const medias = await Promise.all(ids.map((id) => getMediaAction(id)));
  return Object.fromEntries(medias.flatMap((media, index) => (media?.url ? [[ids[index], media.url]] : [])));
}

async function loadPosts(accountId: string, pageId: string, refs: DraftPostRef[]): Promise<Record<string, AdPagePost>> {
  if (!pageId) return {};
  const posts = await Promise.all(refs.map((ref) => getAdPagePostAction(accountId, pageId, ref.id, ref.platform)));
  return Object.fromEntries(posts.flatMap((post, index) => (isAdsError(post) ? [] : [[refs[index].id, post.data]])));
}

async function loadExtras(saved: AdSavedDraft): Promise<AdsResult<DraftExtras>> {
  const { campaign, adSet, identity } = saved.draft;
  const [adSetParent, mediaUrls, posts] = await Promise.all([
    loadParent(adSet.existingId),
    loadMediaUrls(draftMediaIds(saved.draft)),
    loadPosts(saved.adAccountId, identity.pageId ?? "", draftPostRefs(saved.draft)),
  ]);
  if (isAdsError(adSetParent)) return adSetParent;
  const campaignParent = await loadParent(campaign.existingId ?? adSetParent.data.campaignId);
  if (isAdsError(campaignParent)) return campaignParent;
  return { data: { campaignParent: campaignParent.data.parent, adSetParent: adSetParent.data.parent, mediaUrls, posts } };
}

export function useDraftExtras(saved: AdSavedDraft | null) {
  const key = saved ? `draft-extras:${saved.id}:${saved.version}` : null;
  return useAdsResource<DraftExtras>(key, () => (saved ? loadExtras(saved) : Promise.resolve({ error: "missing_draft" })));
}
