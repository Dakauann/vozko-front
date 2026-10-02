import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePortalPopup } from "./use-portal-popup";

interface FakePopup {
  closed: boolean;
}

let popup: FakePopup | null;
const openSpy = vi.fn();

function focusWindow() {
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  popup = { closed: false };
  openSpy.mockReset();
  openSpy.mockImplementation(() => popup);
  vi.stubGlobal("open", openSpy);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("usePortalPopup", () => {
  it("opens the exact portal url in a centred popup", () => {
    const { result } = renderHook(() => usePortalPopup(vi.fn()));
    let opened = false;
    act(() => {
      opened = result.current.openPortal("https://business.facebook.com/latest/billing_hub");
    });

    const [url, , features] = openSpy.mock.calls[0];
    expect(url).toBe("https://business.facebook.com/latest/billing_hub");
    expect(features).toContain("width=1080");
    expect(opened).toBe(true);
    expect(result.current.awaiting).toBe(true);
  });

  it("checks again once when the popup closes and then stops watching", () => {
    const onReturn = vi.fn();
    const { result } = renderHook(() => usePortalPopup(onReturn));
    act(() => {
      result.current.openPortal("https://www.facebook.com/pages/creation/");
    });

    popup!.closed = true;
    act(() => {
      vi.advanceTimersByTime(700);
    });
    focusWindow();

    expect(onReturn).toHaveBeenCalledTimes(1);
    expect(result.current.awaiting).toBe(false);
  });

  it("checks again whenever the window regains focus while the popup is still open", () => {
    const onReturn = vi.fn();
    const { result } = renderHook(() => usePortalPopup(onReturn));
    act(() => {
      result.current.openPortal("https://www.facebook.com/ads/leadgen/tos");
    });

    focusWindow();
    focusWindow();

    expect(onReturn).toHaveBeenCalledTimes(2);
    expect(result.current.awaiting).toBe(true);
  });

  it("falls back to the next focus when the popup is blocked", () => {
    openSpy.mockImplementation(() => null);
    const onReturn = vi.fn();
    const { result } = renderHook(() => usePortalPopup(onReturn));
    let opened = true;
    act(() => {
      opened = result.current.openPortal("https://business.facebook.com/latest/billing_hub");
    });

    focusWindow();
    focusWindow();

    expect(opened).toBe(false);
    expect(onReturn).toHaveBeenCalledTimes(1);
    expect(result.current.awaiting).toBe(false);
  });

  it("stops listening when the component unmounts", () => {
    const onReturn = vi.fn();
    const { result, unmount } = renderHook(() => usePortalPopup(onReturn));
    act(() => {
      result.current.openPortal("https://business.facebook.com/latest/billing_hub");
    });
    unmount();

    window.dispatchEvent(new Event("focus"));
    popup!.closed = true;
    vi.advanceTimersByTime(700);

    expect(onReturn).not.toHaveBeenCalled();
  });
});
