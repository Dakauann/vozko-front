import { describe, expect, it } from "vitest";

import { RCS_LIMITS, RCS_MEDIA_MIME_TYPES } from "@/lib/rcs/limits";

describe("RCS limits", () => {
  it("mirrors the content limits of vozko-back domain/rcs/content.go", () => {
    expect(RCS_LIMITS).toEqual({
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
    });
  });

  it("mirrors the accepted media types per kind", () => {
    expect(RCS_MEDIA_MIME_TYPES).toEqual({
      image: ["image/jpeg", "image/png", "image/gif"],
      video: ["video/mp4", "video/mpeg", "video/webm", "video/h263", "video/m4v"],
      audio: ["audio/aac", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/ogg", "audio/3gpp"],
      pdf: ["application/pdf"],
    });
  });
});
