import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAutoOpenScreens } from "./use-auto-open-screens";

beforeEach(() => {
  localStorage.clear();
});

describe("useAutoOpenScreens", () => {
  it("asks until the person chooses", () => {
    const { result } = renderHook(() => useAutoOpenScreens());
    expect(result.current.preference).toBe("ask");
  });

  it("remembers the choice and shares it between cards", () => {
    const first = renderHook(() => useAutoOpenScreens());
    const second = renderHook(() => useAutoOpenScreens());
    act(() => first.result.current.choose("off"));
    expect(second.result.current.preference).toBe("off");
    expect(localStorage.getItem("ai-chat:auto-open-screens")).toBe("off");
    const later = renderHook(() => useAutoOpenScreens());
    expect(later.result.current.preference).toBe("off");
  });

  it("still works for this session when storage is blocked", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useAutoOpenScreens());
    act(() => result.current.choose("on"));
    expect(result.current.preference).toBe("on");
    setItem.mockRestore();
    getItem.mockRestore();
  });
});
