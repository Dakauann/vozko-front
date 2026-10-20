import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIRST_POLL_MS, type PollAnswer } from "@/lib/polling";

import { usePollWhile } from "./use-poll-while";

type Answer = PollAnswer<{ status: string }, string>;

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("usePollWhile", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hands every read to the caller until the value is over", async () => {
    const statuses = ["running", "waiting", "completed"];
    const read = vi.fn(async (): Promise<Answer> => ({ data: { status: statuses.shift() ?? "completed" }, error: null }));
    const onValue = vi.fn();
    renderHook(() =>
      usePollWhile({ active: true, pollKey: "run-1", read, isOver: (v) => v.status === "completed", onValue }),
    );
    await tick(60_000);
    expect(onValue.mock.calls.map(([value]) => value.status)).toEqual(["running", "waiting", "completed"]);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("does not read while inactive", async () => {
    const read = vi.fn(async (): Promise<Answer> => ({ data: { status: "running" }, error: null }));
    renderHook(() => usePollWhile({ active: false, pollKey: "run-1", read, isOver: () => false, onValue: vi.fn() }));
    await tick(60_000);
    expect(read).not.toHaveBeenCalled();
  });

  it("stops reading once the caller unmounts, so a closed panel costs nothing", async () => {
    const read = vi.fn(async (): Promise<Answer> => ({ data: { status: "running" }, error: null }));
    const { unmount } = renderHook(() =>
      usePollWhile({ active: true, pollKey: "run-1", read, isOver: () => false, onValue: vi.fn() }),
    );
    await tick(FIRST_POLL_MS);
    expect(read).toHaveBeenCalledTimes(1);
    unmount();
    await tick(60_000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("gives up after repeated read errors instead of hammering the server", async () => {
    const read = vi.fn(async (): Promise<Answer> => ({ data: null, error: "down" }));
    const onValue = vi.fn();
    renderHook(() => usePollWhile({ active: true, pollKey: "run-1", read, isOver: () => false, onValue }));
    await tick(120_000);
    expect(read).toHaveBeenCalledTimes(3);
    expect(onValue).not.toHaveBeenCalled();
  });
});
