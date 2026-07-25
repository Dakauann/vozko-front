/**
 * @vitest-environment happy-dom
 *
 * Validates the fix for the production "stuck loading / login never appears" bug
 * (introduced 2026-07-16 when auth moved to browser-direct with no request
 * timeout). A stalled auth fetch used to pin AuthProvider.isLoading=true forever
 * — the navbar pill and dashboard full-screen loader never resolved, and the
 * cross-tab Web Lock wedged sibling tabs.
 *
 * The fix bounds every auth fetch with an AbortSignal timeout (AUTH_TIMEOUT_MS).
 * These tests prove a stalled request now settles quickly (as an error) instead
 * of hanging, and that the refresh — which holds the Web Lock — is also bounded.
 *
 * The mock fetch RESPECTS the abort signal, i.e. it rejects when aborted, exactly
 * like a real fetch. Fake timers drive the timeout deterministically.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    json: async () => body,
  } as unknown as Response;
}

/** A stalled origin: never responds on its own, but honours AbortSignal. */
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
    vi.stubGlobal("navigator", {}); // isolate the fetch-timeout path from Web Locks
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

    // Before the timeout it must still be pending...
    await vi.advanceTimersByTimeAsync(9_000);
    expect(settled).toBe(false);

    // ...and after the timeout it resolves (to an error), never hangs.
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;
    expect(result.error).toBeTruthy();
  });

  it("a stalled POST /auth/refresh (holds the Web Lock) is bounded and reports 401, not a hang", async () => {
    // /user/me returns 401 -> triggers refresh; the refresh fetch stalls.
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
    expect(result.error?.status).toBe(401); // refresh gave up -> session expired, surfaced cleanly
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
    // A locks.request that NEVER grants — simulates a sibling tab holding the lock
    // while frozen. It must honour the acquisition AbortSignal we now pass.
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
    // The fallback direct performRefresh succeeds.
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    const { refreshSession } = await import("@/lib/api/browser-client");
    const promise = refreshSession();
    let value: boolean | undefined;
    void promise.then((v) => (value = v));

    // Still blocked on acquisition before the deadline...
    await vi.advanceTimersByTimeAsync(9_000);
    expect(value).toBeUndefined();

    // ...acquisition times out -> direct refresh -> resolves true (never hangs).
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(promise).resolves.toBe(true);
    expect(neverGrant).toHaveBeenCalled();
  });
});
