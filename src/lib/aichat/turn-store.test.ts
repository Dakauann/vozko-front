import { describe, expect, it, vi } from "vitest";

import { createTurnStore, IDLE_TURN } from "./turn-store";
import type { UIMessage } from "./ui-message";

const question: UIMessage = { id: "u1", role: "user", content: "oi", createdAt: "2026-10-08T12:00:00Z" };
const reply: UIMessage = { id: "a1", role: "assistant", content: "", createdAt: "2026-10-08T12:00:01Z", segments: [] };

describe("createTurnStore", () => {
  it("has nothing for a conversation it never saw", () => {
    const store = createTurnStore();
    expect(store.snapshot(null)).toBe(IDLE_TURN);
    expect(store.snapshot("th1")).toBe(IDLE_TURN);
    expect(store.isStreaming("th1")).toBe(false);
  });

  it("keeps the same snapshot until something changes", () => {
    const store = createTurnStore();
    store.load("th1", [question]);
    const first = store.snapshot("th1");
    expect(store.snapshot("th1")).toBe(first);
    store.update("th1", (m) => [...m, reply]);
    expect(store.snapshot("th1")).not.toBe(first);
    expect(store.snapshot("th1").messages).toEqual([question, reply]);
  });

  it("lets a subscriber that arrives mid answer see the answer so far", () => {
    const store = createTurnStore();
    const signal = store.begin("th1");
    store.update("th1", () => [question, reply]);
    store.apply("th1", { kind: "delta", text: "Trabalhando" });

    const late = vi.fn();
    store.subscribe(late);
    const seen = store.snapshot("th1");
    expect(signal?.aborted).toBe(false);
    expect(seen.streaming).toBe(true);
    expect(seen.messages[1].segments).toEqual([{ kind: "text", text: "Trabalhando", streaming: true }]);

    store.apply("th1", { kind: "delta", text: "!" });
    expect(late).toHaveBeenCalled();
    expect(store.snapshot("th1").messages[1].segments).toEqual([{ kind: "text", text: "Trabalhando!", streaming: true }]);
  });

  it("refuses a second answer while one runs", () => {
    const store = createTurnStore();
    expect(store.begin("th1")).not.toBeNull();
    expect(store.begin("th1")).toBeNull();
    expect(store.begin("th2")).not.toBeNull();
  });

  it("never lets history overwrite a running answer", () => {
    const store = createTurnStore();
    store.begin("th1");
    store.update("th1", () => [question, reply]);
    expect(store.load("th1", [question])).toBe(false);
    expect(store.snapshot("th1").messages).toEqual([question, reply]);
    store.end("th1");
    expect(store.load("th1", [question])).toBe(true);
    expect(store.snapshot("th1").messages).toEqual([question]);
  });

  it("aborts the running answer from anywhere", () => {
    const store = createTurnStore();
    expect(store.abort("th1")).toBe(false);
    const signal = store.begin("th1");
    expect(store.abort("th1")).toBe(true);
    expect(signal?.aborted).toBe(true);
  });

  it("ending settles the live segments and frees the conversation", () => {
    const store = createTurnStore();
    store.begin("th1");
    store.update("th1", () => [question, reply]);
    store.apply("th1", { kind: "delta", text: "a" });
    store.end("th1");
    const state = store.snapshot("th1");
    expect(state.streaming).toBe(false);
    expect(state.messages[1].segments).toEqual([{ kind: "text", text: "a", streaming: false }]);
    expect(store.begin("th1")).not.toBeNull();
  });

  it("keeps a failure until the next answer starts", () => {
    const store = createTurnStore();
    store.begin("th1");
    store.fail("th1", "Saldo insuficiente");
    store.end("th1");
    expect(store.snapshot("th1").error).toBe("Saldo insuficiente");
    store.begin("th1");
    expect(store.snapshot("th1").error).toBeNull();
  });

  it("stops notifying a listener that left", () => {
    const store = createTurnStore();
    const listener = vi.fn();
    const leave = store.subscribe(listener);
    leave();
    store.load("th1", [question]);
    expect(listener).not.toHaveBeenCalled();
  });
});
