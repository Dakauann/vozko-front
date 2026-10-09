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

import { adminListGeocodingCoverageAction } from "../geocoding-platform";

const answer = { items: [], page: 2, pageSize: 20, totalItems: 21, totalPages: 2 };

beforeEach(() => {
  api.calls = [];
  api.result = { data: answer };
});

describe("adminListGeocodingCoverageAction", () => {
  it("asks for one page of workspaces, with the search", async () => {
    const result = await adminListGeocodingCoverageAction({ page: 2, pageSize: 20, search: " escola 50% " });
    expect(api.calls).toEqual([{ path: "/admin/geocoding/workspaces?page=2&pageSize=20&search=escola+50%25", method: "GET", signal: undefined }]);
    expect(result).toEqual({ page: answer, error: null });
  });

  it("leaves the search out when it is blank", async () => {
    await adminListGeocodingCoverageAction({ page: 1, pageSize: 20, search: "  " });
    expect(api.calls[0].path).toBe("/admin/geocoding/workspaces?page=1&pageSize=20");
  });

  it("returns the refusal with its status and code", async () => {
    api.result = { error: { status: 503, message: "busy", code: "geocoding_unavailable" } };
    const result = await adminListGeocodingCoverageAction({ page: 1, pageSize: 20, search: "" });
    expect(result).toEqual({ page: null, error: { status: 503, message: "busy", code: "geocoding_unavailable" } });
  });

  it("refuses a malformed answer instead of showing an empty page", async () => {
    api.result = { data: { items: [] } };
    const result = await adminListGeocodingCoverageAction({ page: 1, pageSize: 20, search: "" });
    expect(result.page).toBeNull();
    expect(result.error).toEqual({ message: "Malformed geocoding coverage" });
  });
});
