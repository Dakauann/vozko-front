import { beforeEach, describe, expect, it, vi } from "vitest";

type ApiError = { status?: number; message: string; code?: string; expected?: Record<string, string> };

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

import { fetchPlaces } from "../places";

beforeEach(() => {
  api.calls = [];
  api.result = {};
});

describe("fetchPlaces", () => {
  it("reads the places of the request", async () => {
    api.result = {
      data: {
        items: [{ kind: "city", label: "Recife, PE", name: "Recife", city: "Recife", cityCode: "2611606", cityKey: "pe:recife", state: "PE", lat: -8.05, lng: -34.9, precision: "city", addressCount: 7 }],
        coveredStates: ["PE"],
        attribution: "IBGE, CNEFE 2022",
      },
    };
    const signal = new AbortController().signal;
    const result = await fetchPlaces({ kind: "city", text: "rec", state: "PE" }, signal);
    expect(result.error).toBeNull();
    expect(result.answer?.places[0]).toMatchObject({ city: "Recife", position: { lat: -8.05, lng: -34.9 } });
    expect(api.calls).toEqual([{ path: "/leads/places/suggest?kind=city&q=rec&state=PE", method: "GET", signal }]);
  });

  it("hands back the coded refusal with the loaded states", async () => {
    api.result = { error: { status: 422, code: "reference_not_loaded", message: "not loaded", expected: { coveredStates: "PE" } } };
    const result = await fetchPlaces({ kind: null, text: "sao", state: "SP" });
    expect(result).toEqual({ answer: null, error: { status: 422, code: "reference_not_loaded", message: "not loaded", expected: { coveredStates: "PE" } } });
  });

  it("never asks before the request is ready", async () => {
    await expect(fetchPlaces({ kind: "street", text: "rua" })).resolves.toMatchObject({ answer: null, error: { code: "place_query_invalid" } });
    expect(api.calls).toEqual([]);
  });

  it("refuses an answer outside the contract", async () => {
    api.result = { data: { items: [{ kind: "planet" }], coveredStates: [] } };
    await expect(fetchPlaces({ kind: "city", text: "rec" })).resolves.toMatchObject({ answer: null, error: { code: "place_answer_unreadable" } });
  });
});
