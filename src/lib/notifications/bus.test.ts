import { describe, expect, it, vi } from "vitest";

import { emitNotificationCreated, subscribeNotificationCreated } from "./bus";
import type { NotificationCreatedEvent } from "./types";

const event: NotificationCreatedEvent = {
  workspaceId: "ws-1",
  item: { id: "n1", category: "system", severity: "info", title: "Oi", body: "", createdAt: "2026-10-16T12:00:00Z" },
};

describe("notification bus", () => {
  it("delivers an emitted event to every subscriber", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = subscribeNotificationCreated(first);
    const stopSecond = subscribeNotificationCreated(second);

    emitNotificationCreated(event);

    expect(first).toHaveBeenCalledWith(event);
    expect(second).toHaveBeenCalledWith(event);
    stopFirst();
    stopSecond();
  });

  it("stops delivering after unsubscribe", () => {
    const listener = vi.fn();
    const stop = subscribeNotificationCreated(listener);
    stop();

    emitNotificationCreated(event);

    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps delivering to the others when a listener unsubscribes while being called", () => {
    const later = vi.fn();
    const stopSelf = subscribeNotificationCreated(() => stopSelf());
    const stopLater = subscribeNotificationCreated(later);

    emitNotificationCreated(event);

    expect(later).toHaveBeenCalledTimes(1);
    stopLater();
  });
});
