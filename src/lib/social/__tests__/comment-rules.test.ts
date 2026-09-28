import { describe, expect, it } from "vitest";

import {
    FACEBOOK_RULE_ACTIONS,
    INSTAGRAM_RULE_ACTIONS,
    commentRuleFieldsErrors,
    fromFacebookRule,
    fromInstagramRule,
    ruleActionsFor,
    toFacebookRulePayload,
    toInstagramRulePayload,
    type CommentRuleDraft,
} from "@/lib/social/comment-rules";
import type { FacebookCommentRule } from "@/lib/facebook/types";
import type { InstagramCommentRule } from "@/lib/instagram/types";

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
