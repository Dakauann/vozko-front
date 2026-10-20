import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePeriodLimit } from "./use-period-limit";

type Props = { from: string; to: string };

function mount(view: string, initial: Props) {
  return renderHook(({ from, to }: Props) => usePeriodLimit(view, from, to, 92), { initialProps: initial });
}

const long = { from: "2026-01-01", to: "2026-09-30" };

describe("usePeriodLimit", () => {
  it("never opens for a period the view can show", () => {
    const { result } = mount("short", { from: "2026-07-01", to: "2026-09-30" });
    expect(result.current.exceeded).toBe(false);
    expect(result.current.dialogOpen).toBe(false);
  });

  it("opens when the period first goes past the limit, with the window it can show", () => {
    const { result, rerender } = mount("first", { from: "2026-07-01", to: "2026-09-30" });

    rerender(long);

    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.window).toEqual({ from: "2026-07-01", to: "2026-09-30" });
  });

  it("stays closed for the same period after an answer, even after a remount", () => {
    const first = mount("answered", long);
    act(() => first.result.current.settle());
    expect(first.result.current.dialogOpen).toBe(false);
    expect(first.result.current.exceeded).toBe(true);
    first.unmount();

    const again = mount("answered", long);
    expect(again.result.current.dialogOpen).toBe(false);
  });

  it("opens again for a different long period", () => {
    const { result, rerender } = mount("changed", long);
    act(() => result.current.settle());

    rerender({ from: "2025-06-01", to: "2026-09-30" });

    expect(result.current.dialogOpen).toBe(true);
  });
});
