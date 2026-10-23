import { describe, expect, it } from "vitest";

import {
    ANALYSABLE_COMMENT_SOURCES,
    AUDIENCE_SOURCES,
    COMMENT_SOURCES,
    isAnalysableCommentSource,
    isCommentSource,
    type AnalysableCommentSource,
    type AudienceSource,
} from "@/lib/audience/types";

const AUDIENCE_SOURCE_SET: Record<AudienceSource, true> = {
    instagram: true,
    facebook: true,
    whatsapp: true,
    telegram: true,
    unofficial_whatsapp: true,
    webchat: true,
    tiktok: true,
    email: true,
    rcs: true,
    sms: true,
};

const ANALYSABLE_COMMENT_SOURCE_SET: Record<AnalysableCommentSource, true> = {
    instagram: true,
    facebook: true,
    tiktok: true,
};

describe("audience sources", () => {
    it("lists Facebook as both a comment and a conversation source", () => {
        expect(COMMENT_SOURCES).toEqual(["instagram", "facebook", "mercadolivre", "tiktok"]);
        expect(AUDIENCE_SOURCES).toContain("facebook");
    });

    it("tells comment sources from conversation-only channels", () => {
        expect(isCommentSource("instagram")).toBe(true);
        expect(isCommentSource("facebook")).toBe(true);
        expect(isCommentSource("mercadolivre")).toBe(true);
        expect(isCommentSource("whatsapp")).toBe(false);
        expect(isCommentSource("")).toBe(false);
    });

    it("keeps Mercado Livre questions out of every audience analysis", () => {
        expect(ANALYSABLE_COMMENT_SOURCES).toEqual(["instagram", "facebook", "tiktok"]);
        expect(Object.keys(ANALYSABLE_COMMENT_SOURCE_SET)).toEqual(ANALYSABLE_COMMENT_SOURCES);
        expect(AUDIENCE_SOURCES).toEqual(Object.keys(AUDIENCE_SOURCE_SET));
        expect(AUDIENCE_SOURCES).not.toContain("mercadolivre");
        expect(isAnalysableCommentSource("mercadolivre")).toBe(false);
        expect(isAnalysableCommentSource("instagram")).toBe(true);
        expect(isAnalysableCommentSource("tiktok")).toBe(true);
        expect(isCommentSource("tiktok")).toBe(true);
        expect(isAnalysableCommentSource("whatsapp")).toBe(false);
    });

    it("analyses email conversations but never as a comment source", () => {
        expect(AUDIENCE_SOURCES).toContain("email");
        expect(isCommentSource("email")).toBe(false);
        expect(isAnalysableCommentSource("email")).toBe(false);
    });
});
