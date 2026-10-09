import { afterEach, describe, expect, it, vi } from "vitest";

import { chatStreams, readChatStream } from "./chat-stream";

function sse(events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

function streamed(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readChatStream", () => {
  it("finishes when the answer ends with done", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamed(sse([{ type: "assistant_delta", payload: { text: "oi" } }, { type: "done", payload: {} }]))));
    const onDelta = vi.fn();
    const onDone = vi.fn();
    const outcome = await readChatStream(chatStreams.observe("th1"), { onDelta, onDone }, new AbortController().signal);
    expect(outcome).toBe("finished");
    expect(onDelta).toHaveBeenCalledWith("oi");
    expect(onDone).toHaveBeenCalled();
  });

  it("finishes when the answer pauses for approval", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamed(sse([{ type: "awaiting_approval", payload: { actionId: "a1" } }]))));
    expect(await readChatStream(chatStreams.observe("th1"), {}, new AbortController().signal)).toBe("finished");
  });

  it("reports a stream that closed before the answer ended as detached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamed(sse([{ type: "assistant_delta", payload: { text: "oi" } }]))));
    const onError = vi.fn();
    expect(await readChatStream(chatStreams.observe("th1"), { onError }, new AbortController().signal)).toBe("detached");
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a connection that broke in the middle of the answer as detached, so the turn can be watched again", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse([{ type: "assistant_delta", payload: { text: "oi" } }])));
        controller.error(new TypeError("network error"));
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })));
    const onError = vi.fn();
    expect(await readChatStream(chatStreams.observe("th1"), { onError }, new AbortController().signal)).toBe("detached");
    expect(onError).not.toHaveBeenCalled();
  });

  it("treats a missing answer as missing when watching, never as an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "turn_not_running" }), { status: 404 })));
    const onError = vi.fn();
    expect(await readChatStream(chatStreams.observe("th1"), { onError }, new AbortController().signal)).toBe("missing");
    expect(onError).not.toHaveBeenCalled();
  });

  it("surfaces a refused message as an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "a Elo ainda está respondendo nesta conversa" }), { status: 409 })));
    const onError = vi.fn();
    const outcome = await readChatStream(chatStreams.send("th1", { content: "oi", model: "m" }), { onError }, new AbortController().signal);
    expect(outcome).toBe("failed");
    expect(onError).toHaveBeenCalledWith("a Elo ainda está respondendo nesta conversa");
  });

  it("reports an aborted stream as aborted", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        controller.abort();
        if (init.signal?.aborted) throw new DOMException("aborted", "AbortError");
        return streamed("");
      }),
    );
    const onError = vi.fn();
    expect(await readChatStream(chatStreams.observe("th1"), { onError }, controller.signal)).toBe("aborted");
    expect(onError).not.toHaveBeenCalled();
  });

  it("watches the running answer with a GET and sends messages with a POST", () => {
    expect(chatStreams.observe("th 1")).toMatchObject({ method: "GET", url: expect.stringContaining("/chat/threads/th%201/turn/events") });
    expect(chatStreams.send("th1", { content: "oi", model: "m" })).toMatchObject({ method: "POST", url: expect.stringContaining("/chat/threads/th1/messages") });
    expect(chatStreams.approve("th1", "a1", {})).toMatchObject({ method: "POST", url: expect.stringContaining("/chat/threads/th1/actions/a1/approve") });
    expect(chatStreams.reject("th1", "a1")).toMatchObject({ method: "POST", url: expect.stringContaining("/chat/threads/th1/actions/a1/reject") });
  });
});
