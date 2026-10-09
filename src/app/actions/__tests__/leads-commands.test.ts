import { beforeEach, describe, expect, it, vi } from "vitest";

type ApiError = { status?: number; message: string; code?: string };

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method?: string; body: unknown; signal?: AbortSignal }>,
  result: {} as { data?: unknown; error?: ApiError },
}));

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: async (path: string, init: { method?: string; body?: string; signal?: AbortSignal }) => {
    api.calls.push({ path, method: init.method, body: init.body ? JSON.parse(init.body) : undefined, signal: init.signal });
    return api.result;
  },
}));

import {
  acceptLeadLocationAction,
  anonymizeLeadAction,
  findLeadByNumberAction,
  findLeadsByNameAction,
  getEntryLeadCardAction,
  getLeadSummaryAction,
  optOutLeadAction,
  pinLeadAddressAction,
  setLeadDistrictAction,
  setLeadOwnerAction,
} from "../leads";

const stored = {
  id: "lead-1",
  workspaceId: "ws-1",
  number: "5511999990000",
  blocked: false,
  relativesCount: 0,
  referredCount: 0,
  version: 6,
};

beforeEach(() => {
  api.calls = [];
  api.result = { data: stored };
});

describe("lead lookups for the family picker", () => {
  it("asks the number route, which also matches the other ninth digit format", async () => {
    const result = await findLeadByNumberAction("11987654321");
    expect(api.calls[0]).toMatchObject({ path: "/leads/search?number=11987654321", method: "GET" });
    expect(result).toEqual({ matches: [{ id: "lead-1", realName: undefined, number: "5511999990000" }], error: null });
  });

  it("answers no match, not a failure, when nobody holds the number", async () => {
    api.result = { error: { status: 404, message: "Lead not found", code: "lead_not_found" } };
    expect(await findLeadByNumberAction("11987654321")).toEqual({ matches: [], error: null });
    api.result = { error: { status: 400, message: "Invalid phone number format" } };
    expect(await findLeadByNumberAction("11987654")).toEqual({ matches: [], error: null });
  });

  it("reports any other refusal as a failure", async () => {
    api.result = { error: { status: 503, message: "busy" } };
    const result = await findLeadByNumberAction("11987654321");
    expect(result.matches).toEqual([]);
    expect(result.error).toMatchObject({ status: 503 });
  });

  it("looks names up through the name filter alone, a few rows at a time", async () => {
    api.result = { data: { data: [{ ...stored, realName: "Ana" }], meta: {} } };
    const result = await findLeadsByNameAction("Ana");
    const url = new URL(api.calls[0].path, "http://x");
    expect(url.pathname).toBe("/leads");
    expect(url.searchParams.get("q")).toBeNull();
    expect(url.searchParams.get("pageSize")).toBe("5");
    expect(url.searchParams.get("filter")).toBeTruthy();
    expect(result).toEqual({ matches: [{ id: "lead-1", realName: "Ana", number: "5511999990000" }], error: null });
  });
});

describe("lead field commands", () => {
  it("records who decided the opt-out", async () => {
    const result = await optOutLeadAction("lead-1", "lead_request");
    await optOutLeadAction("lead-1", "operator");
    expect(api.calls[0]).toEqual({ path: "/leads/lead-1/opt-out", method: "POST", body: { source: "lead_request" }, signal: undefined });
    expect(api.calls[1].body).toEqual({ source: "operator" });
    expect(result.lead?.version).toBe(6);
  });

  it("sends bairro, city and state together and the city code only when known", async () => {
    await setLeadDistrictAction("lead-1", { district: "", city: "Barueri", state: "SP" });
    await setLeadDistrictAction("lead-1", { district: "Centro", city: "Barueri", state: "SP", cityCode: "3505708" });
    expect(api.calls[0]).toMatchObject({ path: "/leads/lead-1/district", method: "POST", body: { district: "", city: "Barueri", state: "SP" } });
    expect(api.calls[1].body).toEqual({ district: "Centro", city: "Barueri", state: "SP", cityCode: "3505708" });
  });

  it("pins an address with the latitude and longitude the strict pin body requires", async () => {
    const result = await pinLeadAddressAction("lead-1", "addr-1", { lat: -23.55, lng: -46.63 });
    expect(api.calls[0]).toEqual({ path: "/leads/lead-1/addresses/addr-1/pin", method: "POST", body: { latitude: -23.55, longitude: -46.63 }, signal: undefined });
    expect(result.lead?.version).toBe(6);
  });

  it("accepts a location message without a body, on the message path", async () => {
    const result = await acceptLeadLocationAction("lead-1", "msg/1");
    expect(api.calls[0]).toEqual({ path: "/leads/lead-1/location-candidates/msg%2F1/accept", method: "POST", body: undefined, signal: undefined });
    expect(result.lead?.version).toBe(6);
  });

  it("returns the coded refusal of an accept", async () => {
    api.result = { error: { status: 404, code: "lead_location_not_found", message: "x" } };
    const result = await acceptLeadLocationAction("lead-1", "msg-1");
    expect(result).toEqual({ lead: null, error: { status: 404, code: "lead_location_not_found", message: "x" } });
  });

  it("keeps the owner command on the same path", async () => {
    await setLeadOwnerAction("lead-1", "u-2");
    expect(api.calls[0]).toMatchObject({ path: "/leads/lead-1/owner", method: "POST", body: { ownerId: "u-2" } });
  });

  it("refuses an answer that is not a lead record", async () => {
    api.result = { data: { ok: true } };
    const result = await optOutLeadAction("lead-1", "operator");
    expect(result.lead).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it("returns the coded refusal of a command", async () => {
    api.result = { error: { status: 400, code: "lead_address_invalid", message: "pq: bad" } };
    const result = await setLeadDistrictAction("lead-1", { district: "Centro", city: "", state: "" });
    expect(result.error).toEqual({ status: 400, code: "lead_address_invalid", message: "pq: bad" });
  });
});

describe("anonymizeLeadAction", () => {
  it("posts the erasure and returns what was erased", async () => {
    api.result = { data: { leadId: "lead-1", version: 7, anonymizedAt: "2026-10-08T12:00:00Z", erased: { lead_phones: 2 } } };
    const result = await anonymizeLeadAction("lead-1");
    expect(api.calls[0]).toMatchObject({ path: "/leads/lead-1/anonymize", method: "POST" });
    expect(result.outcome?.erased.lead_phones).toBe(2);
  });

  it("does not report an erasure the server did not confirm", async () => {
    api.result = { data: { leadId: "lead-1" } };
    const result = await anonymizeLeadAction("lead-1");
    expect(result.outcome).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

describe("getEntryLeadCardAction", () => {
  it("reads the lead card through the conversation", async () => {
    const signal = new AbortController().signal;
    api.result = { data: { leadId: "lead-1", version: 3, blocked: false, relativesCount: 2, referredCount: 0 } };
    const result = await getEntryLeadCardAction("e/1", "instagram", signal);
    expect(api.calls[0]).toMatchObject({ path: "/entries/e%2F1/lead?entryType=instagram", method: "GET", signal });
    expect(result.card?.relativesCount).toBe(2);
  });

  it("refuses an empty card", async () => {
    api.result = { data: undefined };
    const result = await getEntryLeadCardAction("e-1", "whatsapp");
    expect(result.card).toBeNull();
  });
});

describe("getLeadSummaryAction", () => {
  it("reads the tab counts and the shared numbers from the summary section", async () => {
    const signal = new AbortController().signal;
    api.result = { data: { dealsCount: 1, memoriesCount: 4, sharedNumbers: [] } };
    const result = await getLeadSummaryAction("lead/1", signal);
    expect(api.calls[0]).toMatchObject({ path: "/leads/lead%2F1/summary", method: "GET", signal });
    expect(result).toEqual({ summary: { dealsCount: 1, memoriesCount: 4, sharedNumbers: [] }, error: null });
  });

  it("passes the server's refusal on", async () => {
    api.result = { error: { status: 403, message: "forbidden", code: "forbidden" } };
    const result = await getLeadSummaryAction("lead-1");
    expect(result.summary).toBeNull();
    expect(result.error).toMatchObject({ status: 403, code: "forbidden" });
  });

  it("refuses a malformed summary", async () => {
    api.result = { data: { dealsCount: 1 } };
    const result = await getLeadSummaryAction("lead-1");
    expect(result.summary).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
