
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    json: async () => body,
  } as unknown as Response;
}

function stalledFetch(): (input: unknown, init?: RequestInit) => Promise<Response> {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal) {
        if (signal.aborted) reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
        else
          signal.addEventListener("abort", () =>
            reject(signal.reason ?? new DOMException("Aborted", "AbortError")),
          );
      }
    });
}

describe("auth fetch timeout (fix for the stuck-loading hang)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    fetchMock = vi.fn(stalledFetch());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a stalled GET /user/me settles as an error instead of hanging forever", async () => {
    const { apiClient } = await import("@/lib/api/browser-client");

    const promise = apiClient("/user/me");
    let settled = false;
    void promise.then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(9_000);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;
    expect(result.error).toBeTruthy();
  });

  it("a stalled POST /auth/refresh (holds the Web Lock) is bounded and reports 401, not a hang", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/refresh")) return stalledFetch()(url, init);
      return Promise.resolve(jsonResponse(401, { message: "expired" }));
    });
    const { apiClient } = await import("@/lib/api/browser-client");

    const promise = apiClient("/user/me");
    let settled = false;
    void promise.then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(9_000);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;
    expect(result.error?.status).toBe(401);
  });

  it("refreshSession resolves false (not a hang) when the refresh stalls", async () => {
    const { refreshSession } = await import("@/lib/api/browser-client");

    const promise = refreshSession();
    let value: boolean | undefined;
    void promise.then((v) => (value = v));

    await vi.advanceTimersByTimeAsync(9_000);
    expect(value).toBeUndefined();

    await vi.advanceTimersByTimeAsync(2_000);
    await expect(promise).resolves.toBe(false);
  });

  it("a wedged Web Lock (frozen sibling holds it) is bounded and falls back to a direct refresh, not a hang", async () => {
    const neverGrant = vi.fn(
      (_name: string, opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const signal = opts?.signal;
          signal?.addEventListener("abort", () =>
            reject(signal.reason ?? new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("navigator", { locks: { request: neverGrant } });
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    const { refreshSession } = await import("@/lib/api/browser-client");
    const promise = refreshSession();
    let value: boolean | undefined;
    void promise.then((v) => (value = v));

    await vi.advanceTimersByTimeAsync(9_000);
    expect(value).toBeUndefined();

    await vi.advanceTimersByTimeAsync(2_000);
    await expect(promise).resolves.toBe(true);
    expect(neverGrant).toHaveBeenCalled();
  });
});
