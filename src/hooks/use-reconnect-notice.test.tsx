import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConnectionStatus } from "@/lib/conversations/types";

import { RECONNECT_NOTICE_DELAY_MS, useReconnectNotice } from "./use-reconnect-notice";

function mount(initial: ConnectionStatus) {
  return renderHook(({ status }: { status: ConnectionStatus }) => useReconnectNotice(status), {
    initialProps: { status: initial },
  });
}

describe("useReconnectNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays quiet while the first connection is still being made", () => {
    const view = mount("connecting");
    act(() => vi.advanceTimersByTime(RECONNECT_NOTICE_DELAY_MS * 3));
    expect(view.result.current).toBe(false);
  });

  it("waits three seconds after a drop before showing, so a blip never flashes a banner", () => {
    const view = mount("connected");
    view.rerender({ status: "disconnected" });
    act(() => vi.advanceTimersByTime(RECONNECT_NOTICE_DELAY_MS - 1));
    expect(view.result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(view.result.current).toBe(true);
  });

  it("keeps showing through the reconnect attempts and hides once connected again", () => {
    const view = mount("connected");
    view.rerender({ status: "disconnected" });
    act(() => vi.advanceTimersByTime(RECONNECT_NOTICE_DELAY_MS));
    view.rerender({ status: "connecting" });
    expect(view.result.current).toBe(true);
    view.rerender({ status: "connected" });
    expect(view.result.current).toBe(false);
  });

  it("never shows for a drop that heals within three seconds", () => {
    const view = mount("connected");
    view.rerender({ status: "error" });
    act(() => vi.advanceTimersByTime(1000));
    view.rerender({ status: "connected" });
    act(() => vi.advanceTimersByTime(RECONNECT_NOTICE_DELAY_MS * 2));
    expect(view.result.current).toBe(false);
  });
});
