import type { RcsMediaKind } from "@/lib/rcs/types";

export const RCS_LIMITS = {
  maxTextRunes: 3072,
  basicTextRunes: 160,
  maxMessageSuggestions: 11,
  maxCardSuggestions: 4,
  maxSuggestionLabelRunes: 25,
  maxCardTitleRunes: 200,
  maxCardDescriptionRunes: 2000,
  minCarouselCards: 2,
  maxCarouselCards: 10,
  maxMediaBytes: 100 * 1024 * 1024,
  maxBrandNameRunes: 40,
  maxBrandDescriptionRunes: 100,
  cnpjDigits: 14,
} as const;

export const RCS_MEDIA_MIME_TYPES: Record<RcsMediaKind, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/gif"],
  video: ["video/mp4", "video/mpeg", "video/webm", "video/h263", "video/m4v"],
  audio: ["audio/aac", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/ogg", "audio/3gpp"],
  pdf: ["application/pdf"],
};

export const RCS_LOGO_SIZE = { width: 224, height: 224 } as const;

export const RCS_BANNER_SIZE = { width: 1440, height: 448 } as const;

export function runeCount(text: string | undefined): number {
  return text ? Array.from(text).length : 0;
}
