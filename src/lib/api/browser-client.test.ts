/**
 * @vitest-environment happy-dom
 *
 * Contract for the single browser -> API client: cookie-only auth (no Authorization
 * header), refresh exactly once on 401 then retry (a direct POST /auth/refresh),
 * single-flight refresh across concurrent callers, one session-expired signal on
 * unrecoverable expiry, and no logout on transient 5xx.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient, onSessionExpired } from "@/lib/api/browser-client";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    json: async () => body,
  } as unknown as Response;
}

const isRefresh = (url: unknown) => String(url).includes("/auth/refresh");

describe("apiClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let refreshCalls: number;

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "workspaceId=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "departmentId=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    refreshCalls = 0;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends credentials and no Authorization header, returns data on success", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await apiClient<{ ok: boolean }>("/thing");

    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.credentials).toBe("include");
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("attaches workspace/department scope headers from cookies", async () => {
    document.cookie = "workspaceId=ws-1";
    document.cookie = "departmentId=dept-9";
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await apiClient("/thing");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-Workspace-ID"]).toBe("ws-1");
    expect(init.headers["X-Department-ID"]).toBe("dept-9");
  });

  it("on 401: refreshes once via POST /auth/refresh, then retries and succeeds", async () => {
    let dataCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (isRefresh(url)) {
        refreshCalls += 1;
        return jsonResponse(200, {});
      }
      dataCalls += 1;
      return dataCalls === 1
        ? jsonResponse(401, { message: "expired" })
        : jsonResponse(200, { ok: true });
    });

    const result = await apiClient<{ ok: boolean }>("/thing");

    expect(refreshCalls).toBe(1);
    expect(dataCalls).toBe(2);
    expect(result.data).toEqual({ ok: true });
  });

  it("on 401 with failed refresh: emits session-expired once and returns 401", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (isRefresh(url)) {
        refreshCalls += 1;
        return jsonResponse(401, {});
      }
      return jsonResponse(401, { message: "expired" });
    });

    const expiredHandler = vi.fn();
    const unsub = onSessionExpired(expiredHandler);

    const result = await apiClient("/thing");
    unsub();

    expect(refreshCalls).toBe(1);
    expect(result.error?.status).toBe(401);
    expect(expiredHandler).toHaveBeenCalledTimes(1);
  });

  it("concurrent 401s share a single refresh (single-flight)", async () => {
    const dataCallsByUrl: Record<string, number> = {};
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (isRefresh(u)) {
        refreshCalls += 1;
        return jsonResponse(200, {});
      }
      dataCallsByUrl[u] = (dataCallsByUrl[u] ?? 0) + 1;
      return dataCallsByUrl[u] === 1
        ? jsonResponse(401, { message: "expired" })
        : jsonResponse(200, { ok: true });
    });

    const [a, b] = await Promise.all([apiClient("/a"), apiClient("/b")]);

    expect(refreshCalls).toBe(1);
    expect(a.data).toEqual({ ok: true });
    expect(b.data).toEqual({ ok: true });
  });

  it("does not refresh or log out on a transient 5xx", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (isRefresh(url)) {
        refreshCalls += 1;
        return jsonResponse(200, {});
      }
      return jsonResponse(503, { message: "unavailable" });
    });

    const result = await apiClient("/thing");

    expect(refreshCalls).toBe(0);
    expect(result.error?.status).toBe(503);
  });

  it("does not refresh on 403 (authorization, not authentication)", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (isRefresh(url)) {
        refreshCalls += 1;
        return jsonResponse(200, {});
      }
      return jsonResponse(403, { message: "forbidden" });
    });

    const result = await apiClient("/thing");

    expect(refreshCalls).toBe(0);
    expect(result.error?.status).toBe(403);
  });
});
