"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import {
  ArrowsClockwise,
  Bookmark,
  Camera,
  CaretRight,
  CaretUp,
  ChatCircle,
  DotsThree,
  Globe,
  Heart,
  Image as ImageGlyph,
  InstagramLogo,
  MessengerLogo,
  Package,
  PaperPlaneTilt,
  Play,
  ThumbsUp,
  WhatsappLogo,
  X,
} from "@/components/icons";
import { SoundVideo } from "@/components/media/sound-video";
import type { AdDraftDestination } from "@/lib/advertising/draft-types";
import { PREVIEW_PLACEMENTS, placementText, type PreviewPlacementId, type PreviewPlacementSpec } from "@/lib/advertising/preview-placements";
import { CAROUSEL_CARD_RATIO, FEED_MEDIA_RATIO, STORY_RATIO, STORY_SAFE_ZONE, TEXT_LIMITS, clipText, safeZoneInsets } from "@/lib/advertising/preview-spec";
import { resolvedCallToAction } from "@/lib/advertising/wizard-routes";
import { firstFrameSrc } from "@/lib/media/first-frame";
import { cn } from "@/lib/utils";

import { AdImage } from "./ad-image";

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
  link?: string;
  leadFormId?: string;
  greeting?: string;
  iceBreakers?: string[];
}

const CTA_ICON: Record<string, typeof WhatsappLogo> = {
  WHATSAPP_MESSAGE: WhatsappLogo,
  MESSAGE_PAGE: MessengerLogo,
  INSTAGRAM_MESSAGE: InstagramLogo,
};

const CTA_CHANNEL: Record<string, string> = {
  WHATSAPP_MESSAGE: "WhatsApp",
  MESSAGE_PAGE: "Messenger",
  INSTAGRAM_MESSAGE: "Instagram",
};

interface CardModel {
  content: AdPreviewContent;
  spec: PreviewPlacementSpec;
  media: AdPreviewMedia | undefined;
  text: string;
  ctaLabel: string;
  ctaChip: string;
  ctaIcon: typeof WhatsappLogo | undefined;
  fallback: string;
  pageName: string;
  playable: boolean;
}

function mainMedia(content: AdPreviewContent): AdPreviewMedia | undefined {
  if (content.format === "EXISTING_POST") return content.post?.pictureUrl ? { kind: "image", url: content.post.pictureUrl } : undefined;
  if (content.format === "FLEXIBLE") return content.medias?.[0];
  if (content.format === "CAROUSEL") return content.cards?.[0]?.media;
  if (content.media) return content.media;
  return content.imageUrl ? { kind: "image", url: content.imageUrl } : undefined;
}

function MediaView({ media, fallback, playable }: { media: AdPreviewMedia | undefined; fallback: string; playable: boolean }) {
  if (!media) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ImageGlyph className="h-6 w-6" aria-hidden />
        {fallback}
      </span>
    );
  }
  if (media.kind === "video" && playable) return <SoundVideo src={media.url} autoPlay className="h-full w-full" />;
  if (media.kind === "video") {
    return (
      <span className="relative block h-full w-full">
        <video src={firstFrameSrc(media.url)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
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

function PrimaryText({ text, limit, more, inverse }: { text: string; limit: number; more: string; inverse?: boolean }) {
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
        {more}
      </button>
    </>
  );
}

function PageAvatar({ content, name, size = "size-8" }: { content: AdPreviewContent; name: string; size?: string }) {
  return (
    <ChannelAvatarImage
      url={content.pagePictureUrl}
      name={name}
      seed={content.pageName || "page"}
      className={cn("shrink-0", size)}
      textClassName="text-2xs"
    />
  );
}

function Header({ model, inverse, closable }: { model: CardModel; inverse?: boolean; closable?: boolean }) {
  const t = useTranslations("adsWizard.preview");
  const tone = inverse ? "text-card" : "text-muted-foreground";
  return (
    <header className="flex items-center gap-2.5 px-3 py-2.5">
      <PageAvatar content={model.content} name={model.pageName} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", inverse ? "text-card" : "text-foreground")}>{model.pageName}</p>
        <p className={cn("flex items-center gap-1 text-2xs", tone)}>
          {t("sponsored")}
          {inverse ? null : <Globe className="h-3 w-3" aria-hidden />}
        </p>
      </div>
      <DotsThree className={cn("h-5 w-5 shrink-0", tone)} weight="bold" aria-hidden />
      {closable ? <X className={cn("h-4 w-4 shrink-0", tone)} aria-hidden /> : null}
    </header>
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

function Carousel({ cards, ctaLabel, fallback, playable }: { cards: AdPreviewCardItem[]; ctaLabel: string; fallback: string; playable: boolean }) {
  const limits = TEXT_LIMITS.carousel;
  return (
    <ul className="flex snap-x gap-2 overflow-x-auto px-3 pb-3">
      {cards.map((card, index) => (
        <li key={index} className="w-[78%] shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card">
          <div className="relative w-full bg-muted" style={{ aspectRatio: CAROUSEL_CARD_RATIO }}>
            <MediaView media={card.media} fallback={fallback} playable={playable} />
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

function FormatMedia({ model, fill }: { model: CardModel; fill?: boolean }) {
  if (model.content.format === "CATALOG") return <ProductTiles count={4} columns="grid-cols-2" />;
  if (fill) return <MediaView media={model.media} fallback={model.fallback} playable={model.playable} />;
  return (
    <div className="relative w-full bg-muted" style={{ aspectRatio: FEED_MEDIA_RATIO }}>
      <MediaView media={model.media} fallback={model.fallback} playable={model.playable} />
    </div>
  );
}

function Notes({ content }: { content: AdPreviewContent }) {
  const t = useTranslations("adsWizard.preview");
  const extras: ReactNode[] = [];
  if (content.format === "FLEXIBLE" && ((content.medias?.length ?? 0) > 1 || (content.textCount ?? 0) > 1)) {
    extras.push(t("flexibleNote", { medias: content.medias?.length ?? 0, texts: content.textCount ?? 0 }));
  }
  if (content.format === "CATALOG") extras.push(t("catalogNote"));
  if (extras.length === 0) return null;
  return (
    <div className="space-y-1 border-t border-border px-3 py-2">
      {extras.map((extra, index) => (
        <p key={index} className="text-2xs text-muted-foreground">
          {extra}
        </p>
      ))}
    </div>
  );
}

function FacebookFeed({ model }: { model: CardModel }) {
  const t = useTranslations("adsWizard.preview");
  const { content, spec } = model;
  const carousel = content.format === "CAROUSEL";
  const limits = TEXT_LIMITS[carousel ? "carousel" : "feed"];
  const primaryLimit = carousel ? TEXT_LIMITS.carousel.primaryText : spec.limits.primaryText;
  const headline = clipText(content.headline, limits.headline).text;
  const description = clipText(content.description, limits.description).text;
  return (
    <figure className="w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label={t("label")}>
      <Header model={model} closable />
      <p className="whitespace-pre-wrap break-words px-3 pb-2.5 text-sm text-foreground">
        <PrimaryText text={model.text} limit={primaryLimit} more={t("seeMore")} />
      </p>
      {content.format === "CAROUSEL" ? (
        <Carousel cards={content.cards ?? []} ctaLabel={model.ctaLabel} fallback={model.fallback} playable={model.playable} />
      ) : (
        <>
          <FormatMedia model={model} />
          {content.format === "COLLECTION" ? <ProductTiles count={3} columns="grid-cols-3 border-t border-border" /> : null}
          <div className="flex items-center gap-3 border-t border-border bg-muted px-3 py-2.5">
            <div className="min-w-0 flex-1">
              {content.displayLink?.trim() ? <p className="truncate text-2xs uppercase text-muted-foreground">{content.displayLink.trim()}</p> : null}
              {headline ? <p className="truncate text-sm font-semibold text-foreground">{headline}</p> : null}
              {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
            </div>
            <CtaButton label={model.ctaChip} icon={model.ctaIcon} />
          </div>
        </>
      )}
      <div className="flex items-center justify-around border-t border-border px-3 py-2 text-2xs font-semibold text-muted-foreground" aria-hidden>
        <span className="inline-flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5" />
          {t("like")}
        </span>
        <span className="inline-flex items-center gap-1">
          <ChatCircle className="h-3.5 w-3.5" />
          {t("comment")}
        </span>
        <span className="inline-flex items-center gap-1">
          <PaperPlaneTilt className="h-3.5 w-3.5" />
          {t("share")}
        </span>
      </div>
      <Notes content={content} />
    </figure>
  );
}

function InstagramFeed({ model }: { model: CardModel }) {
  const t = useTranslations("adsWizard.preview");
  const { content, spec } = model;
  const CtaIcon = model.ctaIcon;
  return (
    <figure className="w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label={t("label")}>
      <header className="flex items-center gap-2.5 px-3 py-2">
        <PageAvatar content={content} name={model.pageName} size="size-7" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{model.pageName}</p>
          <p className="text-2xs text-muted-foreground">{t("sponsored")}</p>
        </div>
        <DotsThree className="h-5 w-5 shrink-0 text-muted-foreground" weight="bold" aria-hidden />
      </header>
      {content.format === "CAROUSEL" ? (
        <div className="relative w-full bg-muted" style={{ aspectRatio: CAROUSEL_CARD_RATIO }}>
          <MediaView media={model.media} fallback={model.fallback} playable={model.playable} />
        </div>
      ) : (
        <FormatMedia model={model} />
      )}
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
        {CtaIcon ? <CtaIcon className="h-3.5 w-3.5" aria-hidden /> : null}
        <span className="min-w-0 flex-1 truncate">{model.ctaLabel}</span>
        <CaretRight className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="flex items-center gap-3 px-3 pt-2 text-foreground" aria-hidden>
        <Heart className="h-4 w-4" />
        <ChatCircle className="h-4 w-4" />
        <ArrowsClockwise className="h-4 w-4" />
        <PaperPlaneTilt className="h-4 w-4" />
        <Bookmark className="ml-auto h-4 w-4" />
      </div>
      <p className="whitespace-pre-wrap break-words px-3 pb-3 pt-1.5 text-xs text-foreground">
        <span className="mr-1 font-semibold">{model.pageName}</span>
        <PrimaryText text={model.text} limit={spec.limits.primaryText} more={t("more")} />
      </p>
      <Notes content={content} />
    </figure>
  );
}

function Marketplace({ model }: { model: CardModel }) {
  const t = useTranslations("adsWizard.preview");
  const headline = clipText(model.content.headline || model.text, model.spec.limits.headline).text;
  return (
    <figure className="mx-auto w-3/4 overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label={t("label")}>
      <header className="flex items-center gap-2 px-2.5 py-2">
        <PageAvatar content={model.content} name={model.pageName} size="size-7" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">{model.pageName}</p>
          <p className="text-2xs text-muted-foreground">{t("sponsored")}</p>
        </div>
        <DotsThree className="h-4 w-4 shrink-0 text-muted-foreground" weight="bold" aria-hidden />
      </header>
      <div className="relative w-full bg-muted" style={{ aspectRatio: "1 / 1" }}>
        <MediaView media={model.media} fallback={model.fallback} playable={model.playable} />
      </div>
      <p className="truncate px-2.5 py-2 text-xs text-foreground">{headline || " "}</p>
    </figure>
  );
}

function StoryFrame({ children, safeZone }: { children: ReactNode; safeZone: boolean }) {
  const t = useTranslations("adsWizard.preview");
  return (
    <figure
      className="relative w-full overflow-hidden rounded-lg border border-border bg-foreground shadow-sm"
      style={{ aspectRatio: STORY_RATIO }}
      aria-label={t("label")}
    >
      {children}
      {safeZone ? <SafeZoneOverlay /> : null}
    </figure>
  );
}

function Story({ model, safeZone }: { model: CardModel; safeZone: boolean }) {
  const t = useTranslations("adsWizard.preview");
  const { spec } = model;
  const caption = placementText(spec, model.text);
  const CtaIcon = model.ctaIcon;
  return (
    <StoryFrame safeZone={safeZone}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full">
          <FormatMedia model={model} />
        </div>
      </div>
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-foreground/70 to-transparent pt-1.5">
        <div className="mx-2 h-0.5 rounded-full bg-card/50">
          <div className="h-full w-1/3 rounded-full bg-card" />
        </div>
        <Header model={model} inverse closable />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-foreground/80 to-transparent px-3 pb-3 pt-8 text-center">
        {caption.text ? (
          <p className="text-xs text-card">
            {caption.text}
            {caption.clipped ? <span className="font-semibold">{`... ${t("more")}`}</span> : null}
          </p>
        ) : null}
        {spec.platform === "instagram" ? (
          <>
            <CaretUp className="h-4 w-4 text-card" weight="bold" aria-hidden />
            <span className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[--radius] bg-card px-3 text-xs font-semibold text-foreground">
              {CtaIcon ? <CtaIcon className="h-3.5 w-3.5" aria-hidden /> : null}
              {model.ctaLabel}
            </span>
          </>
        ) : (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-card/90 px-4 text-xs font-semibold text-foreground">
            {CtaIcon ? <CtaIcon className="h-3.5 w-3.5" aria-hidden /> : null}
            {model.ctaLabel}
          </span>
        )}
        <span className="self-start text-2xs font-semibold text-card">{t("sponsored")}</span>
      </div>
    </StoryFrame>
  );
}

function Reels({ model, safeZone }: { model: CardModel; safeZone: boolean }) {
  const t = useTranslations("adsWizard.preview");
  const { spec } = model;
  const caption = placementText(spec, model.text);
  const instagram = spec.platform === "instagram";
  const CtaIcon = model.ctaIcon;
  const actions = instagram ? [Heart, ChatCircle, PaperPlaneTilt, DotsThree] : [ThumbsUp, ChatCircle, PaperPlaneTilt];
  return (
    <StoryFrame safeZone={safeZone}>
      <div className="absolute inset-0 flex items-center">
        <div className="w-full">
          <FormatMedia model={model} />
        </div>
      </div>
      {instagram ? (
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-2.5 text-card">
          <span className="text-sm font-semibold">{t("reels")}</span>
          <Camera className="h-4 w-4" aria-hidden />
        </div>
      ) : null}
      <div className="absolute bottom-16 right-2 flex flex-col items-center gap-3 text-card" aria-hidden>
        {actions.map((Action, index) => (
          <Action key={index} className="h-4 w-4" />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-1.5 bg-gradient-to-t from-foreground/80 to-transparent px-3 pb-3 pt-10 pr-9 text-card">
        <div className="flex items-center gap-1.5">
          <PageAvatar content={model.content} name={model.pageName} size="size-6" />
          <span className="min-w-0 truncate text-xs font-semibold">{model.pageName}</span>
          {instagram ? <span className="rounded-sm border border-card/70 px-1 text-[0.625rem] font-semibold">{t("follow")}</span> : null}
        </div>
        {caption.text ? (
          <p className="truncate text-2xs">
            {caption.text}
            {caption.clipped ? "..." : null}
          </p>
        ) : null}
        <span
          className={cn(
            "flex h-7 w-full items-center justify-center gap-1.5 rounded-[--radius] text-2xs font-semibold",
            instagram ? "bg-card/20 text-card" : "bg-card text-foreground",
          )}
        >
          {CtaIcon ? <CtaIcon className="h-3.5 w-3.5" aria-hidden /> : null}
          {model.ctaLabel}
        </span>
        <span className="block text-[0.625rem] font-semibold">{t("sponsored")}</span>
      </div>
    </StoryFrame>
  );
}

const DEFAULT_PLACEMENT: PreviewPlacementId = "facebook_feed";

function specOf(id: PreviewPlacementId): PreviewPlacementSpec {
  return PREVIEW_PLACEMENTS.find((spec) => spec.id === id) ?? PREVIEW_PLACEMENTS[0];
}

export function AdPreviewCard({
  content,
  placement = DEFAULT_PLACEMENT,
  safeZone = false,
  playable = false,
}: {
  content: AdPreviewContent;
  placement?: PreviewPlacementId;
  safeZone?: boolean;
  playable?: boolean;
}) {
  const t = useTranslations("adsWizard.preview");
  const tCta = useTranslations("adsWizard.cta");
  const cta = resolvedCallToAction(content.destination as AdDraftDestination | "", content.callToAction ?? "");
  const ctaLabel = tCta.has(cta) ? tCta(cta) : cta;
  const model: CardModel = {
    content,
    spec: specOf(placement),
    media: mainMedia(content),
    text: content.format === "EXISTING_POST" ? (content.post?.message ?? "") : content.primaryText,
    ctaLabel,
    ctaChip: CTA_CHANNEL[cta] ?? ctaLabel,
    ctaIcon: CTA_ICON[cta],
    fallback: t("imageFallback"),
    pageName: content.pageName || t("pageFallback"),
    playable,
  };
  const shape = model.spec.shape;
  if (shape === "story") return <Story model={model} safeZone={safeZone} />;
  if (shape === "reels") return <Reels model={model} safeZone={safeZone} />;
  if (shape === "marketplace") return <Marketplace model={model} />;
  return model.spec.platform === "instagram" ? <InstagramFeed model={model} /> : <FacebookFeed model={model} />;
}
