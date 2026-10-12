import { describe, expect, it } from "vitest";

import type { QueuedMessage } from "./queue";
import { createTurnStore, IDLE_TURN } from "./turn-store";

const waiting: QueuedMessage = { clientId: "c1", content: "e o azul?", createdAt: "2026-10-10T12:00:00Z" };

describe("the queue in the turn store", () => {
  it("starts empty and keeps each thread's queue apart", () => {
    const store = createTurnStore();
    expect(IDLE_TURN.queued).toEqual([]);
    store.queue("th1", (q) => [...q, waiting]);
    expect(store.snapshot("th1").queued).toEqual([waiting]);
    expect(store.snapshot("th2").queued).toEqual([]);
  });

  it("keeps the queue while the answer streams and after it ends", () => {
    const store = createTurnStore();
    store.begin("th1");
    store.queue("th1", (q) => [...q, waiting]);
    store.end("th1");
    expect(store.snapshot("th1").queued).toEqual([waiting]);
  });

  it("resolves once the thread stops streaming", async () => {
    const store = createTurnStore();
    await expect(store.whenIdle("th1")).resolves.toBeUndefined();
    store.begin("th1");
    let idle = false;
    const done = store.whenIdle("th1").then(() => {
      idle = true;
    });
    await Promise.resolve();
    expect(idle).toBe(false);
    store.end("th1");
    await done;
    expect(idle).toBe(true);
  });
});
