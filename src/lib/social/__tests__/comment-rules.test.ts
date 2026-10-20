import { describe, expect, it } from "vitest";

import {
    FACEBOOK_RULE_ACTIONS,
    INSTAGRAM_RULE_ACTIONS,
    MERCADOLIVRE_RULE_ACTIONS,
    commentRuleFieldsErrors,
    defaultRuleActions,
    fromFacebookRule,
    fromInstagramRule,
    fromMercadoLivreRule,
    ruleActionsFor,
    toFacebookRulePayload,
    toInstagramRulePayload,
    toMercadoLivreRulePayload,
    type CommentRuleDraft,
} from "@/lib/social/comment-rules";
import type { CommentSource } from "@/lib/audience/types";
import type { FacebookCommentRule } from "@/lib/facebook/types";
import type { InstagramCommentRule } from "@/lib/instagram/types";
import type { MercadoLivreCommentRule } from "@/lib/mercadolivre/types";
import { TIKTOK_RULE_ACTIONS } from "@/lib/tiktok/comment-rules";

const DRAFT: CommentRuleDraft = {
    name: "Promo",
    enabled: true,
    containerId: "post-1",
    match: "contains",
    keywords: ["quero"],
    actions: ["private_reply"],
    publicReplyText: "",
    privateReplyText: "Oi {{username}}",
    priority: 2,
};

describe("rule actions per source", () => {
    it("keeps Instagram to reply, direct and hide", () => {
        expect(INSTAGRAM_RULE_ACTIONS).toEqual(["public_reply", "private_reply", "hide"]);
        expect(ruleActionsFor("instagram")).toBe(INSTAGRAM_RULE_ACTIONS);
    });

    it("adds delete and like on Facebook", () => {
        expect(FACEBOOK_RULE_ACTIONS).toEqual(["public_reply", "private_reply", "hide", "delete", "like"]);
        expect(ruleActionsFor("facebook")).toBe(FACEBOOK_RULE_ACTIONS);
    });

    it("lets Mercado Livre rules answer or delete a question, never reply in private or hide", () => {
        expect(MERCADOLIVRE_RULE_ACTIONS).toEqual(["public_reply", "delete"]);
        expect(ruleActionsFor("mercadolivre")).toBe(MERCADOLIVRE_RULE_ACTIONS);
    });

    it("lets TikTok rules reply in public, hide or like, never reply in private or delete", () => {
        expect(ruleActionsFor("tiktok")).toBe(TIKTOK_RULE_ACTIONS);
        expect(ruleActionsFor("tiktok")).toEqual(["public_reply", "hide", "like"]);
    });

    it("offers no rule actions for a source it does not know", () => {
        expect(ruleActionsFor("fax" as unknown as CommentSource)).toEqual([]);
    });
});

describe("Instagram rule JSON stays unchanged", () => {
    it("reads igMediaId as the container", () => {
        const rule: InstagramCommentRule = {
            id: "r1",
            workspaceId: "ws",
            igAccountId: "acc",
            name: "Promo",
            enabled: true,
            igMediaId: "m1",
            match: "any",
            keywords: [],
            actions: ["hide"],
            priority: 1,
            createdAt: "",
            updatedAt: "",
        };
        expect(fromInstagramRule(rule)).toEqual({
            id: "r1",
            name: "Promo",
            enabled: true,
            containerId: "m1",
            match: "any",
            keywords: [],
            actions: ["hide"],
            publicReplyText: undefined,
            privateReplyText: undefined,
            priority: 1,
        });
    });

    it("writes igMediaId and keeps only Instagram actions", () => {
        expect(toInstagramRulePayload({ ...DRAFT, actions: ["private_reply", "like"] })).toEqual({
            name: "Promo",
            enabled: true,
            igMediaId: "post-1",
            match: "contains",
            keywords: ["quero"],
            actions: ["private_reply"],
            publicReplyText: "",
            privateReplyText: "Oi {{username}}",
            priority: 2,
        });
    });
});

describe("Facebook rule JSON", () => {
    it("reads postId as the container", () => {
        const rule: FacebookCommentRule = {
            id: "r2",
            pageId: "page",
            name: "Limpeza",
            enabled: false,
            postId: undefined,
            match: "exact",
            keywords: ["spam"],
            actions: ["delete"],
            priority: 0,
            createdAt: "",
            updatedAt: "",
        };
        expect(fromFacebookRule(rule)).toMatchObject({ id: "r2", containerId: undefined, actions: ["delete"], enabled: false });
    });

    it("writes postId", () => {
        expect(toFacebookRulePayload({ ...DRAFT, actions: ["like", "public_reply"], publicReplyText: "Valeu" })).toEqual({
            name: "Promo",
            enabled: true,
            postId: "post-1",
            match: "contains",
            keywords: ["quero"],
            actions: ["like", "public_reply"],
            publicReplyText: "Valeu",
            privateReplyText: "Oi {{username}}",
            priority: 2,
        });
    });
});

describe("commentRuleFieldsErrors", () => {
    it("needs keywords unless the rule matches any comment", () => {
        expect(commentRuleFieldsErrors({ match: "contains", keywords: " , ", actions: ["hide"], publicText: "", privateText: "" }).valid).toBe(false);
        expect(commentRuleFieldsErrors({ match: "any", keywords: "", actions: ["hide"], publicText: "", privateText: "" }).valid).toBe(true);
    });

    it("needs the text of each reply it sends", () => {
        const base = { match: "any" as const, keywords: "", publicText: "", privateText: "" };
        expect(commentRuleFieldsErrors({ ...base, actions: ["public_reply"] }).needsPublicText).toBe(true);
        expect(commentRuleFieldsErrors({ ...base, actions: ["private_reply"] }).needsPrivateText).toBe(true);
        expect(commentRuleFieldsErrors({ ...base, actions: [] }).valid).toBe(false);
    });

    it("splits keywords on commas and trims them", () => {
        expect(commentRuleFieldsErrors({ match: "contains", keywords: " quero, preço ,", actions: ["hide"], publicText: "", privateText: "" }).keywordList).toEqual([
            "quero",
            "preço",
        ]);
    });
});

describe("Mercado Livre rule JSON", () => {
    const rule: MercadoLivreCommentRule = {
        id: "r1",
        accountId: "acc",
        source: "mercadolivre",
        name: "Frete",
        enabled: true,
        containerId: "MLB123",
        match: "contains",
        keywords: ["frete"],
        actions: ["public_reply", "delete"],
        publicReplyText: "Oi {{username}}, o frete sai em 2 dias.",
        priority: 1,
        createdAt: "2026-10-19T10:00:00Z",
        updatedAt: "2026-10-19T10:00:00Z",
    };

    it("reads the listing as the container", () => {
        expect(fromMercadoLivreRule(rule)).toEqual({
            id: "r1",
            name: "Frete",
            enabled: true,
            containerId: "MLB123",
            match: "contains",
            keywords: ["frete"],
            actions: ["public_reply", "delete"],
            publicReplyText: "Oi {{username}}, o frete sai em 2 dias.",
            privateReplyText: undefined,
            priority: 1,
        });
    });

    it("writes only the actions a question accepts and never a private reply", () => {
        expect(
            toMercadoLivreRulePayload({ ...DRAFT, containerId: "MLB9", actions: ["public_reply", "private_reply", "hide", "delete"], publicReplyText: "Temos!" }),
        ).toEqual({
            name: "Promo",
            enabled: true,
            containerId: "MLB9",
            match: "contains",
            keywords: ["quero"],
            actions: ["public_reply", "delete"],
            publicReplyText: "Temos!",
            privateReplyText: "",
            priority: 2,
        });
    });
});

describe("defaultRuleActions", () => {
    it("starts a new rule on the private reply where the source has one", () => {
        expect(defaultRuleActions(INSTAGRAM_RULE_ACTIONS)).toEqual(["private_reply"]);
        expect(defaultRuleActions(FACEBOOK_RULE_ACTIONS)).toEqual(["private_reply"]);
    });

    it("starts a Mercado Livre rule on the answer, since a question has no private reply", () => {
        expect(defaultRuleActions(MERCADOLIVRE_RULE_ACTIONS)).toEqual(["public_reply"]);
    });

    it("starts with nothing when the source offers nothing", () => {
        expect(defaultRuleActions([])).toEqual([]);
    });
});

describe("commentRuleFieldsErrors with a reply limit", () => {
    const base = { match: "any" as const, keywords: "", actions: ["public_reply" as const], privateText: "" };

    it("refuses a public reply past the source limit", () => {
        const limit = { max: 10, unit: "characters" as const };
        expect(commentRuleFieldsErrors({ ...base, publicText: "a".repeat(11) }, { publicText: limit })).toMatchObject({ publicTooLong: true, valid: false });
        expect(commentRuleFieldsErrors({ ...base, publicText: "a".repeat(10) }, { publicText: limit })).toMatchObject({ publicTooLong: false, valid: true });
    });

    it("has no length rule when the source sets none", () => {
        expect(commentRuleFieldsErrors({ ...base, publicText: "a".repeat(5000) })).toMatchObject({ publicTooLong: false, valid: true });
    });
});
