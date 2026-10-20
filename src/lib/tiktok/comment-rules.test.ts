import { describe, expect, it } from "vitest";

import type { CommentRuleDraft } from "@/lib/social/comment-rules";
import { TIKTOK_RULE_ACTIONS, TIKTOK_RULE_TEXT_LIMITS, fromTiktokRule, toTiktokRulePayload } from "@/lib/tiktok/comment-rules";
import type { TiktokCommentRule } from "@/lib/tiktok/types";

function rule(overrides: Partial<TiktokCommentRule> = {}): TiktokCommentRule {
  return {
    id: "rule-1",
    accountId: "acc-1",
    source: "tiktok",
    name: "Preço",
    enabled: true,
    containerId: "v-1",
    match: "contains",
    keywords: ["preço"],
    actions: ["public_reply", "like"],
    publicReplyText: "Te respondi!",
    priority: 2,
    createdAt: "2026-10-19T10:00:00Z",
    updatedAt: "2026-10-19T10:00:00Z",
    ...overrides,
  };
}

function draft(overrides: Partial<CommentRuleDraft> = {}): CommentRuleDraft {
  return {
    name: "Preço",
    enabled: true,
    containerId: "v-1",
    match: "contains",
    keywords: ["preço"],
    actions: ["public_reply"],
    publicReplyText: "Te respondi!",
    privateReplyText: "",
    priority: 0,
    ...overrides,
  };
}

describe("TIKTOK_RULE_ACTIONS", () => {
  it("allows a public reply, hiding and liking, never a private reply or a delete", () => {
    expect(TIKTOK_RULE_ACTIONS).toEqual(["public_reply", "hide", "like"]);
    expect(TIKTOK_RULE_ACTIONS).not.toContain("private_reply");
    expect(TIKTOK_RULE_ACTIONS).not.toContain("delete");
  });
});

describe("TIKTOK_RULE_TEXT_LIMITS", () => {
  it("caps a public reply at the 1,200 characters TikTok accepts", () => {
    expect(TIKTOK_RULE_TEXT_LIMITS).toEqual({ publicText: { max: 1200, unit: "characters" } });
  });
});

describe("fromTiktokRule", () => {
  it("maps the shared rule response, the video id becoming the container", () => {
    expect(fromTiktokRule(rule())).toEqual({
      id: "rule-1",
      name: "Preço",
      enabled: true,
      containerId: "v-1",
      match: "contains",
      keywords: ["preço"],
      actions: ["public_reply", "like"],
      publicReplyText: "Te respondi!",
      priority: 2,
    });
  });

  it("treats a rule without a video as an account rule", () => {
    expect(fromTiktokRule(rule({ containerId: undefined })).containerId).toBeUndefined();
    expect(fromTiktokRule(rule({ containerId: "" })).containerId).toBeUndefined();
  });

  it("drops actions TikTok cannot run", () => {
    expect(fromTiktokRule(rule({ actions: ["private_reply", "hide", "delete"] })).actions).toEqual(["hide"]);
  });
});

describe("toTiktokRulePayload", () => {
  it("sends the draft with the video id as the container", () => {
    expect(toTiktokRulePayload(draft())).toEqual({
      name: "Preço",
      enabled: true,
      containerId: "v-1",
      match: "contains",
      keywords: ["preço"],
      actions: ["public_reply"],
      publicReplyText: "Te respondi!",
      privateReplyText: "",
      priority: 0,
    });
  });

  it("never sends a private reply or a delete, nor a private text", () => {
    const payload = toTiktokRulePayload(draft({ actions: ["private_reply", "delete", "hide"], privateReplyText: "oi" }));
    expect(payload.actions).toEqual(["hide"]);
    expect(payload.privateReplyText).toBe("");
  });

  it("drops the public text when no public reply is chosen", () => {
    expect(toTiktokRulePayload(draft({ actions: ["like"] })).publicReplyText).toBe("");
  });

  it("keeps an account wide rule without a container", () => {
    expect(toTiktokRulePayload(draft({ containerId: "" })).containerId).toBe("");
  });
});
