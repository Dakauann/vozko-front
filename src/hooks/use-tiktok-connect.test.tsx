import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTiktokConnect } from "./use-tiktok-connect";

let mockHeaders: Record<string, string> = {};

vi.mock("@/lib/api/browser-client", () => ({
  getApiBaseUrl: () => "https://api.test",
  scopeHeaders: () => mockHeaders,
}));

const openSpy = vi.fn();
let popup: { closed: boolean; close: ReturnType<typeof vi.fn> };

function post(data: unknown, origin = "https://api.test") {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, origin }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  popup = { closed: false, close: vi.fn() };
  openSpy.mockReset();
  openSpy.mockImplementation(() => popup);
  vi.stubGlobal("open", openSpy);
});

afterEach(() => {
  mockHeaders = {};
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useTiktokConnect", () => {
  it("opens the TikTok start path as a popup in the active workspace", () => {
    mockHeaders = { "X-Workspace-ID": "workspace-b" };
    const { result } = renderHook(() => useTiktokConnect());
    act(() => result.current.connect("/dashboard/tiktok-accounts"));
    const [url, name] = openSpy.mock.calls[0];
    expect(url).toBe(
      "https://api.test/oauth/tiktok/start?redirect=1&popup=1&returnPath=%2Fdashboard%2Ftiktok-accounts&workspace_id=workspace-b",
    );
    expect(name).toBe("tiktok-login");
  });

  it("hands back a connected account with its username", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useTiktokConnect(onResult));
    act(() => result.current.connect());
    post({ source: "tiktok-login", status: "connected", username: "loja", accountId: "acc-1" });
    expect(onResult).toHaveBeenCalledWith({ status: "connected", username: "loja", accountId: "acc-1" });
  });

  it("hands back the error reason", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useTiktokConnect(onResult));
    act(() => result.current.connect());
    post({ source: "tiktok-login", status: "error", reason: "not_eligible_account" });
    expect(onResult).toHaveBeenCalledWith({ status: "error", reason: "not_eligible_account" });
  });

  it("reports a declined authorization as cancelled", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useTiktokConnect(onResult));
    act(() => result.current.connect());
    post({ source: "tiktok-login", status: "cancelled", reason: "declined" });
    expect(onResult).toHaveBeenCalledWith({ status: "cancelled" });
  });

  it("ignores another channel's popup and messages from another origin", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useTiktokConnect(onResult));
    act(() => result.current.connect());
    post({ source: "mercadolivre-login", status: "connected" });
    post({ source: "tiktok-login", status: "connected" }, "https://evil.test");
    expect(onResult).not.toHaveBeenCalled();
  });

  it("reports a closed popup as cancelled", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useTiktokConnect(onResult));
    act(() => result.current.connect());
    popup.closed = true;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onResult).toHaveBeenCalledWith({ status: "cancelled" });
  });
});
