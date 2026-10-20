import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("@/lib/api/browser-client", () => ({ apiClient: client.apiClient }));

import {
  checkTiktokAccountHealthAction,
  createTiktokCommentRuleAction,
  deleteTiktokCommentRuleAction,
  disconnectTiktokAccountAction,
  getTiktokAccountAction,
  listTiktokAccountsAction,
  listTiktokCommentRulesAction,
  listTiktokCommentsAction,
  listTiktokVideosAction,
  replyTiktokCommentAction,
  setTiktokCommentHiddenAction,
  setTiktokCommentLikedAction,
  updateTiktokAccountAction,
  updateTiktokCommentRuleAction,
} from "@/app/actions/tiktok";

const RULE_PAYLOAD = {
  name: "Preço",
  enabled: true,
  containerId: "v-1",
  match: "contains" as const,
  keywords: ["preço"],
  actions: ["public_reply" as const],
  publicReplyText: "Oi",
  privateReplyText: "",
  priority: 0,
};

beforeEach(() => {
  client.apiClient.mockReset();
});

describe("TikTok account actions", () => {
  it("lists accounts with page, size, search and status", async () => {
    const meta = { page: 2, pageSize: 15, totalPages: 3, totalItems: 31 };
    client.apiClient.mockResolvedValue({ data: { data: [{ id: "acc-1" }], meta } });
    const result = await listTiktokAccountsAction(2, 15, "loja", "NEEDS_RECONNECT");
    expect(client.apiClient).toHaveBeenCalledWith("/tiktok/accounts?page=2&pageSize=15&search=loja&status=NEEDS_RECONNECT", { method: "GET" });
    expect(result).toEqual({ accounts: [{ id: "acc-1" }], meta });
  });

  it("reports a list failure with its status and keeps an empty list", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "nope", status: 502 } });
    expect(await listTiktokAccountsAction()).toMatchObject({ accounts: [], error: "nope", status: 502 });
  });

  it("loads one account", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "acc-1" } });
    expect(await getTiktokAccountAction("acc-1")).toEqual({ account: { id: "acc-1" } });
    expect(client.apiClient).toHaveBeenCalledWith("/tiktok/accounts/acc-1", { method: "GET" });
  });

  it("puts only the changed fields, clearing references with an empty string", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "acc-1" } });
    await updateTiktokAccountAction("acc-1", { agentId: null, enableAnalysis: true });
    expect(client.apiClient).toHaveBeenCalledWith("/tiktok/accounts/acc-1", {
      method: "PUT",
      body: JSON.stringify({ agentId: "", enableAnalysis: true }),
    });
  });

  it("returns the update refusal with its status", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "too long", status: 422 } });
    expect(await updateTiktokAccountAction("acc-1", { automationDisclosure: "x" })).toEqual({ error: "too long", status: 422 });
  });

  it("disconnects and returns the purge date and warning", async () => {
    client.apiClient.mockResolvedValue({ data: { purgeAfter: "2026-11-18T10:00:00Z", warning: "revoke_failed" } });
    expect(await disconnectTiktokAccountAction("acc-1")).toEqual({
      disconnected: { purgeAfter: "2026-11-18T10:00:00Z", warning: "revoke_failed" },
    });
    expect(client.apiClient).toHaveBeenCalledWith("/tiktok/accounts/acc-1", { method: "DELETE" });
  });

  it("runs the health check", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "acc-1" } });
    expect(await checkTiktokAccountHealthAction("acc-1")).toEqual({ account: { id: "acc-1" } });
    expect(client.apiClient).toHaveBeenCalledWith("/tiktok/accounts/acc-1/health-check", { method: "POST" });
  });

  it("treats an empty success body as a failure", async () => {
    client.apiClient.mockResolvedValue({ data: undefined });
    expect(await getTiktokAccountAction("acc-1")).toEqual({ error: "Empty response" });
  });

  it("escapes the account id in the path", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "a/b" } });
    await getTiktokAccountAction("a/b");
    expect(client.apiClient).toHaveBeenCalledWith("/tiktok/accounts/a%2Fb", { method: "GET" });
  });
});

describe("TikTok video and comment actions", () => {
  it("lists the first page of videos without a cursor and the next one with it", async () => {
    client.apiClient.mockResolvedValue({ data: { videos: [{ itemId: "v-1" }], nextCursor: "20", hasMore: true } });
    expect(await listTiktokVideosAction("acc-1")).toEqual({ page: { videos: [{ itemId: "v-1" }], nextCursor: "20", hasMore: true } });
    expect(client.apiClient).toHaveBeenCalledWith("/tiktok/accounts/acc-1/videos", { method: "GET" });

    await listTiktokVideosAction("acc-1", "20");
    expect(client.apiClient).toHaveBeenLastCalledWith("/tiktok/accounts/acc-1/videos?cursor=20", { method: "GET" });
  });

  it("keeps an empty video page on failure", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "slow down", status: 429 } });
    expect(await listTiktokVideosAction("acc-1")).toEqual({ page: { videos: [], hasMore: false }, error: "slow down", status: 429 });
  });

  it("lists comments of a video, asking for hidden ones only when told to", async () => {
    client.apiClient.mockResolvedValue({ data: { comments: [], hasMore: false } });
    await listTiktokCommentsAction("acc-1", "v-1");
    expect(client.apiClient).toHaveBeenCalledWith("/tiktok/accounts/acc-1/videos/v-1/comments?includeHidden=false", { method: "GET" });

    await listTiktokCommentsAction("acc-1", "v-1", "40", true);
    expect(client.apiClient).toHaveBeenLastCalledWith("/tiktok/accounts/acc-1/videos/v-1/comments?cursor=40&includeHidden=true", {
      method: "GET",
    });
  });

  it("replies to a comment", async () => {
    client.apiClient.mockResolvedValue({ data: { commentId: "r-1" } });
    expect(await replyTiktokCommentAction("acc-1", "c-1", "Oi")).toEqual({ comment: { commentId: "r-1" } });
    expect(client.apiClient).toHaveBeenCalledWith("/tiktok/accounts/acc-1/comments/c-1/replies", {
      method: "POST",
      body: JSON.stringify({ text: "Oi" }),
    });
  });

  it("hides, shows, likes and unlikes through their own endpoints", async () => {
    client.apiClient.mockResolvedValue({ data: { commentId: "c-1" } });
    await setTiktokCommentHiddenAction("acc-1", "c-1", true);
    await setTiktokCommentHiddenAction("acc-1", "c-1", false);
    await setTiktokCommentLikedAction("acc-1", "c-1", true);
    await setTiktokCommentLikedAction("acc-1", "c-1", false);
    expect(client.apiClient.mock.calls.map(([path]) => path)).toEqual([
      "/tiktok/accounts/acc-1/comments/c-1/hide",
      "/tiktok/accounts/acc-1/comments/c-1/unhide",
      "/tiktok/accounts/acc-1/comments/c-1/like",
      "/tiktok/accounts/acc-1/comments/c-1/unlike",
    ]);
  });

  it("returns a moderation refusal with its status", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "not connected", status: 409 } });
    expect(await setTiktokCommentHiddenAction("acc-1", "c-1", true)).toEqual({ error: "not connected", status: 409 });
  });
});

describe("TikTok comment rule actions", () => {
  it("lists rules", async () => {
    client.apiClient.mockResolvedValue({ data: [{ id: "rule-1" }] });
    expect(await listTiktokCommentRulesAction("acc-1")).toEqual({ rules: [{ id: "rule-1" }] });
    expect(client.apiClient).toHaveBeenCalledWith("/tiktok/accounts/acc-1/comment-rules", { method: "GET" });
  });

  it("keeps an empty rule list on failure", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "nope", code: "not_found", status: 404 } });
    expect(await listTiktokCommentRulesAction("acc-1")).toEqual({ rules: [], error: "nope", code: "not_found", status: 404 });
  });

  it("creates, updates and deletes a rule", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "rule-1" } });
    expect(await createTiktokCommentRuleAction("acc-1", RULE_PAYLOAD)).toEqual({ rule: { id: "rule-1" } });
    expect(client.apiClient).toHaveBeenLastCalledWith("/tiktok/accounts/acc-1/comment-rules", {
      method: "POST",
      body: JSON.stringify(RULE_PAYLOAD),
    });

    await updateTiktokCommentRuleAction("acc-1", "rule-1", RULE_PAYLOAD);
    expect(client.apiClient).toHaveBeenLastCalledWith("/tiktok/accounts/acc-1/comment-rules/rule-1", {
      method: "PUT",
      body: JSON.stringify(RULE_PAYLOAD),
    });

    client.apiClient.mockResolvedValue({ data: { status: "deleted" } });
    expect(await deleteTiktokCommentRuleAction("acc-1", "rule-1")).toEqual({ deleted: true });
    expect(client.apiClient).toHaveBeenLastCalledWith("/tiktok/accounts/acc-1/comment-rules/rule-1", { method: "DELETE" });
  });

  it("returns the rule refusal code", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "bad rule", code: "invalid_rule", status: 400 } });
    expect(await createTiktokCommentRuleAction("acc-1", RULE_PAYLOAD)).toEqual({ error: "bad rule", code: "invalid_rule", status: 400 });
  });
});
