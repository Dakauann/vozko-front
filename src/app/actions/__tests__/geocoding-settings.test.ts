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

import { getGeocodingSettingsAction, updateGeocodingSettingsAction } from "../geocoding-settings";

const answer = {
  provider: "",
  enabled: false,
  monthlyCeiling: 0,
  dailyShare: 0,
  usedThisCycle: 0,
  usedToday: 0,
  exhausted: "",
  availableProviders: ["opencage"],
  attribution: "IBGE, CNEFE 2022",
  canChangeProvider: true,
  canChangeCeiling: false,
  providerPause: null,
};

beforeEach(() => {
  api.calls = [];
  api.result = { data: answer };
});

describe("getGeocodingSettingsAction", () => {
  it("reads the workspace's geocoding settings", async () => {
    const signal = new AbortController().signal;
    const result = await getGeocodingSettingsAction("ws 1", signal);
    expect(api.calls[0]).toEqual({ path: "/workspaces/ws%201/geocoding", method: "GET", body: undefined, signal });
    expect(result.error).toBeNull();
    expect(result.settings?.availableProviders).toEqual(["opencage"]);
  });

  it("returns the coded refusal", async () => {
    api.result = { error: { status: 500, code: "geocoding_settings_unreadable", message: "x" } };
    expect(await getGeocodingSettingsAction("ws-1")).toEqual({
      settings: null,
      error: { status: 500, code: "geocoding_settings_unreadable", message: "x" },
    });
  });

  it("never reads a malformed answer as a workspace with no usage", async () => {
    api.result = { data: { provider: "", enabled: false } };
    const result = await getGeocodingSettingsAction("ws-1");
    expect(result.settings).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

describe("updateGeocodingSettingsAction", () => {
  it("puts only the changed setting", async () => {
    await updateGeocodingSettingsAction("ws-1", { provider: "opencage" });
    await updateGeocodingSettingsAction("ws-1", { monthlyCeiling: 8000 });
    expect(api.calls[0]).toMatchObject({ path: "/workspaces/ws-1/geocoding", method: "PUT", body: { provider: "opencage" } });
    expect(api.calls[1].body).toEqual({ monthlyCeiling: 8000 });
  });

  it("returns the settings the server stored", async () => {
    api.result = { data: { ...answer, provider: "opencage", enabled: true, monthlyCeiling: 5000 } };
    const result = await updateGeocodingSettingsAction("ws-1", { provider: "opencage" });
    expect(result).toEqual({ settings: expect.objectContaining({ provider: "opencage", enabled: true }), error: null });
  });

  it("returns the coded refusal", async () => {
    api.result = { error: { status: 409, code: "geocoding_provider_not_configured", message: "x" } };
    const result = await updateGeocodingSettingsAction("ws-1", { provider: "opencage" });
    expect(result).toEqual({ settings: null, error: { status: 409, code: "geocoding_provider_not_configured", message: "x" } });
  });
});
