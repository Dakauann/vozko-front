"use client";

import { getAdEditableObjectAction } from "@/app/actions/advertising";
import { getAdsOptionsAction } from "@/app/actions/advertising-create";
import type { WizardForm } from "@/lib/advertising/draft";
import { videoOnlyPlacementsSkipped } from "@/lib/advertising/video-placements";

import { AdPreviewPanel } from "../ad-preview-panel";
import { VideoPlacementNotice } from "../video-placement-notice";
import { previewContent } from "../wizard/preview-content";
import { useAdsResource } from "../wizard/use-ads-resource";
import { useAdPages } from "../wizard/wizard-context";
import { AdDestinationPreview } from "./destination-preview";

export function PublishedAdPreview({ accountId, form, adSetId }: { accountId: string; form: WizardForm; adSetId: string | null }) {
  const pages = useAdPages(accountId);
  const options = useAdsResource("ads-options", getAdsOptionsAction);
  const adSet = useAdsResource(adSetId ? `object:${adSetId}` : null, () => getAdEditableObjectAction(adSetId ?? ""));
  const page = pages.status === "ready" ? pages.data.find((candidate) => candidate.pageId === form.pageId) : undefined;
  const content = previewContent(form.destination, form.ads[0], page);
  const placements = adSet.status === "ready" ? adSet.data.placements : null;
  const skipped = placements && options.status === "ready" ? videoOnlyPlacementsSkipped(placements, form.ads[0], options.data) : [];
  return (
    <AdPreviewPanel
      content={content}
      destination={<AdDestinationPreview content={content} accountId={accountId} page={page} />}
      notice={<VideoPlacementNotice skipped={skipped} />}
    />
  );
}
