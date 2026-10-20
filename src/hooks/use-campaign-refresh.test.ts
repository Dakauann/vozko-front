import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CAMPAIGN_REFRESH_MS, useCampaignRefresh } from "./use-campaign-refresh";

describe("useCampaignRefresh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("refreshes on every tick while active and stops when nothing runs", () => {
    const refresh = vi.fn();
    const { rerender, unmount } = renderHook(({ active }) => useCampaignRefresh(active, refresh), { initialProps: { active: true } });

    vi.advanceTimersByTime(CAMPAIGN_REFRESH_MS * 2);
    expect(refresh).toHaveBeenCalledTimes(2);

    rerender({ active: false });
    vi.advanceTimersByTime(CAMPAIGN_REFRESH_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("never refreshes while inactive", () => {
    const refresh = vi.fn();
    renderHook(() => useCampaignRefresh(false, refresh));
    vi.advanceTimersByTime(CAMPAIGN_REFRESH_MS * 4);
    expect(refresh).not.toHaveBeenCalled();
  });
});
