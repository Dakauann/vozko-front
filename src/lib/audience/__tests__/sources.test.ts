import { describe, expect, it } from "vitest";

import { AUDIENCE_SOURCES, COMMENT_SOURCES, isCommentSource } from "@/lib/audience/types";

describe("audience sources", () => {
    it("lists Facebook as both a comment and a conversation source", () => {
        expect(COMMENT_SOURCES).toEqual(["instagram", "facebook"]);
        expect(AUDIENCE_SOURCES).toContain("facebook");
    });

    it("tells comment sources from conversation-only channels", () => {
        expect(isCommentSource("instagram")).toBe(true);
        expect(isCommentSource("facebook")).toBe(true);
        expect(isCommentSource("whatsapp")).toBe(false);
        expect(isCommentSource("")).toBe(false);
    });
});
