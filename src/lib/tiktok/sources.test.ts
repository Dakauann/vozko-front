import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  replyTiktokCommentAction: vi.fn(),
  setTiktokCommentHiddenAction: vi.fn(),
  setTiktokCommentLikedAction: vi.fn(),
  listTiktokCommentRulesAction: vi.fn(),
  createTiktokCommentRuleAction: vi.fn(),
  updateTiktokCommentRuleAction: vi.fn(),
  deleteTiktokCommentRuleAction: vi.fn(),
  listTiktokAccountsAction: vi.fn(),
  listTiktokVideosAction: vi.fn(),
}));

vi.mock("@/app/actions/tiktok", () => actions);

import type { CommentRuleDraft } from "@/lib/social/comment-rules";
import { tiktokCommentActions, tiktokCommentSourceScope, tiktokRuleApi } from "@/lib/tiktok/sources";
import { tiktokAccount, tiktokVideo } from "@/lib/tiktok/test-fixtures";

const DRAFT: CommentRuleDraft = {
  name: "Preço",
  enabled: true,
  containerId: "v-1",
  match: "contains",
  keywords: ["preço"],
  actions: ["public_reply", "private_reply"],
  publicReplyText: "Oi",
  privateReplyText: "No privado",
  priority: 0,
};

const RULE = {
  id: "rule-1",
  accountId: "acc-1",
  source: "tiktok",
  name: "Preço",
  enabled: true,
  containerId: "v-1",
  match: "contains",
  keywords: ["preço"],
  actions: ["public_reply"],
  publicReplyText: "Oi",
  priority: 0,
  createdAt: "2026-10-19T10:00:00Z",
  updatedAt: "2026-10-19T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tiktokCommentActions", () => {
  it("replies, hides and likes through the TikTok account endpoints", async () => {
    actions.replyTiktokCommentAction.mockResolvedValue({ comment: {} });
    actions.setTiktokCommentHiddenAction.mockResolvedValue({ comment: {} });
    actions.setTiktokCommentLikedAction.mockResolvedValue({ comment: {} });
    const thread = tiktokCommentActions("acc-1");

    expect(await thread.reply("c-1", "Oi")).toEqual({});
    expect(await thread.setHidden?.("c-1", true)).toEqual({});
    expect(await thread.setLiked?.("c-1", false)).toEqual({});

    expect(actions.replyTiktokCommentAction).toHaveBeenCalledWith("acc-1", "c-1", "Oi");
    expect(actions.setTiktokCommentHiddenAction).toHaveBeenCalledWith("acc-1", "c-1", true);
    expect(actions.setTiktokCommentLikedAction).toHaveBeenCalledWith("acc-1", "c-1", false);
  });

  it("hands back a refusal with its code", async () => {
    actions.replyTiktokCommentAction.mockResolvedValue({ error: "rate limited", status: 429 });
    expect(await tiktokCommentActions("acc-1").reply("c-1", "Oi")).toEqual({ error: "rate limited", code: undefined });
  });

  it("offers no private reply and refuses a delete without calling the backend", async () => {
    const thread = tiktokCommentActions("acc-1");
    expect(thread.privateReply).toBeUndefined();
    expect((await thread.remove("c-1")).error).toBeDefined();
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
  });
});

describe("tiktokRuleApi", () => {
  it("lists rules as shared comment rules", async () => {
    actions.listTiktokCommentRulesAction.mockResolvedValue({ rules: [RULE] });
    const result = await tiktokRuleApi("acc-1").list();
    expect(result.error).toBeUndefined();
    expect(result.rules.map((rule) => rule.containerId)).toEqual(["v-1"]);
  });

  it("passes the list failure on", async () => {
    actions.listTiktokCommentRulesAction.mockResolvedValue({ rules: [], error: "nope" });
    expect(await tiktokRuleApi("acc-1").list()).toEqual({ rules: [], error: "nope" });
  });

  it("creates and updates with the TikTok payload, never a private reply", async () => {
    actions.createTiktokCommentRuleAction.mockResolvedValue({ rule: RULE });
    actions.updateTiktokCommentRuleAction.mockResolvedValue({ rule: RULE });
    const api = tiktokRuleApi("acc-1");

    expect((await api.create(DRAFT)).rule?.id).toBe("rule-1");
    await api.update("rule-1", DRAFT);

    const [, created] = actions.createTiktokCommentRuleAction.mock.calls[0];
    const [, ruleId, updated] = actions.updateTiktokCommentRuleAction.mock.calls[0];
    expect(created.actions).toEqual(["public_reply"]);
    expect(created.privateReplyText).toBe("");
    expect(ruleId).toBe("rule-1");
    expect(updated).toEqual(created);
  });

  it("passes save and delete failures on", async () => {
    actions.createTiktokCommentRuleAction.mockResolvedValue({ error: "bad rule", code: "invalid_rule" });
    actions.deleteTiktokCommentRuleAction.mockResolvedValue({ error: "gone", status: 404 });
    const api = tiktokRuleApi("acc-1");
    expect(await api.create(DRAFT)).toEqual({ error: "bad rule" });
    expect(await api.remove("rule-1")).toEqual({ error: "gone" });
  });

  it("deletes a rule", async () => {
    actions.deleteTiktokCommentRuleAction.mockResolvedValue({ deleted: true });
    expect(await tiktokRuleApi("acc-1").remove("rule-1")).toEqual({});
    expect(actions.deleteTiktokCommentRuleAction).toHaveBeenCalledWith("acc-1", "rule-1");
  });
});

describe("tiktokCommentSourceScope", () => {
  it("points at the TikTok accounts page and permission", () => {
    expect(tiktokCommentSourceScope.accountsPage).toBe("/dashboard/tiktok-accounts");
    expect(tiktokCommentSourceScope.readResource).toBe("tiktok_accounts");
  });

  it("labels accounts by username", async () => {
    actions.listTiktokAccountsAction.mockResolvedValue({ accounts: [tiktokAccount()], meta: {} });
    expect(await tiktokCommentSourceScope.loadAccounts()).toEqual({ accounts: [{ id: "acc-1", label: "@loja" }], error: undefined });
    expect(actions.listTiktokAccountsAction).toHaveBeenCalledWith(1, 50);
  });

  it("passes the account list failure on", async () => {
    actions.listTiktokAccountsAction.mockResolvedValue({ accounts: [], meta: {}, error: "down" });
    expect(await tiktokCommentSourceScope.loadAccounts()).toEqual({ accounts: [], error: "down" });
  });

  it("offers the videos as posts", async () => {
    actions.listTiktokVideosAction.mockResolvedValue({ page: { videos: [tiktokVideo()], hasMore: false } });
    expect(await tiktokCommentSourceScope.loadPosts("acc-1")).toEqual([
      { id: "v-1", text: "Lançamento", timestamp: "2026-10-18T10:00:00Z" },
    ]);
  });
});
