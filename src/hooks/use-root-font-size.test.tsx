import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useRootFontSize } from "./use-root-font-size";

afterEach(() => {
  cleanup();
  document.documentElement.style.fontSize = "";
});

describe("useRootFontSize", () => {
  it("reads the root font size and follows it when the window resizes", () => {
    document.documentElement.style.fontSize = "14px";
    const { result } = renderHook(() => useRootFontSize());
    expect(result.current).toBe(14);
    act(() => {
      document.documentElement.style.fontSize = "15.36px";
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(15.36);
  });

  it("assumes the browser default when the size cannot be read", () => {
    document.documentElement.style.fontSize = "";
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    const { result } = renderHook(() => useRootFontSize());
    expect(result.current).toBe(16);
  });
});
