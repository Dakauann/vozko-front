import { describe, expect, it } from "vitest";

import {
  CACHED_MESSAGE_LIMIT,
  THREAD_CACHE_CAPACITY,
  emptyThreadCache,
  holdsThread,
  recallThread,
  rememberThread,
} from "./thread-cache";
import type { ConversationMessage } from "./types";

function message(id: string, minute = 0): ConversationMessage {
  const at = new Date(Date.UTC(2026, 9, 18, 10, minute)).toISOString();
  return {
    id,
    entry_id: "e1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: "5511",
    to: "me",
    text: id,
    sender_name: "",
    read: true,
    read_at: null,
    read_by: null,
    created_at: at,
    updated_at: at,
  };
}

const WORKSPACE = "ws-1:";

describe("thread cache", () => {
  it("hands back a remembered thread for the same workspace", () => {
    const cache = rememberThread(emptyThreadCache, WORKSPACE, "whatsapp:e1", {
      messages: [message("a")],
      has_more: true,
      total: 30,
    });
    expect(recallThread(cache, WORKSPACE, "whatsapp:e1").thread).toEqual({
      messages: [message("a")],
      has_more: true,
      total: 30,
    });
  });

  it("never hands a thread to another workspace", () => {
    const cache = rememberThread(emptyThreadCache, WORKSPACE, "whatsapp:e1", { messages: [message("a")], has_more: false });
    expect(recallThread(cache, "ws-2:", "whatsapp:e1").thread).toBeNull();
  });

  it("starts over when a thread of another workspace is remembered", () => {
    let cache = rememberThread(emptyThreadCache, WORKSPACE, "whatsapp:e1", { messages: [message("a")], has_more: false });
    cache = rememberThread(cache, "ws-2:", "whatsapp:e2", { messages: [message("b")], has_more: false });
    expect(recallThread(cache, "ws-2:", "whatsapp:e1").thread).toBeNull();
    expect(recallThread(cache, "ws-2:", "whatsapp:e2").thread).not.toBeNull();
  });

  it("keeps only the ten threads used most recently", () => {
    let cache = emptyThreadCache;
    for (let i = 0; i <= THREAD_CACHE_CAPACITY; i += 1) {
      cache = rememberThread(cache, WORKSPACE, `whatsapp:e${i}`, { messages: [message(`m${i}`)], has_more: false });
      if (i === 5) cache = recallThread(cache, WORKSPACE, "whatsapp:e0").cache;
    }
    expect(recallThread(cache, WORKSPACE, "whatsapp:e0").thread).not.toBeNull();
    expect(recallThread(cache, WORKSPACE, "whatsapp:e1").thread).toBeNull();
    expect(recallThread(cache, WORKSPACE, `whatsapp:e${THREAD_CACHE_CAPACITY}`).thread).not.toBeNull();
  });

  it("tells whether a thread is cached without making it the most recent", () => {
    let cache = rememberThread(emptyThreadCache, WORKSPACE, "whatsapp:e1", { messages: [message("a")], has_more: false });
    cache = rememberThread(cache, WORKSPACE, "whatsapp:e2", { messages: [message("b")], has_more: false });
    expect(holdsThread(cache, WORKSPACE, "whatsapp:e1")).toBe(true);
    expect(holdsThread(cache, "ws-2:", "whatsapp:e1")).toBe(false);
    expect([...cache.threads.keys()]).toEqual(["whatsapp:e1", "whatsapp:e2"]);
  });

  it("does not remember a thread scrolled away from the present, so a reopen never shows a gap", () => {
    const cache = rememberThread(emptyThreadCache, WORKSPACE, "whatsapp:e1", {
      messages: [message("a")],
      has_more: true,
      has_after: true,
    });
    expect(recallThread(cache, WORKSPACE, "whatsapp:e1").thread).toBeNull();
  });

  it("does not remember an empty thread", () => {
    const cache = rememberThread(emptyThreadCache, WORKSPACE, "whatsapp:e1", { messages: [], has_more: false });
    expect(cache).toBe(emptyThreadCache);
  });

  it("keeps the newest messages of a long thread and remembers that older ones exist", () => {
    const messages = Array.from({ length: CACHED_MESSAGE_LIMIT + 5 }, (_, i) => message(`m${i}`, i));
    const cache = rememberThread(emptyThreadCache, WORKSPACE, "whatsapp:e1", { messages, has_more: false });
    const thread = recallThread(cache, WORKSPACE, "whatsapp:e1").thread;
    expect(thread?.messages).toHaveLength(CACHED_MESSAGE_LIMIT);
    expect(thread?.messages[0].id).toBe("m5");
    expect(thread?.has_more).toBe(true);
  });
});
