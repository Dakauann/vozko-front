import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMercadoLivreConnect } from "./use-mercadolivre-connect";

let mockHeaders: Record<string, string> = {};

vi.mock("@/lib/api/browser-client", () => ({
  getApiBaseUrl: () => "https://api.test",
  scopeHeaders: () => mockHeaders,
}));

const openSpy = vi.fn();
let popup: { closed: boolean; close: ReturnType<typeof vi.fn> };

function post(data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, origin: "https://api.test" }));
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

describe("useMercadoLivreConnect", () => {
  it("opens the Mercado Livre start path in the active workspace", () => {
    mockHeaders = { "X-Workspace-ID": "workspace-b" };
    const { result } = renderHook(() => useMercadoLivreConnect());
    act(() => result.current.connect("/dashboard/mercadolivre-accounts"));
    const [url, name] = openSpy.mock.calls[0];
    expect(url).toBe(
      "https://api.test/oauth/mercadolivre/start?redirect=1&popup=1&returnPath=%2Fdashboard%2Fmercadolivre-accounts&workspace_id=workspace-b",
    );
    expect(name).toBe("mercadolivre-login");
  });

  it("hands back a reconnect with the account", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useMercadoLivreConnect(onResult));
    act(() => result.current.connect());
    post({ source: "mercadolivre-login", status: "reconnected", nickname: "LOJA", accountId: "acc-1" });
    expect(onResult).toHaveBeenCalledWith({ status: "reconnected", nickname: "LOJA", accountId: "acc-1" });
  });

  it("hands back the error reason", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useMercadoLivreConnect(onResult));
    act(() => result.current.connect());
    post({ source: "mercadolivre-login", status: "error", reason: "not_account_admin" });
    expect(onResult).toHaveBeenCalledWith({ status: "error", reason: "not_account_admin" });
  });

  it("ignores another channel's popup", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useMercadoLivreConnect(onResult));
    act(() => result.current.connect());
    post({ source: "fb-business-login", status: "connected" });
    expect(onResult).not.toHaveBeenCalled();
  });

  it("reports a closed popup as cancelled", () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => useMercadoLivreConnect(onResult));
    act(() => result.current.connect());
    popup.closed = true;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onResult).toHaveBeenCalledWith({ status: "cancelled" });
  });
});
