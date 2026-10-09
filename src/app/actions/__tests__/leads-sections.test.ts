import { beforeEach, describe, expect, it, vi } from "vitest";

type ApiError = { status?: number; message: string; code?: string };

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; signal?: AbortSignal }>,
  result: {} as { data?: unknown; error?: ApiError },
}));

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: async (path: string, init: { signal?: AbortSignal }) => {
    api.calls.push({ path, signal: init.signal });
    return api.result;
  },
}));

import { fetchLeadSection, listLeadsQueryAction } from "../leads";
import { isBusySectionError } from "@/lib/analytics/section-query";
import { LEAD_FILTER_FIELD, emptyLeadFilter, toggleInSet } from "@/lib/leads/filters";

beforeEach(() => {
  api.calls = [];
  api.result = {};
});

describe("fetchLeadSection", () => {
  it("reads the bare section from its own route", async () => {
    const summary = { total: 3 };
    api.result = { data: summary };
    const signal = new AbortController().signal;
    const filter = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");

    await expect(fetchLeadSection("summary", { filter, q: "ana" }, signal)).resolves.toBe(summary);
    expect(api.calls[0].path.startsWith("/leads/sections/summary?")).toBe(true);
    expect(api.calls[0].signal).toBe(signal);
  });

  it("throws a section error that keeps the status, so a busy section is retried", async () => {
    api.result = { error: { status: 503, message: "busy" } };
    const failure = await fetchLeadSection("facets", { filter: emptyLeadFilter }).catch((error: unknown) => error);
    expect(isBusySectionError(failure)).toBe(true);
  });

  it("never reads an empty answer as zeros", async () => {
    api.result = {};
    await expect(fetchLeadSection("places", { filter: emptyLeadFilter })).rejects.toThrow();
  });
});

describe("listLeadsQueryAction", () => {
  it("passes the refusal code along with the message", async () => {
    api.result = { error: { status: 403, message: "proibido", code: "lead_filter_address_forbidden" } };
    const result = await listLeadsQueryAction({ filter: emptyLeadFilter });
    expect(result.error).toBe("proibido");
    expect(result.errorCode).toBe("lead_filter_address_forbidden");
  });

  it("has no code when the list loads", async () => {
    api.result = { data: { data: [], meta: { page: 1, pageSize: 20, totalPages: 1, totalItems: 0 } } };
    const result = await listLeadsQueryAction({ filter: emptyLeadFilter });
    expect(result.errorCode).toBeNull();
  });
});
