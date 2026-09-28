import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOAuthPopupConnect, type OAuthPopupConfig } from "./use-oauth-popup-connect";

vi.mock("@/lib/api/browser-client", () => ({
  getApiBaseUrl: () => "https://api.test",
}));

interface Outcome {
  status: string;
  detail?: string;
}

const CONFIG: OAuthPopupConfig<Outcome> = {
  startPath: "/oauth/demo/start",
  popupName: "demo-login",
  messageSource: "demo-login",
  cancelled: { status: "cancelled" },
  parseResult: (data) =>
    typeof data.status === "string" ? { status: data.status, detail: data.detail as string | undefined } : null,
};

interface FakePopup {
  closed: boolean;
  close: ReturnType<typeof vi.fn>;
}

let popup: FakePopup | null;
const openSpy = vi.fn();
const originalLocation = window.location;

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
  Object.defineProperty(window, "location", { configurable: true, value: { href: "https://app.test/here" } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("useOAuthPopupConnect", () => {
  it("opens the start path with popup and return path parameters", () => {
    const { result } = renderHook(() => useOAuthPopupConnect(CONFIG));
    act(() => result.current.connect("/dashboard/demo"));

    const [url, name] = openSpy.mock.calls[0];
    expect(url).toBe("https://api.test/oauth/demo/start?redirect=1&popup=1&returnPath=%2Fdashboard%2Fdemo");
    expect(name).toBe("demo-login");
    expect(result.current.isConnecting).toBe(true);
  });

  it("ignores messages from any origin other than the API", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useOAuthPopupConnect(CONFIG, onResult));
    act(() => result.current.connect());

    post({ source: "demo-login", status: "connected" }, "https://evil.test");

    expect(onResult).not.toHaveBeenCalled();
    expect(result.current.isConnecting).toBe(true);
  });

  it("ignores messages from another source on the right origin", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useOAuthPopupConnect(CONFIG, onResult));
    act(() => result.current.connect());

    post({ source: "someone-else", status: "connected" });

    expect(onResult).not.toHaveBeenCalled();
  });

  it("delivers the parsed result, closes the popup and stops listening", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useOAuthPopupConnect(CONFIG, onResult));
    act(() => result.current.connect());

    post({ source: "demo-login", status: "connected", detail: "ok" });
    post({ source: "demo-login", status: "connected", detail: "again" });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ status: "connected", detail: "ok" });
    expect(popup?.close).toHaveBeenCalled();
    expect(result.current.isConnecting).toBe(false);
  });

  it("falls back to a full redirect when the popup is blocked", () => {
    openSpy.mockImplementation(() => null);
    const { result } = renderHook(() => useOAuthPopupConnect(CONFIG));
    act(() => result.current.connect());

    expect(window.location.href).toBe("https://api.test/oauth/demo/start?redirect=1&popup=1");
    expect(result.current.isConnecting).toBe(true);
  });

  it("reports cancellation when the person closes the popup", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useOAuthPopupConnect(CONFIG, onResult));
    act(() => result.current.connect());

    popup!.closed = true;
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(onResult).toHaveBeenCalledWith({ status: "cancelled" });
    expect(result.current.isConnecting).toBe(false);
  });

  it("stops listening when the component unmounts", () => {
    const onResult = vi.fn();
    const { result, unmount } = renderHook(() => useOAuthPopupConnect(CONFIG, onResult));
    act(() => result.current.connect());
    unmount();

    window.dispatchEvent(new MessageEvent("message", { data: { source: "demo-login", status: "connected" }, origin: "https://api.test" }));
    popup!.closed = true;
    vi.advanceTimersByTime(700);

    expect(onResult).not.toHaveBeenCalled();
  });
});
