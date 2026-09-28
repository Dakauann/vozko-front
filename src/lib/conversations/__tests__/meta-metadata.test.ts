import { describe, expect, it } from "vitest";

import {
    isLikeSticker,
    metaPrefix,
    readLinkShare,
    readPostShare,
    readPostback,
    readReaction,
    readReferral,
    readSentVia,
    readStickerId,
    readStory,
} from "@/lib/conversations/meta-metadata";

describe("metaPrefix", () => {
    it("knows the Meta channels and nothing else", () => {
        expect(metaPrefix("instagram")).toBe("instagram");
        expect(metaPrefix("facebook")).toBe("facebook");
        expect(metaPrefix("whatsapp")).toBeNull();
        expect(metaPrefix(undefined)).toBeNull();
    });
});

describe("readReaction", () => {
    it("prefers the emoji and falls back to the reaction name", () => {
        expect(readReaction({ facebook_reaction_emoji: "😍", facebook_reaction: "love" }, "facebook")).toBe("😍");
        expect(readReaction({ instagram_reaction: "❤" }, "instagram")).toBe("❤");
    });

    it("is empty after an unreact", () => {
        expect(readReaction({ facebook_reaction_action: "unreact", facebook_reaction: "", facebook_reaction_emoji: "" }, "facebook")).toBeNull();
        expect(readReaction({}, "facebook")).toBeNull();
        expect(readReaction(null, "facebook")).toBeNull();
    });
});

describe("readReferral", () => {
    it("reads the ad a Messenger conversation came from", () => {
        expect(
            readReferral({ facebook_referral_source: "ADS", facebook_referral_ad_title: "Promo de outubro", facebook_referral_ad_id: "42" }, "facebook"),
        ).toEqual({ source: "ADS", adTitle: "Promo de outubro", adId: "42", ref: undefined, type: undefined });
    });

    it("returns null without referral keys", () => {
        expect(readReferral({ facebook_mid: "m_1" }, "facebook")).toBeNull();
    });
});

describe("readLinkShare and readPostShare", () => {
    it("reads the link card of a fallback attachment", () => {
        expect(readLinkShare({ facebook_link_url: "https://x.test", facebook_link_title: "X" }, "facebook")).toEqual({
            url: "https://x.test",
            title: "X",
        });
        expect(readLinkShare({}, "facebook")).toBeNull();
    });

    it("reads a shared post for either Meta channel", () => {
        expect(readPostShare({ instagram_shared_post_url: "https://ig.test/p/1" }, "instagram")).toEqual({
            url: "https://ig.test/p/1",
            title: undefined,
            id: undefined,
        });
        expect(readPostShare({ facebook_shared_post_id: "1_2", facebook_shared_post_title: "Post" }, "facebook")).toEqual({
            url: undefined,
            title: "Post",
            id: "1_2",
        });
        expect(readPostShare({}, "facebook")).toBeNull();
    });
});

describe("stickers", () => {
    it("reads the sticker id and recognises the like sticker", () => {
        expect(readStickerId({ facebook_sticker_id: "369239263222822" }, "facebook")).toBe("369239263222822");
        expect(isLikeSticker("369239263222822")).toBe(true);
        expect(isLikeSticker("369239343222814")).toBe(true);
        expect(isLikeSticker("369239383222810")).toBe(true);
        expect(isLikeSticker("1")).toBe(false);
        expect(isLikeSticker(null)).toBe(false);
    });
});

describe("readSentVia", () => {
    it("reads who sent an echoed Messenger message", () => {
        expect(readSentVia({ facebook_sent_via: "meta_business_suite" })).toBe("meta_business_suite");
        expect(readSentVia({ facebook_sent_via: "external_app" })).toBe("external_app");
        expect(readSentVia({ facebook_sent_via: "vozko" })).toBe("vozko");
        expect(readSentVia({ facebook_sent_via: "unknown" })).toBe("unknown");
    });

    it("ignores values it does not know", () => {
        expect(readSentVia({ facebook_sent_via: "carrier-pigeon" })).toBeNull();
        expect(readSentVia({})).toBeNull();
    });
});

describe("readPostback", () => {
    it("reads the button a contact tapped", () => {
        expect(readPostback({ facebook_postback_payload: "GET_STARTED", facebook_postback_title: "Começar" })).toEqual({
            payload: "GET_STARTED",
            title: "Começar",
        });
        expect(readPostback({})).toBeNull();
    });
});

describe("readStory", () => {
    it("reads a story reply or mention image for the channel", () => {
        expect(readStory({ instagram_story_url: "https://s.test/1" }, "instagram")).toBe("https://s.test/1");
        expect(readStory({ instagram_story_mention_url: "https://s.test/2" }, "instagram")).toBe("https://s.test/2");
        expect(readStory({ facebook_story_url: "https://s.test/3" }, "facebook")).toBe("https://s.test/3");
        expect(readStory({}, "facebook")).toBeUndefined();
    });
});
