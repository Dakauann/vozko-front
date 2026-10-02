"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import { Globe, Image as ImageGlyph, InstagramLogo, MessengerLogo, Package, Play, WhatsappLogo } from "@/components/icons";
import { resolvedCallToAction } from "@/lib/advertising/wizard-routes";
import type { AdDraftDestination } from "@/lib/advertising/draft-types";
import { cn } from "@/lib/utils";

import { AdImage } from "./ad-image";

export type AdPreviewPlacement = "feed" | "story";

export interface AdPreviewMedia {
  kind: "image" | "video";
  url: string;
}

export interface AdPreviewCardItem {
  media?: AdPreviewMedia;
  headline?: string;
  description?: string;
}

export interface AdPreviewPost {
  message?: string;
  pictureUrl?: string;
}

export interface AdPreviewContent {
  pageName: string;
  pagePictureUrl?: string;
  format?: string;
  primaryText: string;
  headline?: string;
  description?: string;
  imageUrl?: string;
  media?: AdPreviewMedia;
  cards?: AdPreviewCardItem[];
  medias?: AdPreviewMedia[];
  textCount?: number;
  post?: AdPreviewPost;
  destination: string;
  callToAction?: string;
  displayLink?: string;
  greeting?: string;
  iceBreakers?: string[];
}

const CTA_ICON: Record<string, typeof WhatsappLogo> = {
  WHATSAPP_MESSAGE: WhatsappLogo,
  MESSAGE_PAGE: MessengerLogo,
  INSTAGRAM_MESSAGE: InstagramLogo,
};

function mainMedia(content: AdPreviewContent): AdPreviewMedia | undefined {
  if (content.format === "EXISTING_POST") return content.post?.pictureUrl ? { kind: "image", url: content.post.pictureUrl } : undefined;
  if (content.format === "FLEXIBLE") return content.medias?.[0];
  if (content.media) return content.media;
  return content.imageUrl ? { kind: "image", url: content.imageUrl } : undefined;
}

function MediaView({ media, fallback }: { media: AdPreviewMedia | undefined; fallback: string }) {
  if (!media) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ImageGlyph className="h-6 w-6" aria-hidden />
        {fallback}
      </span>
    );
  }
  if (media.kind === "video") {
    return (
      <span className="relative block h-full w-full">
        <video src={media.url} muted playsInline loop preload="metadata" className="h-full w-full object-cover" />
        <Play className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-card" weight="fill" aria-hidden />
      </span>
    );
  }
  return <AdImage src={media.url} />;
}

function Carousel({ cards, ctaLabel, fallback }: { cards: AdPreviewCardItem[]; ctaLabel: string; fallback: string }) {
  return (
    <ul className="flex snap-x gap-2 overflow-x-auto px-3 pb-3">
      {cards.map((card, index) => (
        <li key={index} className="w-[70%] shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card">
          <div className="relative aspect-square bg-muted">
            <MediaView media={card.media} fallback={fallback} />
          </div>
          <div className="space-y-1 border-t border-border bg-muted px-2.5 py-2">
            <p className="truncate text-xs font-semibold text-foreground">{card.headline?.trim() || " "}</p>
            <span className="inline-flex h-7 items-center rounded-[--radius] border border-control-edge bg-card px-2.5 text-2xs font-semibold text-foreground">
              {ctaLabel}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CatalogGrid() {
  return (
    <div className="grid grid-cols-2 gap-0.5 bg-border">
      {[0, 1, 2, 3].map((tile) => (
        <span key={tile} className="flex aspect-square items-center justify-center bg-muted text-muted-foreground">
          <Package className="h-6 w-6" aria-hidden />
        </span>
      ))}
    </div>
  );
}

function Header({ content, inverse }: { content: AdPreviewContent; inverse?: boolean }) {
  const t = useTranslations("adsWizard.preview");
  return (
    <header className="flex items-center gap-2.5 px-3 py-2.5">
      <ChannelAvatarImage
        url={content.pagePictureUrl}
        name={content.pageName || t("pageFallback")}
        seed={content.pageName || "page"}
        className="size-8"
        textClassName="text-2xs"
      />
      <div className="min-w-0">
        <p className={cn("truncate text-sm font-semibold", inverse ? "text-card" : "text-foreground")}>
          {content.pageName || t("pageFallback")}
        </p>
        <p className={cn("flex items-center gap-1 text-2xs", inverse ? "text-card" : "text-muted-foreground")}>
          {t("sponsored")}
          <Globe className="h-3 w-3" aria-hidden />
        </p>
      </div>
    </header>
  );
}

function Conversation({ greeting, breakers }: { greeting?: string; breakers: string[] }) {
  const t = useTranslations("adsWizard.preview");
  if (!greeting && breakers.length === 0) return null;
  return (
    <figcaption className="space-y-2 border-t border-border px-3 py-2.5">
      <p className="legend">{t("conversationStart")}</p>
      {greeting ? (
        <p className="w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-bl-sm border border-border bg-muted px-3 py-2 text-xs text-foreground">
          {greeting}
        </p>
      ) : null}
      {breakers.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {breakers.map((breaker, index) => (
            <li
              key={`${index}-${breaker}`}
              className="rounded-full border border-control-edge px-2.5 py-1 text-2xs font-medium text-foreground"
            >
              {breaker}
            </li>
          ))}
        </ul>
      ) : null}
    </figcaption>
  );
}

export function AdPreviewCard({ content, placement = "feed" }: { content: AdPreviewContent; placement?: AdPreviewPlacement }) {
  const t = useTranslations("adsWizard.preview");
  const tCta = useTranslations("adsWizard.cta");
  const cta = resolvedCallToAction(content.destination as AdDraftDestination | "", content.callToAction ?? "");
  const ctaLabel = tCta.has(cta) ? tCta(cta) : cta;
  const CtaIcon = CTA_ICON[cta];
  const breakers = (content.iceBreakers ?? []).map((b) => b.trim()).filter(Boolean);
  const greeting = content.greeting?.trim();
  const media = mainMedia(content);
  const text = content.format === "EXISTING_POST" ? (content.post?.message ?? "") : content.primaryText;
  const fallback = t("imageFallback");
  const extras: ReactNode[] = [];
  if (content.format === "FLEXIBLE" && ((content.medias?.length ?? 0) > 1 || (content.textCount ?? 0) > 1)) {
    extras.push(t("flexibleNote", { medias: content.medias?.length ?? 0, texts: content.textCount ?? 0 }));
  }
  if (content.format === "CATALOG") extras.push(t("catalogNote"));

  const ctaButton = (
    <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-3 text-xs font-semibold text-foreground">
      {CtaIcon ? <CtaIcon className="h-3.5 w-3.5" aria-hidden /> : null}
      {ctaLabel}
    </span>
  );

  if (placement === "story") {
    return (
      <figure
        className="relative mx-auto aspect-[9/16] w-full max-w-[16rem] overflow-hidden rounded-lg border border-border bg-foreground shadow-sm"
        aria-label={t("label")}
      >
        <div className="absolute inset-0">
          {content.format === "CATALOG" ? (
            <CatalogGrid />
          ) : (
            <MediaView media={content.format === "CAROUSEL" ? content.cards?.[0]?.media : media} fallback={fallback} />
          )}
        </div>
        <div className="absolute inset-x-0 top-0 bg-foreground/70">
          <Header content={content} inverse />
        </div>
        <div className="absolute inset-x-0 bottom-0 space-y-2 bg-foreground/70 px-3 pb-4 pt-3 text-center">
          {text.trim() ? <p className="line-clamp-3 text-xs text-card">{text.trim()}</p> : null}
          {ctaButton}
        </div>
      </figure>
    );
  }

  return (
    <figure className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label={t("label")}>
      <Header content={content} />
      <p className="whitespace-pre-wrap break-words px-3 pb-2.5 text-sm text-foreground">
        {text.trim() || <span className="text-muted-foreground">{t("primaryTextFallback")}</span>}
      </p>
      {content.format === "CAROUSEL" ? (
        <Carousel cards={content.cards ?? []} ctaLabel={ctaLabel} fallback={fallback} />
      ) : (
        <>
          {content.format === "CATALOG" ? (
            <CatalogGrid />
          ) : (
            <div className="relative aspect-square w-full bg-muted">
              <MediaView media={media} fallback={fallback} />
            </div>
          )}
          {content.format === "COLLECTION" ? (
            <div className="grid grid-cols-3 gap-0.5 border-t border-border bg-border">
              {[0, 1, 2].map((tile) => (
                <span key={tile} className="flex aspect-square items-center justify-center bg-muted text-muted-foreground">
                  <Package className="h-5 w-5" aria-hidden />
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-3 border-t border-border bg-muted px-3 py-2.5">
            <div className="min-w-0 flex-1">
              {content.displayLink?.trim() ? (
                <p className="truncate text-2xs uppercase text-muted-foreground">{content.displayLink.trim()}</p>
              ) : null}
              {content.headline?.trim() ? (
                <p className="truncate text-sm font-semibold text-foreground">{content.headline.trim()}</p>
              ) : null}
              {content.description?.trim() ? <p className="truncate text-xs text-muted-foreground">{content.description.trim()}</p> : null}
            </div>
            {ctaButton}
          </div>
        </>
      )}
      {extras.length > 0 ? (
        <div className="space-y-1 border-t border-border px-3 py-2">
          {extras.map((extra, index) => (
            <p key={index} className="text-2xs text-muted-foreground">
              {extra}
            </p>
          ))}
        </div>
      ) : null}
      <Conversation greeting={greeting} breakers={breakers} />
    </figure>
  );
}
