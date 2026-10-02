import type { AdForm, MediaChoice, WizardForm } from "@/lib/advertising/draft";
import type { AdPage } from "@/lib/advertising/types";

import type { AdPreviewContent, AdPreviewMedia } from "../ad-preview-card";

function previewMedia(media: MediaChoice | null): AdPreviewMedia | undefined {
  return media ? { kind: media.kind, url: media.url } : undefined;
}

export function previewContent(form: WizardForm, ad: AdForm | undefined, page: AdPage | undefined): AdPreviewContent {
  const flexible = ad?.format === "FLEXIBLE";
  const texts = (ad?.texts ?? []).map((text) => text.trim()).filter(Boolean);
  const headlines = (ad?.headlines ?? []).map((text) => text.trim()).filter(Boolean);
  const descriptions = (ad?.descriptions ?? []).map((text) => text.trim()).filter(Boolean);
  return {
    pageName: page?.name ?? "",
    pagePictureUrl: page?.pictureUrl,
    format: ad?.format,
    primaryText: flexible ? (texts[0] ?? "") : (ad?.primaryText ?? ""),
    headline: flexible ? headlines[0] : ad?.headline,
    description: flexible ? descriptions[0] : ad?.description,
    media: previewMedia(ad?.media ?? null),
    cards: ad?.cards.map((card) => ({ media: previewMedia(card.media), headline: card.headline, description: card.description })),
    medias: ad?.medias.map((media) => ({ kind: media.kind, url: media.url })),
    textCount: texts.length,
    post: ad?.post ? { message: ad.post.message, pictureUrl: ad.post.pictureUrl } : undefined,
    destination: form.destination,
    callToAction: ad?.callToAction,
    displayLink: ad?.displayLink,
    greeting: ad?.greeting,
    iceBreakers: ad?.iceBreakers,
  };
}
