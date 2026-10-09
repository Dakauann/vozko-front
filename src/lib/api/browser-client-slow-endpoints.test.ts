import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stalledFetch(): (input: unknown, init?: RequestInit) => Promise<Response> {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      if (signal.aborted) reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      else signal.addEventListener("abort", () => reject(signal.reason ?? new DOMException("Aborted", "AbortError")));
    });
}

describe("apiClient timeouts per endpoint", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(stalledFetch()));
    vi.stubGlobal("navigator", {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("waits longer for an attendance section than for an ordinary call", async () => {
    const { apiClient } = await import("@/lib/api/browser-client");
    const promise = apiClient("/attendance/sections/summary", { method: "GET" });
    let settled = false;
    void promise.then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(29_000);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;
    expect(result.error?.code).toBe("timeout");
  });

  it("waits up to a minute for the Meta invoice check, which asks Meta per account", async () => {
    const { apiClient } = await import("@/lib/api/browser-client");
    const promise = apiClient("/admin/analytics/meta-invoice-check?startDate=x", { method: "GET" });
    let settled = false;
    void promise.then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(59_000);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;
    expect(result.error?.code).toBe("timeout");
  });

  it("waits up to two minutes while a send from leads is prepared, reviewed, started or cancelled", async () => {
    const { apiClient } = await import("@/lib/api/browser-client");
    for (const path of ["/leads/actions", "/leads/actions/sends/review", "/leads/actions/sends/start", "/leads/actions/sends/cancel"]) {
      const promise = apiClient(path, { method: "POST", body: "{}" });
      let settled = false;
      void promise.then(() => (settled = true));

      await vi.advanceTimersByTimeAsync(119_000);
      expect(settled, path).toBe(false);

      await vi.advanceTimersByTimeAsync(2_000);
      expect((await promise).error?.code).toBe("timeout");
    }
  });

  it("keeps the short timeout for the other lead action calls", async () => {
    const { apiClient } = await import("@/lib/api/browser-client");
    const promise = apiClient("/leads/actions/preview", { method: "POST", body: "{}" });

    await vi.advanceTimersByTimeAsync(11_000);
    expect((await promise).error?.code).toBe("timeout");
  });

  it("uses the short timeout for media generation, which is queued", async () => {
    const { apiClient } = await import("@/lib/api/browser-client");
    const promise = apiClient("/media/generations", { method: "POST", body: "{}" });

    await vi.advanceTimersByTimeAsync(11_000);
    const result = await promise;
    expect(result.error?.code).toBe("timeout");
  });

  it("keeps the short timeout for ordinary calls and marks it as a timeout", async () => {
    const { apiClient } = await import("@/lib/api/browser-client");
    const promise = apiClient("/ads/accounts", { method: "GET" });

    await vi.advanceTimersByTimeAsync(11_000);
    const result = await promise;
    expect(result.error?.code).toBe("timeout");
  });
});
