import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: unknown) => void;

const socket = vi.hoisted(() => ({
  status: "connected",
  present: true,
  leadListeners: new Set<(event: unknown) => void>(),
  bulkListeners: new Set<(event: unknown) => void>(),
}));

vi.mock("@/contexts/crm-context", () => ({
  useOptionalCrm: () =>
    socket.present
      ? {
          status: socket.status,
          subscribeLeadUpdates: (listener: Listener) => {
            socket.leadListeners.add(listener);
            return () => socket.leadListeners.delete(listener);
          },
          subscribeLeadsBulkUpdates: (listener: Listener) => {
            socket.bulkListeners.add(listener);
            return () => socket.bulkListeners.delete(listener);
          },
        }
      : null,
}));

import {
  LEADS_LIVE_AGGREGATES_INTERVAL_MS,
  createQuietReloadGate,
  LEADS_LIVE_REFETCH_INTERVAL_MS,
  useLeadsLiveRefetch,
} from "../use-leads-live-refetch";

function leadUpdate() {
  act(() => {
    for (const listener of socket.leadListeners) listener({ leadId: "lead-1", version: 2, fields: ["name"] });
  });
}

function bulkUpdate() {
  act(() => {
    for (const listener of socket.bulkListeners) listener({ runId: "run-1" });
  });
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("useLeadsLiveRefetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    socket.status = "connected";
    socket.present = true;
    socket.leadListeners.clear();
    socket.bulkListeners.clear();
    setHidden(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refetches the list when a lead changes", () => {
    const refetch = vi.fn();
    renderHook(() => useLeadsLiveRefetch(refetch));
    leadUpdate();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("refetches the list when a bulk run changes a batch of leads", () => {
    const refetch = vi.fn();
    renderHook(() => useLeadsLiveRefetch(refetch));
    bulkUpdate();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("turns a burst of changes into one refetch now and one when the interval ends", () => {
    const refetch = vi.fn();
    renderHook(() => useLeadsLiveRefetch(refetch));
    leadUpdate();
    for (let i = 0; i < 50; i += 1) bulkUpdate();
    expect(refetch).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(LEADS_LIVE_REFETCH_INTERVAL_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(2);
    act(() => {
      vi.advanceTimersByTime(LEADS_LIVE_REFETCH_INTERVAL_MS * 3);
    });
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("spaces refetches by the interval it was given, for the costlier aggregates", () => {
    const refetch = vi.fn();
    renderHook(() => useLeadsLiveRefetch(refetch, { intervalMs: LEADS_LIVE_AGGREGATES_INTERVAL_MS }));
    leadUpdate();
    leadUpdate();
    act(() => {
      vi.advanceTimersByTime(LEADS_LIVE_REFETCH_INTERVAL_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(LEADS_LIVE_AGGREGATES_INTERVAL_MS);
    });
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("waits until the page is visible again, then refetches once", () => {
    const refetch = vi.fn();
    renderHook(() => useLeadsLiveRefetch(refetch));
    setHidden(true);
    leadUpdate();
    bulkUpdate();
    act(() => {
      vi.advanceTimersByTime(LEADS_LIVE_REFETCH_INTERVAL_MS * 2);
    });
    expect(refetch).not.toHaveBeenCalled();
    setHidden(false);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("does nothing on visibility when no change arrived while hidden", () => {
    const refetch = vi.fn();
    renderHook(() => useLeadsLiveRefetch(refetch));
    setHidden(true);
    setHidden(false);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("refetches on focus for a member without a live socket", () => {
    socket.present = false;
    const refetch = vi.fn();
    renderHook(() => useLeadsLiveRefetch(refetch));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("refetches on focus while the socket is down", () => {
    socket.status = "disconnected";
    const refetch = vi.fn();
    renderHook(() => useLeadsLiveRefetch(refetch));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("leaves focus alone while the socket delivers changes", () => {
    const refetch = vi.fn();
    renderHook(() => useLeadsLiveRefetch(refetch));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(refetch).not.toHaveBeenCalled();
  });

  it("stops listening when disabled or unmounted", () => {
    const refetch = vi.fn();
    const { rerender, unmount } = renderHook(({ enabled }) => useLeadsLiveRefetch(refetch, { enabled }), {
      initialProps: { enabled: false },
    });
    leadUpdate();
    expect(refetch).not.toHaveBeenCalled();
    rerender({ enabled: true });
    leadUpdate();
    expect(refetch).toHaveBeenCalledTimes(1);
    unmount();
    act(() => {
      vi.advanceTimersByTime(LEADS_LIVE_REFETCH_INTERVAL_MS);
    });
    leadUpdate();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("calls the latest refetch it was given", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ refetch }) => useLeadsLiveRefetch(refetch), { initialProps: { refetch: first } });
    rerender({ refetch: second });
    leadUpdate();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("createQuietReloadGate", () => {
  it("keeps the rows on screen for a live refetch of the same request", () => {
    const gate = createQuietReloadGate();
    expect(gate.quiet("page-1")).toBe(false);
    gate.markLive();
    expect(gate.quiet("page-1")).toBe(true);
  });

  it("shows loading when the request changed, even if a live change asked first", () => {
    const gate = createQuietReloadGate();
    gate.quiet("page-1");
    gate.markLive();
    expect(gate.quiet("page-2")).toBe(false);
  });

  it("shows loading for a reload nobody marked as live", () => {
    const gate = createQuietReloadGate();
    gate.quiet("page-1");
    expect(gate.quiet("page-1")).toBe(false);
  });

  it("uses a live mark once", () => {
    const gate = createQuietReloadGate();
    gate.quiet("page-1");
    gate.markLive();
    gate.quiet("page-1");
    expect(gate.quiet("page-1")).toBe(false);
  });
});
