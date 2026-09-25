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

describe("apiClient with a caller signal", () => {
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

  it("aborts when the caller aborts", async () => {
    const { apiClient } = await import("@/lib/api/browser-client");
    const controller = new AbortController();
    const promise = apiClient("/attendance/overview/summary", { signal: controller.signal });

    controller.abort();
    const result = await promise;
    expect(result.error).toBeTruthy();
  });

  it("keeps its own timeout when the caller passes a signal that never fires", async () => {
    const { apiClient } = await import("@/lib/api/browser-client");
    const controller = new AbortController();
    const promise = apiClient("/attendance/overview/summary", { signal: controller.signal });
    let settled = false;
    void promise.then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(29_000);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;
    expect(result.error).toBeTruthy();
  });
});
