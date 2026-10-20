import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("@/lib/api/browser-client", () => ({ apiClient: client.apiClient }));

import {
  answerMercadoLivreQuestionAction,
  checkMercadoLivreAccountHealthAction,
  createMercadoLivreCommentRuleAction,
  deleteMercadoLivreCommentRuleAction,
  deleteMercadoLivreQuestionAction,
  disconnectMercadoLivreAccountAction,
  getMercadoLivreAccountAction,
  getMercadoLivrePackSummaryAction,
  getMercadoLivreResponseTimeAction,
  listMercadoLivreAccountsAction,
  listMercadoLivreCommentRulesAction,
  listMercadoLivreListingsAction,
  listMercadoLivreQuestionsAction,
  listMercadoLivreReasonsAction,
  sendMercadoLivreReasonAction,
  setMercadoLivreQuestionAuthorBlockedAction,
  updateMercadoLivreAccountAction,
  updateMercadoLivreCommentRuleAction,
} from "@/app/actions/mercadolivre";

beforeEach(() => {
  client.apiClient.mockReset();
});

describe("Mercado Livre account actions", () => {
  it("lists accounts with page, size, search and status", async () => {
    const meta = { page: 2, pageSize: 15, totalPages: 3, totalItems: 31 };
    client.apiClient.mockResolvedValue({ data: { data: [{ id: "acc-1" }], meta } });
    const result = await listMercadoLivreAccountsAction(2, 15, "loja", "NEEDS_RECONNECT");
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts?page=2&pageSize=15&search=loja&status=NEEDS_RECONNECT", {
      method: "GET",
    });
    expect(result).toEqual({ accounts: [{ id: "acc-1" }], meta });
  });

  it("reports a list failure with its code and keeps an empty list", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "nope", code: "invalid_status", status: 400 } });
    const result = await listMercadoLivreAccountsAction();
    expect(result).toMatchObject({ accounts: [], error: "nope", code: "invalid_status", status: 400 });
  });

  it("loads one account", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "acc-1" } });
    expect(await getMercadoLivreAccountAction("acc-1")).toEqual({ account: { id: "acc-1" } });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1", { method: "GET" });
  });

  it("patches only the changed fields, clearing references with an empty string", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "acc-1" } });
    await updateMercadoLivreAccountAction("acc-1", { agentId: null, enableAgentResponses: false });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1", {
      method: "PATCH",
      body: JSON.stringify({ agentId: "", enableAgentResponses: false }),
    });
  });

  it("returns the update error code", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "bad", code: "text_charset", status: 400 } });
    expect(await updateMercadoLivreAccountAction("acc-1", { automationDisclosure: "“x”" })).toEqual({
      error: "bad",
      code: "text_charset",
      status: 400,
    });
  });

  it("disconnects and returns the purge date and warning", async () => {
    client.apiClient.mockResolvedValue({ data: { status: "disconnected", purgeAfter: "2026-11-18T10:00:00Z", warning: "revoke_failed" } });
    expect(await disconnectMercadoLivreAccountAction("acc-1")).toEqual({
      disconnected: { status: "disconnected", purgeAfter: "2026-11-18T10:00:00Z", warning: "revoke_failed" },
    });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1", { method: "DELETE" });
  });

  it("runs the health check and maps its refusals", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "acc-1" } });
    expect(await checkMercadoLivreAccountHealthAction("acc-1")).toEqual({ account: { id: "acc-1" } });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/health-check", { method: "POST" });

    client.apiClient.mockResolvedValue({ error: { message: "down", code: "mercadolivre_unreachable", status: 502 } });
    expect(await checkMercadoLivreAccountHealthAction("acc-1")).toEqual({ error: "down", code: "mercadolivre_unreachable", status: 502 });
  });

  it("treats an empty success body as a failure", async () => {
    client.apiClient.mockResolvedValue({ data: undefined });
    expect(await getMercadoLivreAccountAction("acc-1")).toEqual({ error: "Empty response" });
  });
});

describe("Mercado Livre listing and question actions", () => {
  it("lists listings from the mirror with search, status and the keyset cursor", async () => {
    client.apiClient.mockResolvedValue({ data: { data: [{ id: "l-1" }], nextCursor: "next" } });
    const result = await listMercadoLivreListingsAction("acc-1", { search: "tênis azul", status: "paused", cursor: "c1", limit: 30 });
    expect(client.apiClient).toHaveBeenCalledWith(
      "/mercadolivre/accounts/acc-1/listings?search=t%C3%AAnis+azul&status=paused&cursor=c1&limit=30",
      { method: "GET" },
    );
    expect(result).toEqual({ page: { data: [{ id: "l-1" }], nextCursor: "next" } });
  });

  it("asks for the listings without a query string when nothing filters them", async () => {
    client.apiClient.mockResolvedValue({ data: { data: [] } });
    expect(await listMercadoLivreListingsAction("acc-1", {})).toEqual({ page: { data: [] } });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/listings", { method: "GET" });
  });

  it("lists the account questions with the status filter and cursor", async () => {
    client.apiClient.mockResolvedValue({ data: { data: [{ id: "q-1" }] } });
    await listMercadoLivreQuestionsAction("acc-1", { status: "UNANSWERED", cursor: "c2" });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/questions?status=UNANSWERED&cursor=c2", {
      method: "GET",
    });
  });

  it("lists the questions of one listing under that listing", async () => {
    client.apiClient.mockResolvedValue({ data: { data: [] } });
    await listMercadoLivreQuestionsAction("acc-1", { itemId: "MLB123", status: "ANSWERED" });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/listings/MLB123/questions?status=ANSWERED", {
      method: "GET",
    });
  });

  it("escapes every path segment so an id never reaches another route", async () => {
    client.apiClient.mockResolvedValue({ data: { data: [] } });
    await listMercadoLivreQuestionsAction("acc/1", { itemId: "MLB?1" });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc%2F1/listings/MLB%3F1/questions", { method: "GET" });
  });

  it("reports a list failure with its code and no page", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "bad cursor", code: "invalid_cursor", status: 400 } });
    expect(await listMercadoLivreQuestionsAction("acc-1", { cursor: "x" })).toEqual({ error: "bad cursor", code: "invalid_cursor", status: 400 });
  });

  it("answers a question and returns the stored question", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "q-1", status: "ANSWERED" } });
    expect(await answerMercadoLivreQuestionAction("acc-1", "987", "Temos sim!")).toEqual({ question: { id: "q-1", status: "ANSWERED" } });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/questions/987/answer", {
      method: "POST",
      body: JSON.stringify({ text: "Temos sim!" }),
    });
  });

  it("keeps the refusal code when the question is no longer open", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "closed", code: "question_not_open", status: 409 } });
    expect(await answerMercadoLivreQuestionAction("acc-1", "987", "oi")).toEqual({ error: "closed", code: "question_not_open", status: 409 });
  });

  it("deletes a question", async () => {
    client.apiClient.mockResolvedValue({ data: { status: "deleted" } });
    expect(await deleteMercadoLivreQuestionAction("acc-1", "987")).toEqual({ status: "deleted" });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/questions/987", { method: "DELETE" });
  });

  it("blocks and unblocks the author of a question", async () => {
    client.apiClient.mockResolvedValue({ data: { status: "blocked" } });
    expect(await setMercadoLivreQuestionAuthorBlockedAction("acc-1", "987", true)).toEqual({ status: "blocked" });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/questions/987/block-author", { method: "POST" });

    client.apiClient.mockResolvedValue({ data: { status: "unblocked" } });
    expect(await setMercadoLivreQuestionAuthorBlockedAction("acc-1", "987", false)).toEqual({ status: "unblocked" });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/questions/987/block-author", { method: "DELETE" });
  });

  it("loads the response time metric", async () => {
    client.apiClient.mockResolvedValue({ data: { available: false } });
    expect(await getMercadoLivreResponseTimeAction("acc-1")).toEqual({ responseTime: { available: false } });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/questions/response-time", { method: "GET" });
  });
});

describe("Mercado Livre comment rule actions", () => {
  const body = {
    name: "Frete",
    enabled: true,
    containerId: "MLB1",
    match: "contains" as const,
    keywords: ["frete"],
    actions: ["public_reply" as const],
    publicReplyText: "Oi {{username}}",
    privateReplyText: "",
    priority: 0,
  };

  it("lists the rules of the account", async () => {
    client.apiClient.mockResolvedValue({ data: [{ id: "r-1" }] });
    expect(await listMercadoLivreCommentRulesAction("acc-1")).toEqual({ rules: [{ id: "r-1" }] });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/comment-rules", { method: "GET" });
  });

  it("keeps an empty list beside a list failure", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "nope", status: 404 } });
    expect(await listMercadoLivreCommentRulesAction("acc-1")).toEqual({ rules: [], error: "nope", status: 404 });
  });

  it("creates, replaces and removes a rule under the account in the URL", async () => {
    client.apiClient.mockResolvedValue({ data: { id: "r-1" } });
    expect(await createMercadoLivreCommentRuleAction("acc-1", body)).toEqual({ rule: { id: "r-1" } });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/comment-rules", { method: "POST", body: JSON.stringify(body) });

    expect(await updateMercadoLivreCommentRuleAction("acc-1", "r-1", body)).toEqual({ rule: { id: "r-1" } });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/comment-rules/r-1", { method: "PATCH", body: JSON.stringify(body) });

    client.apiClient.mockResolvedValue({ data: { status: "deleted" } });
    expect(await deleteMercadoLivreCommentRuleAction("acc-1", "r-1")).toEqual({ status: "deleted" });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/accounts/acc-1/comment-rules/r-1", { method: "DELETE" });
  });

  it("returns the rule refusal code", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "too long", code: "invalid_rule", status: 400 } });
    expect(await createMercadoLivreCommentRuleAction("acc-1", body)).toEqual({ error: "too long", code: "invalid_rule", status: 400 });
  });
});

describe("Mercado Livre reason actions", () => {
  it("loads the reasons of a conversation", async () => {
    client.apiClient.mockResolvedValue({ data: { data: [{ id: "OTHER" }] } });
    expect(await listMercadoLivreReasonsAction("entry-1")).toEqual({ options: [{ id: "OTHER" }] });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/conversations/entry-1/reasons", { method: "GET" });
  });

  it("sends the chosen reason and returns the provider message id", async () => {
    const send = { optionId: "OTHER", templateId: "", text: "Olá", vars: [] };
    client.apiClient.mockResolvedValue({ data: { providerMessageId: "m-1" } });
    expect(await sendMercadoLivreReasonAction("entry-1", send)).toEqual({ providerMessageId: "m-1" });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/conversations/entry-1/reasons", { method: "POST", body: JSON.stringify(send) });
  });

  it("keeps the reason refusal code", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "cap", code: "reason_cap_reached", status: 422 } });
    expect(await sendMercadoLivreReasonAction("entry-1", { optionId: "OTHER", templateId: "", text: "x", vars: [] })).toEqual({
      error: "cap",
      code: "reason_cap_reached",
      status: 422,
    });
  });
});

describe("Mercado Livre pack summary action", () => {
  const pack = {
    items: [{ itemId: "MLB1", title: "Caneca", quantity: 2, unitPrice: 39.9, thumbnailUrl: "https://cdn/x.jpg" }],
    orderStatus: "paid",
    shippingStatus: "shipped",
    shippingSubstatus: "out_for_delivery",
    total: 79.8,
    currency: "BRL",
    refreshedAt: "2026-10-19T10:00:00Z",
  };

  it("loads the sale summary of the conversation", async () => {
    client.apiClient.mockResolvedValue({ data: pack });
    expect(await getMercadoLivrePackSummaryAction("entry-1")).toEqual({ pack });
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/conversations/entry-1/pack", { method: "GET" });
  });

  it("keeps the conversation id inside its own path segment", async () => {
    client.apiClient.mockResolvedValue({ data: pack });
    await getMercadoLivrePackSummaryAction("../accounts/acc-1?x=1");
    expect(client.apiClient).toHaveBeenCalledWith("/mercadolivre/conversations/..%2Faccounts%2Facc-1%3Fx%3D1/pack", { method: "GET" });
  });

  it("keeps the pending code and the forbidden status", async () => {
    client.apiClient.mockResolvedValue({ error: { message: "loading", code: "pack_summary_pending", status: 404 } });
    expect(await getMercadoLivrePackSummaryAction("entry-1")).toEqual({ error: "loading", code: "pack_summary_pending", status: 404 });
    client.apiClient.mockResolvedValue({ error: { message: "no", code: "forbidden", status: 403 } });
    expect(await getMercadoLivrePackSummaryAction("entry-1")).toEqual({ error: "no", code: "forbidden", status: 403 });
  });
});
