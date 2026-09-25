import { describe, expect, it, vi } from "vitest";

import { createAssistantContextStore } from "./assistant-context";

const attendance = {
  kind: "attendance" as const,
  view: { surface: "attendance" as const, dateFrom: "2026-09-01", dateTo: "2026-09-07" },
  scope: { period: "Últimos 7 dias", department: "Todos", member: "Todos", channel: "Todos" },
};

describe("assistant context store", () => {
  it("starts with no page context, so a page that says nothing claims nothing", () => {
    expect(createAssistantContextStore().get()).toBeNull();
  });

  it("tells subscribers when a page publishes or withdraws its context", () => {
    const store = createAssistantContextStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(attendance);
    expect(store.get()).toEqual(attendance);
    store.set(null);
    expect(store.get()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("ignores a republish of the same context, so page re-renders cost nothing", () => {
    const store = createAssistantContextStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(attendance);
    store.set({ ...attendance, view: { ...attendance.view } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe", () => {
    const store = createAssistantContextStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set(attendance);
    expect(listener).not.toHaveBeenCalled();
  });
});
