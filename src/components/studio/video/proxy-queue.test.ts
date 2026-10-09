import { describe, expect, it, vi } from "vitest";

import type { MediaGenerationJob } from "@/lib/media-generation/types";

import { BUSY_RETRY_MS, ProxyQueue, type ProxyDeps } from "./proxy-queue";

function job(id: string, status: MediaGenerationJob["status"], mediaId?: string): MediaGenerationJob {
  return { id, kind: "proxy", status, referenceMediaIds: [], createdAt: "", updatedAt: "", ...(mediaId ? { mediaId, mediaUrl: `https://cdn/${mediaId}.mp4` } : {}) };
}

function deps(overrides: Partial<ProxyDeps> = {}): ProxyDeps & { ready: [string, string][]; waits: number[] } {
  const ready: [string, string][] = [];
  const waits: number[] = [];
  return {
    request: vi.fn(async (input) => ({ data: job(`job-${(input as { sourceMediaId: string }).sourceMediaId}`, "done", `proxy-${(input as { sourceMediaId: string }).sourceMediaId}`) })),
    get: vi.fn(async (id) => ({ data: job(id, "done", "late") })),
    wait: vi.fn(async (ms: number) => void waits.push(ms)),
    onReady: (assetId, mediaId) => void ready.push([assetId, mediaId]),
    ready,
    waits,
    ...overrides,
  };
}

async function settle(queue: ProxyQueue) {
  await queue.idle();
}

describe("editing proxies", () => {
  it("asks once per video and hands over a proxy that is already done", async () => {
    const d = deps();
    const queue = new ProxyQueue(d);
    queue.want(["a", "b"]);
    queue.want(["a"]);
    await settle(queue);
    expect(d.request).toHaveBeenCalledTimes(2);
    expect(d.ready).toEqual([
      ["a", "proxy-a"],
      ["b", "proxy-b"],
    ]);
  });

  it("follows a proxy still being made until it is ready", async () => {
    const d = deps({
      request: vi.fn(async () => ({ data: job("j1", "queued") })),
      get: vi.fn().mockResolvedValueOnce({ data: job("j1", "running") }).mockResolvedValueOnce({ data: job("j1", "done", "proxy-a") }),
    });
    const queue = new ProxyQueue(d);
    queue.want(["a"]);
    await settle(queue);
    expect(d.ready).toEqual([["a", "proxy-a"]]);
    expect(d.get).toHaveBeenCalledTimes(2);
  });

  it("waits and tries again while the workspace is busy processing", async () => {
    const d = deps({
      request: vi.fn().mockResolvedValueOnce({ error: "busy", status: 429, code: "too_many_jobs" }).mockResolvedValueOnce({ data: job("j1", "done", "proxy-a") }),
    });
    const queue = new ProxyQueue(d);
    queue.want(["a"]);
    await settle(queue);
    expect(d.waits).toContain(BUSY_RETRY_MS);
    expect(d.ready).toEqual([["a", "proxy-a"]]);
  });

  it("keeps the original when the proxy fails, and stops after dispose", async () => {
    const failing = deps({ request: vi.fn(async () => ({ data: job("j1", "failed") })) });
    const queue = new ProxyQueue(failing);
    queue.want(["a"]);
    await settle(queue);
    expect(failing.ready).toEqual([]);
    const later = deps();
    const disposed = new ProxyQueue(later);
    disposed.dispose();
    disposed.want(["b"]);
    await settle(disposed);
    expect(later.request).not.toHaveBeenCalled();
  });
});
