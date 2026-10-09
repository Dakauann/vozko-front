import { beforeEach, describe, expect, it, vi } from "vitest";

type ApiError = { status?: number; message: string; code?: string };

const api = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; method?: string; signal?: AbortSignal }>,
  result: {} as { data?: unknown; error?: ApiError },
}));

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: async (path: string, init: { method?: string; signal?: AbortSignal }) => {
    api.calls.push({ path, method: init.method, signal: init.signal });
    return api.result;
  },
}));

import { fetchReferencePoint } from "../lead-map";

beforeEach(() => {
  api.calls = [];
  api.result = {};
});

describe("fetchReferencePoint", () => {
  it("reads the reference point of the query", async () => {
    api.result = { data: { lat: -23.5614, lng: -46.6559, precision: "street", attribution: "IBGE, CNEFE 2022" } };
    const signal = new AbortController().signal;

    await expect(fetchReferencePoint({ zipCode: "01310100" }, signal)).resolves.toEqual({
      point: { position: { lat: -23.5614, lng: -46.6559 }, precision: "street", attribution: "IBGE, CNEFE 2022" },
      error: null,
    });
    expect(api.calls).toEqual([{ path: "/leads/map/reference-point?zipCode=01310100", method: "GET", signal }]);
  });

  it("hands back the coded refusal", async () => {
    api.result = { error: { status: 422, code: "reference_not_loaded", message: "not loaded" } };

    await expect(fetchReferencePoint({ zipCode: "01310100" })).resolves.toEqual({
      point: null,
      error: { status: 422, code: "reference_not_loaded", message: "not loaded" },
    });
  });

  it("refuses an answer outside the contract instead of drawing it", async () => {
    api.result = { data: { lat: 0, lng: 0, precision: "roof", attribution: "x" } };

    const outcome = await fetchReferencePoint({ zipCode: "01310100" });
    expect(outcome.point).toBeNull();
    expect(outcome.error?.code).toBeUndefined();
  });

  it("never calls the server without a query", async () => {
    const outcome = await fetchReferencePoint({ zipCode: " ", city: "" });
    expect(outcome.point).toBeNull();
    expect(api.calls).toEqual([]);
  });
});
