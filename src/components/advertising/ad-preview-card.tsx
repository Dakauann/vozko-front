"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { CaretUp, DotsThree, Globe, Image as ImageGlyph, InstagramLogo, MessengerLogo, Package, Play, WhatsappLogo } from "@/components/icons";
import {
  CAROUSEL_CARD_RATIO,
  FEED_MEDIA_RATIO,
  STORY_RATIO,
  STORY_SAFE_ZONE,
  TEXT_LIMITS,
  clipText,
  safeZoneInsets,
  textLimitSet,
} from "@/lib/advertising/preview-spec";
import type { AdDraftDestination } from "@/lib/advertising/draft-types";
import { resolvedCallToAction } from "@/lib/advertising/wizard-routes";
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
  if (content.format === "CAROUSEL") return content.cards?.[0]?.media;
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

function ProductTiles({ count, columns }: { count: number; columns: string }) {
  return (
    <div className={cn("grid gap-0.5 bg-border", columns)}>
      {Array.from({ length: count }, (_, tile) => (
        <span key={tile} className="flex aspect-square items-center justify-center bg-muted text-muted-foreground">
          <Package className="h-5 w-5" aria-hidden />
        </span>
      ))}
    </div>
  );
}

function PrimaryText({ text, limit, inverse }: { text: string; limit: number; inverse?: boolean }) {
  const t = useTranslations("adsWizard.preview");
  const [expanded, setExpanded] = useState(false);
  const clipped = clipText(text, limit);
  if (!clipped.text) return <span className={inverse ? "text-card" : "text-muted-foreground"}>{t("primaryTextFallback")}</span>;
  if (!clipped.clipped || expanded) return <>{text.trim()}</>;
  return (
    <>
      {clipped.text}
      {"... "}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={cn("font-semibold hover:underline", inverse ? "text-card" : "text-muted-foreground")}
      >
        {t("seeMore")}
      </button>
    </>
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
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", inverse ? "text-card" : "text-foreground")}>
          {content.pageName || t("pageFallback")}
        </p>
        <p className={cn("flex items-center gap-1 text-2xs", inverse ? "text-card" : "text-muted-foreground")}>
          {t("sponsored")}
          {inverse ? null : <Globe className="h-3 w-3" aria-hidden />}
        </p>
      </div>
      <DotsThree className={cn("h-5 w-5 shrink-0", inverse ? "text-card" : "text-muted-foreground")} weight="bold" aria-hidden />
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
            <li key={`${index}-${breaker}`} className="rounded-full border border-control-edge px-2.5 py-1 text-2xs font-medium text-foreground">
              {breaker}
            </li>
          ))}
        </ul>
      ) : null}
    </figcaption>
  );
}

function CtaButton({ label, icon: Icon, compact }: { label: string; icon?: typeof WhatsappLogo; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card font-semibold text-foreground",
        compact ? "h-7 px-2.5 text-2xs" : "h-8 px-3 text-xs",
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {label}
    </span>
  );
}

function Carousel({ cards, ctaLabel, fallback }: { cards: AdPreviewCardItem[]; ctaLabel: string; fallback: string }) {
  const limits = TEXT_LIMITS.carousel;
  return (
    <ul className="flex snap-x gap-2 overflow-x-auto px-3 pb-3">
      {cards.map((card, index) => (
        <li key={index} className="w-[78%] shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card">
          <div className="relative w-full bg-muted" style={{ aspectRatio: CAROUSEL_CARD_RATIO }}>
            <MediaView media={card.media} fallback={fallback} />
          </div>
          <div className="flex items-center gap-2 border-t border-border bg-muted px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{clipText(card.headline, limits.headline).text || " "}</p>
              {card.description?.trim() ? (
                <p className="truncate text-2xs text-muted-foreground">{clipText(card.description, limits.description).text}</p>
              ) : null}
            </div>
            <CtaButton label={ctaLabel} compact />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SafeZoneOverlay() {
  const t = useTranslations("adsWizard.preview");
  const insets = safeZoneInsets(STORY_SAFE_ZONE);
  const shade = "absolute bg-destructive/25";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className={cn(shade, "inset-x-0 top-0")} style={{ height: insets.top }} />
      <div className={cn(shade, "inset-x-0 bottom-0")} style={{ height: insets.bottom }} />
      <div className={cn(shade, "left-0")} style={{ top: insets.top, bottom: insets.bottom, width: insets.left }} />
      <div className={cn(shade, "right-0")} style={{ top: insets.top, bottom: insets.bottom, width: insets.right }} />
      <div className="absolute border border-dashed border-card" style={insets}>
        <span className="absolute left-1 top-1 rounded-sm bg-foreground/70 px-1 text-[0.625rem] text-card">{t("safeZone")}</span>
      </div>
    </div>
  );
}

function StoryPreview({
  content,
  media,
  text,
  ctaLabel,
  fallback,
}: {
  content: AdPreviewContent;
  media: AdPreviewMedia | undefined;
  text: string;
  ctaLabel: string;
  fallback: string;
}) {
  const t = useTranslations("adsWizard.preview");
  const [safeZone, setSafeZone] = useState(false);
  const limits = TEXT_LIMITS.story;
  const insets = safeZoneInsets(STORY_SAFE_ZONE);
  return (
    <div className="mx-auto w-full max-w-[16rem] space-y-2">
      <figure
        className="relative w-full overflow-hidden rounded-lg border border-border bg-foreground shadow-sm"
        style={{ aspectRatio: STORY_RATIO }}
        aria-label={t("label")}
      >
        <div className="absolute inset-0">
          {content.format === "CATALOG" ? <ProductTiles count={4} columns="grid-cols-2" /> : <MediaView media={media} fallback={fallback} />}
        </div>
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-foreground/70 to-transparent pt-1.5">
          <div className="mx-2 h-0.5 rounded-full bg-card/50">
            <div className="h-full w-1/3 rounded-full bg-card" />
          </div>
          <Header content={content} inverse />
        </div>
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-2 bg-gradient-to-t from-foreground/80 to-transparent px-3 pb-4 text-center"
          style={{ height: insets.bottom }}
        >
          {text.trim() ? (
            <p className="line-clamp-3 text-xs text-card">
              <PrimaryText text={text} limit={limits.primaryText} inverse />
            </p>
          ) : null}
          <CaretUp className="h-4 w-4 text-card" weight="bold" aria-hidden />
          <span className="inline-flex h-8 items-center rounded-full bg-card px-4 text-xs font-semibold text-foreground">{ctaLabel}</span>
        </div>
        {safeZone ? <SafeZoneOverlay /> : null}
      </figure>
      <ElevatedSwitch checked={safeZone} onCheckedChange={setSafeZone} label={t("showSafeZone")} description={t("safeZoneHint")} />
    </div>
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
  const limits = TEXT_LIMITS[textLimitSet(placement, content.format)];
  const extras: ReactNode[] = [];
  if (content.format === "FLEXIBLE" && ((content.medias?.length ?? 0) > 1 || (content.textCount ?? 0) > 1)) {
    extras.push(t("flexibleNote", { medias: content.medias?.length ?? 0, texts: content.textCount ?? 0 }));
  }
  if (content.format === "CATALOG") extras.push(t("catalogNote"));

  if (placement === "story") {
    return <StoryPreview content={content} media={media} text={text} ctaLabel={ctaLabel} fallback={fallback} />;
  }

  const headline = clipText(content.headline, limits.headline).text;
  const description = clipText(content.description, limits.description).text;

  return (
    <figure className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label={t("label")}>
      <Header content={content} />
      <p className="whitespace-pre-wrap break-words px-3 pb-2.5 text-sm text-foreground">
        <PrimaryText text={text} limit={limits.primaryText} />
      </p>
      {content.format === "CAROUSEL" ? (
        <Carousel cards={content.cards ?? []} ctaLabel={ctaLabel} fallback={fallback} />
      ) : (
        <>
          {content.format === "CATALOG" ? (
            <ProductTiles count={4} columns="grid-cols-2" />
          ) : (
            <div className="relative w-full bg-muted" style={{ aspectRatio: FEED_MEDIA_RATIO }}>
              <MediaView media={media} fallback={fallback} />
            </div>
          )}
          {content.format === "COLLECTION" ? <ProductTiles count={3} columns="grid-cols-3 border-t border-border" /> : null}
          <div className="flex items-center gap-3 border-t border-border bg-muted px-3 py-2.5">
            <div className="min-w-0 flex-1">
              {content.displayLink?.trim() ? <p className="truncate text-2xs uppercase text-muted-foreground">{content.displayLink.trim()}</p> : null}
              {headline ? <p className="truncate text-sm font-semibold text-foreground">{headline}</p> : null}
              {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
            </div>
            <CtaButton label={ctaLabel} icon={CtaIcon} />
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
