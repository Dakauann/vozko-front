import { afterEach, describe, expect, it, vi } from "vitest";

import { chatStreams, dispatchStreamEvent, readChatStream } from "./chat-stream";

function sse(events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

function streamed(body: string): Response {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("queue events on the answer stream", () => {
  it("hands a queued, a removed and a delivered message to their handlers", () => {
    const onQueued = vi.fn();
    const onUnqueued = vi.fn();
    const onDelivered = vi.fn();
    const handlers = { onQueued, onUnqueued, onDelivered };
    dispatchStreamEvent({ type: "queued", payload: { clientId: "c1", content: "e o azul?", createdAt: "2026-10-10T12:00:00Z" } }, handlers);
    dispatchStreamEvent({ type: "unqueued", payload: { clientId: "c1" } }, handlers);
    dispatchStreamEvent({ type: "delivered", payload: { messages: [{ id: "m1", clientId: "c2", content: "ok", createdAt: "2026-10-10T12:00:01Z" }] } }, handlers);
    expect(onQueued).toHaveBeenCalledWith({ clientId: "c1", content: "e o azul?", createdAt: "2026-10-10T12:00:00Z" });
    expect(onUnqueued).toHaveBeenCalledWith("c1");
    expect(onDelivered).toHaveBeenCalledWith([{ id: "m1", clientId: "c2", content: "ok", createdAt: "2026-10-10T12:00:01Z" }]);
  });

  it("ignores queue events it cannot read", () => {
    const onQueued = vi.fn();
    const onUnqueued = vi.fn();
    dispatchStreamEvent({ type: "queued", payload: { content: "sem id" } }, { onQueued });
    dispatchStreamEvent({ type: "unqueued", payload: {} }, { onUnqueued });
    expect(onQueued).not.toHaveBeenCalled();
    expect(onUnqueued).not.toHaveBeenCalled();
  });

  it("keeps reading past done when Elo goes on to answer the queue", async () => {
    const events = [
      { type: "done", payload: {} },
      { type: "delivered", payload: { messages: [{ id: "m1", clientId: "c1", content: "e agora?", createdAt: "2026-10-10T12:00:00Z" }] } },
      { type: "assistant_delta", payload: { text: "Agora" } },
      { type: "done", payload: {} },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => streamed(sse(events))));
    const onDone = vi.fn();
    const onDelta = vi.fn();
    expect(await readChatStream(chatStreams.observe("th1"), { onDone, onDelta }, new AbortController().signal)).toBe("finished");
    expect(onDone).toHaveBeenCalledTimes(2);
    expect(onDelta).toHaveBeenCalledWith("Agora");
  });

  it("is detached when the stream closes in the middle of the follow-up answer", async () => {
    const events = [
      { type: "done", payload: {} },
      { type: "delivered", payload: { messages: [{ id: "m1", clientId: "c1", content: "e agora?", createdAt: "2026-10-10T12:00:00Z" }] } },
      { type: "assistant_delta", payload: { text: "Ago" } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => streamed(sse(events))));
    expect(await readChatStream(chatStreams.observe("th1"), {}, new AbortController().signal)).toBe("detached");
  });

  it("stays finished when only queue bookkeeping follows the end", async () => {
    const events = [
      { type: "done", payload: {} },
      { type: "unqueued", payload: { clientId: "c1" } },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => streamed(sse(events))));
    expect(await readChatStream(chatStreams.observe("th1"), {}, new AbortController().signal)).toBe("finished");
  });

  it("sends the open screen and mode with a rejection so a queued reply keeps its context", () => {
    const request = chatStreams.reject("th1", "a1", { view: { surface: "leads" }, mode: "edit" });
    expect(request.body).toEqual({ view: { surface: "leads" }, mode: "edit" });
  });
});
