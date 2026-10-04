"use client";

import type { WizardForm } from "@/lib/advertising/draft";

import { AdPreviewPanel } from "../ad-preview-panel";
import { previewContent } from "../wizard/preview-content";
import { useAdPages } from "../wizard/wizard-context";
import { AdDestinationPreview } from "./destination-preview";

export function PublishedAdPreview({ accountId, form }: { accountId: string; form: WizardForm }) {
  const pages = useAdPages(accountId);
  const page = pages.status === "ready" ? pages.data.find((candidate) => candidate.pageId === form.pageId) : undefined;
  const content = previewContent(form.destination, form.ads[0], page);
  return <AdPreviewPanel content={content} destination={<AdDestinationPreview content={content} accountId={accountId} page={page} />} />;
}
