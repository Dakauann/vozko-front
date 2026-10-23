"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { FileText, Image as ImageGlyph, Play } from "@/components/icons";
import { firstFrameSrc } from "@/lib/media/first-frame";
import { buttonActionOf } from "@/lib/rcs/buttons";
import type { RcsCard, RcsContent, RcsMedia, RcsSuggestion } from "@/lib/rcs/types";
import { cn } from "@/lib/utils";

import { ACCENT_FILL, PALETTE, type RcsPreviewPlatform } from "./palette";
import { SuggestionGlyph } from "./SuggestionGlyph";

const WAVE = [5, 9, 14, 8, 12, 18, 11, 7, 15, 10, 6, 13, 17, 9, 5, 11, 14, 8, 12, 6];

function useMediaLabel() {
  const t = useTranslations("rcs.preview");
  return (media: RcsMedia) => media.name?.trim() || t(`media.${media.kind}`);
}

function VisualMedia({ media, className }: { media: RcsMedia; className?: string }) {
  const label = useMediaLabel()(media);
  if (media.kind === "video") {
    return (
      <span className={cn("relative block overflow-hidden bg-black", className)}>
        <video src={firstFrameSrc(media.url)} muted playsInline preload="metadata" aria-label={label} className="h-full w-full object-cover" />
        <span aria-hidden className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <Play className="h-5 w-5 translate-x-px" weight="fill" />
        </span>
      </span>
    );
  }
  return (
    <span className={cn("relative block overflow-hidden bg-black/5 dark:bg-white/5", className)}>
      <Image src={media.url} alt={label} fill unoptimized sizes="320px" className="object-cover" />
    </span>
  );
}

function AudioTile({ media, platform }: { media: RcsMedia; platform: RcsPreviewPlatform }) {
  const t = useTranslations("rcs.preview");
  const palette = PALETTE[platform];
  const label = useMediaLabel()(media);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5" role="group" aria-label={t("media.audio")}>
      <span
        aria-hidden
        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white", platform === "ios" ? "bg-[#007AFF] dark:bg-[#0A84FF]" : ACCENT_FILL)}
      >
        <Play className="h-4 w-4 translate-x-px" weight="fill" />
      </span>
      <span className="min-w-0 flex-1">
        <span aria-hidden className="flex h-5 items-center gap-[2px]">
          {WAVE.map((height, index) => (
            <span key={index} className="w-[3px] rounded-full bg-current opacity-60" style={{ height }} />
          ))}
        </span>
        <span className={cn("mt-0.5 block truncate text-[11px]", palette.muted)}>{label}</span>
      </span>
    </div>
  );
}

function PdfTile({ media, platform }: { media: RcsMedia; platform: RcsPreviewPlatform }) {
  const t = useTranslations("rcs.preview");
  const palette = PALETTE[platform];
  const label = useMediaLabel()(media);
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span aria-hidden className="flex h-10 w-9 shrink-0 flex-col items-center justify-center rounded-md bg-[#D93025] text-[9px] font-bold text-white">
        <FileText className="h-4 w-4" />
        PDF
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{label}</span>
        <span className={cn("block text-[11px]", palette.muted)}>{t("media.pdf")}</span>
      </span>
    </div>
  );
}

function MediaBody({ media, platform, visualClassName }: { media: RcsMedia; platform: RcsPreviewPlatform; visualClassName: string }) {
  if (media.kind === "audio") return <AudioTile media={media} platform={platform} />;
  if (media.kind === "pdf") return <PdfTile media={media} platform={platform} />;
  return <VisualMedia media={media} className={visualClassName} />;
}

function MediaPlaceholder({ platform }: { platform: RcsPreviewPlatform }) {
  const t = useTranslations("rcs.preview");
  return (
    <div className={cn("flex h-40 w-[78%] flex-col items-center justify-center gap-1.5 border border-dashed border-black/20 text-xs dark:border-white/20", PALETTE[platform].bubbleShape, PALETTE[platform].muted)}>
      <ImageGlyph aria-hidden className="h-6 w-6" />
      {t("noMedia")}
    </div>
  );
}

function TextBubble({ text, platform }: { text: string; platform: RcsPreviewPlatform }) {
  const palette = PALETTE[platform];
  return <p className={cn("w-fit max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2", palette.bubble, palette.bubbleShape, palette.text)}>{text}</p>;
}

function CardButtons({ suggestions, platform }: { suggestions: RcsSuggestion[]; platform: RcsPreviewPlatform }) {
  const t = useTranslations("rcs.preview");
  const palette = PALETTE[platform];
  if (suggestions.length === 0) return null;
  return (
    <ul aria-label={t("cardButtons")} className="mt-auto">
      {suggestions.map((suggestion, index) => (
        <li
          key={index}
          className={cn(
            "flex items-center justify-center gap-1.5 border-t px-3 py-2.5 text-[13px] font-medium",
            palette.cardRule,
            palette.action,
          )}
        >
          <SuggestionGlyph suggestion={suggestion} className="h-3.5 w-3.5" />
          <span className="truncate">{suggestion.label}</span>
          <span className="sr-only">{t(`actions.${buttonActionOf(suggestion)}`)}</span>
        </li>
      ))}
    </ul>
  );
}

export function RichCardView({
  card,
  platform,
  label,
  inCarousel,
  fluid,
}: {
  card: RcsCard;
  platform: RcsPreviewPlatform;
  label: string;
  inCarousel?: boolean;
  fluid?: boolean;
}) {
  const palette = PALETTE[platform];
  const visualHeight = inCarousel ? "h-28" : platform === "ios" ? "h-44" : "h-40";
  const hasText = Boolean(card.title?.trim() || card.description?.trim());
  return (
    <article aria-label={label} className={cn("flex flex-col overflow-hidden", palette.card, palette.cardBody, inCarousel ? "h-full" : fluid ? "w-full" : "w-[86%]")}>
      {card.media ? <MediaBody media={card.media} platform={platform} visualClassName={cn("w-full", visualHeight)} /> : null}
      {hasText ? (
        <div className="space-y-1 px-3.5 py-3">
          {card.title?.trim() ? <h3 className={cn("break-words font-semibold", platform === "ios" ? "text-[15px]" : "text-[15px] leading-5")}>{card.title}</h3> : null}
          {card.description?.trim() ? (
            <p className={cn("whitespace-pre-wrap break-words text-[13px] leading-[1.15rem]", palette.muted, inCarousel && "line-clamp-4")}>{card.description}</p>
          ) : null}
        </div>
      ) : null}
      <CardButtons suggestions={card.suggestions ?? []} platform={platform} />
    </article>
  );
}

export function CarouselView({ cards, platform }: { cards: RcsCard[]; platform: RcsPreviewPlatform }) {
  const t = useTranslations("rcs.preview");
  return (
    <ul aria-label={t("carousel", { count: cards.length })} className="-mx-3 flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto scroll-px-3 px-3 pb-1 [scrollbar-width:none]">
      {cards.map((card, index) => (
        <li key={index} className="w-[70%] shrink-0 snap-start">
          <RichCardView card={card} platform={platform} inCarousel label={t("card", { index: index + 1, count: cards.length })} />
        </li>
      ))}
    </ul>
  );
}

export function SuggestionChips({ suggestions, platform }: { suggestions: RcsSuggestion[]; platform: RcsPreviewPlatform }) {
  const t = useTranslations("rcs.preview");
  const palette = PALETTE[platform];
  if (suggestions.length === 0) return null;
  const android = platform === "android";
  return (
    <ul
      aria-label={t("suggestions")}
      className={cn(
        "flex gap-2",
        android ? "-mx-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none]" : "flex-wrap",
      )}
    >
      {suggestions.map((suggestion, index) => (
        <li
          key={index}
          className={cn("inline-flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium", palette.chip, palette.action)}
        >
          <SuggestionGlyph suggestion={suggestion} className="h-3.5 w-3.5" />
          <span className="max-w-[11rem] truncate">{suggestion.label}</span>
          <span className="sr-only">{t(`actions.${buttonActionOf(suggestion)}`)}</span>
        </li>
      ))}
    </ul>
  );
}

function isBlank(content: RcsContent): boolean {
  return !content.text?.trim() && !content.media && !(content.cards?.length) && !(content.suggestions?.length);
}

export function RcsMessageView({ content, platform, expectsMedia }: { content: RcsContent; platform: RcsPreviewPlatform; expectsMedia?: boolean }) {
  const t = useTranslations("rcs.preview");
  const palette = PALETTE[platform];
  const cards = content.cards ?? [];

  if (isBlank(content) && !expectsMedia) {
    return <p className={cn("mx-auto max-w-[15rem] py-10 text-center text-xs leading-relaxed", palette.muted)}>{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {content.media ? (
        <div className={cn("w-[78%] overflow-hidden", palette.bubble, palette.bubbleShape)}>
          <MediaBody media={content.media} platform={platform} visualClassName="h-44 w-full" />
        </div>
      ) : expectsMedia && cards.length === 0 ? (
        <MediaPlaceholder platform={platform} />
      ) : null}
      {cards.length === 0 && content.text?.trim() ? <TextBubble text={content.text} platform={platform} /> : null}
      {cards.length === 1 ? <RichCardView card={cards[0]} platform={platform} label={t("richCard")} /> : null}
      {cards.length > 1 ? <CarouselView cards={cards} platform={platform} /> : null}
    </div>
  );
}
