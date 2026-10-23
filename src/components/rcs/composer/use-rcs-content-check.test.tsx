import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ checkRcsContentAction: vi.fn() }));

vi.mock("@/app/actions/rcs", () => actions);

import type { RcsContent, RcsContentCheck } from "@/lib/rcs/types";

import { useRcsContentCheck } from "./use-rcs-content-check";

const VERDICT: RcsContentCheck = {
  kind: "text",
  billing_class: "basic",
  variable_slots: 0,
  issues: [],
  price: { charge_kind: "rcs_basic", unit_micros: 15000, quantity: 1, total_micros: 15000 },
};

async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useRcsContentCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    actions.checkRcsContentAction.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks nothing while the message is empty", async () => {
    const { result } = renderHook(() => useRcsContentCheck({}));
    await flush(1000);
    expect(actions.checkRcsContentAction).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("waits for typing to settle before asking the backend once", async () => {
    actions.checkRcsContentAction.mockResolvedValue({ data: VERDICT, error: null });
    const { result, rerender } = renderHook(({ content }: { content: RcsContent }) => useRcsContentCheck(content), {
      initialProps: { content: { text: "O" } },
    });
    expect(result.current.status).toBe("checking");
    rerender({ content: { text: "Oi" } });
    await flush(200);
    rerender({ content: { text: "Oi!" } });
    await flush(500);
    expect(actions.checkRcsContentAction).toHaveBeenCalledTimes(1);
    expect(actions.checkRcsContentAction.mock.calls[0][0]).toEqual({ content: { text: "Oi!" } });
    expect(result.current.status).toBe("ready");
    expect(result.current.check).toEqual(VERDICT);
  });

  it("keeps the last verdict visible while the next one is on its way", async () => {
    actions.checkRcsContentAction.mockResolvedValue({ data: VERDICT, error: null });
    const { result, rerender } = renderHook(({ content }: { content: RcsContent }) => useRcsContentCheck(content), {
      initialProps: { content: { text: "Oi" } },
    });
    await flush(500);
    rerender({ content: { text: "Oi, tudo bem?" } });
    expect(result.current.status).toBe("checking");
    expect(result.current.check).toEqual(VERDICT);
  });

  it("reports the coded refusal and retries on demand", async () => {
    actions.checkRcsContentAction.mockResolvedValueOnce({ data: null, error: { code: "carrier_price_unavailable", message: "x" } });
    const { result } = renderHook(() => useRcsContentCheck({ text: "Oi" }));
    await flush(500);
    expect(result.current.status).toBe("failed");
    expect(result.current.error?.code).toBe("carrier_price_unavailable");
    actions.checkRcsContentAction.mockResolvedValueOnce({ data: VERDICT, error: null });
    act(() => result.current.retry());
    await flush(500);
    expect(actions.checkRcsContentAction).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("ready");
  });
});
