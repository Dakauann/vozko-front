import { beforeEach, describe, expect, it, vi } from "vitest";

type ApiError = { status?: number; message: string; code?: string };
type Call = { path: string; method?: string; headers: Record<string, string>; body: unknown };

const api = vi.hoisted(() => ({
  calls: [] as Call[],
  results: [] as Array<{ data?: unknown; error?: ApiError }>,
}));

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: async (path: string, init: { method?: string; headers?: Record<string, string>; body?: string }) => {
    api.calls.push({ path, method: init.method, headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : undefined });
    return api.results.shift() ?? { data: undefined };
  },
}));

import {
  getAudienceExitsAction,
  getButtonActionKindsAction,
  getDraftExitVerdictAction,
  getCampaignButtonRoutesAction,
  getTemplateButtonActionsAction,
  getTemplateExitVerdictAction,
  saveCampaignButtonRoutesAction,
  saveTemplateButtonActionsAction,
} from "../template-exit";

const ACTIONS = {
  templateId: "tpl-1",
  template: { name: "aviso", language: "pt_BR" },
  version: 4,
  buttons: [],
  actions: [],
  exitConfirmation: "",
};

const CHANGE = { actions: [{ buttonIndex: 1, buttonText: "SAIR", kind: "opt_out" as const, params: {}, confirmation: "" }], exitConfirmation: "" };

beforeEach(() => {
  api.calls = [];
  api.results = [];
});

describe("template button actions", () => {
  it("reads the template actions", async () => {
    api.results.push({ data: ACTIONS });
    expect(await getTemplateButtonActionsAction("tpl-1")).toEqual({ data: ACTIONS });
    expect(api.calls[0]).toMatchObject({ path: "/whatsapp/templates/tpl-1/button-actions", method: "GET" });
  });

  it("saves from the version the screen showed and never touches the template itself", async () => {
    api.results.push({ data: { ...ACTIONS, version: 5 } });
    const result = await saveTemplateButtonActionsAction("tpl-1", 4, CHANGE);
    expect(api.calls[0]).toMatchObject({
      path: "/whatsapp/templates/tpl-1/button-actions",
      method: "PUT",
      headers: { "If-Match": "4" },
      body: CHANGE,
    });
    expect(result).toEqual({ status: "saved", actions: { ...ACTIONS, version: 5 } });
  });

  it("answers the current actions when someone saved first", async () => {
    api.results.push({ error: { status: 409, code: "version_conflict", message: "changed" } }, { data: ACTIONS });
    expect(await saveTemplateButtonActionsAction("tpl-1", 3, CHANGE)).toEqual({ status: "conflict", current: ACTIONS });
  });

  it("keeps the coded refusal so the screen can explain it", async () => {
    api.results.push({ error: { status: 403, code: "button_action_forbidden", message: "forbidden" } });
    expect(await saveTemplateButtonActionsAction("tpl-1", 4, CHANGE)).toEqual({
      status: "failed",
      error: { error: "forbidden", code: "button_action_forbidden", status: 403, expected: undefined },
    });
  });
});

describe("exit verdict", () => {
  it("asks for the template verdict, with the campaign when there is one", async () => {
    api.results.push({ data: { state: "none", buttons: [], exitWords: [] } }, { data: { state: "ok" } });
    await getTemplateExitVerdictAction("tpl-1");
    await getTemplateExitVerdictAction("tpl-1", "camp 1");
    expect(api.calls.map((call) => call.path)).toEqual([
      "/whatsapp/templates/tpl-1/exit-verdict",
      "/whatsapp/templates/tpl-1/exit-verdict?campaignId=camp+1",
    ]);
  });
});

describe("campaign button routes", () => {
  it("reads and saves the routes of a campaign", async () => {
    api.results.push({ data: { campaignId: "c-1", version: 2 } }, { data: { campaignId: "c-1", version: 3 } });
    await getCampaignButtonRoutesAction("c-1");
    const routes = [{ buttonIndex: 0, buttonText: "Falar com atendente", kind: "hand_off" as const, params: { departmentId: "d-1" }, confirmation: "" }];
    const saved = await saveCampaignButtonRoutesAction("c-1", 2, routes);
    expect(api.calls[1]).toMatchObject({
      path: "/whatsapp/campaigns/c-1/button-routes",
      method: "PUT",
      headers: { "If-Match": "2" },
      body: { routes },
    });
    expect(saved).toEqual({ status: "saved", routes: { campaignId: "c-1", version: 3 } });
  });
});

describe("draft exit verdict", () => {
  it("asks the server to judge the draft and stores nothing", async () => {
    const verdict = { verdict: { state: "none", buttons: [], exitWords: [], templateExitRequired: true, campaignAcknowledgementRequired: true } };
    api.results.push({ data: verdict });
    const draft = { category: "MARKETING", header: "", body: "Ofertas", footer: "Responda /sair", buttons: [{ type: "QUICK_REPLY", text: "Ver" }], buttonActions: [] };
    expect(await getDraftExitVerdictAction(draft)).toEqual({ data: verdict });
    expect(api.calls[0]).toMatchObject({ path: "/whatsapp/templates/exit-verdict", method: "POST", body: draft });
  });
});

describe("button action kinds", () => {
  it("reads the kinds this viewer may set without any draft", async () => {
    api.results.push({ data: { allowedKinds: ["opt_out", "classify"] } });
    expect(await getButtonActionKindsAction()).toEqual({ data: { allowedKinds: ["opt_out", "classify"] } });
    expect(api.calls[0]).toMatchObject({ path: "/whatsapp/button-action-kinds", method: "GET" });
  });
});

describe("audience exits", () => {
  it("counts who of the list does not receive", async () => {
    api.results.push({ data: { optedOut: 30, blocked: 7, notReceiving: 37 } });
    expect(await getAudienceExitsAction(["5511987650001"])).toEqual({ data: { optedOut: 30, blocked: 7, notReceiving: 37 } });
    expect(api.calls[0]).toMatchObject({ path: "/whatsapp/campaigns/exit-audience", method: "POST", body: { numbers: ["5511987650001"] } });
  });

  it("keeps the coded refusal", async () => {
    api.results.push({ error: { status: 413, message: "too many", code: "campaign_exit_too_many_numbers" } });
    const result = await getAudienceExitsAction(["1"]);
    expect(result).toMatchObject({ code: "campaign_exit_too_many_numbers" });
  });
});
