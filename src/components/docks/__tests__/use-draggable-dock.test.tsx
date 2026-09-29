import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useDraggableDock } from "@/components/docks/use-draggable-dock";

const KEY = "dock-offset:test";

afterEach(() => window.localStorage.clear());

describe("useDraggableDock", () => {
  it("starts at the anchored spot when nothing was saved", () => {
    const { result } = renderHook(() => useDraggableDock("test"));
    expect(result.current.x.get()).toBe(0);
    expect(result.current.y.get()).toBe(0);
  });

  it("reopens where the member left it", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ x: -120, y: 40 }));
    const { result } = renderHook(() => useDraggableDock("test"));
    expect(result.current.x.get()).toBe(-120);
    expect(result.current.y.get()).toBe(40);
  });

  it("ignores a corrupt saved offset", () => {
    window.localStorage.setItem(KEY, '{"x":"far"}');
    const { result } = renderHook(() => useDraggableDock("test"));
    expect(result.current.x.get()).toBe(0);
    expect(result.current.y.get()).toBe(0);
  });

  it("remembers the offset once a drag ends", () => {
    const { result } = renderHook(() => useDraggableDock("test"));
    act(() => {
      result.current.x.set(-30);
      result.current.y.set(-15);
      result.current.dragProps.onDragEnd();
    });
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "null")).toEqual({
      x: -30,
      y: -15,
    });
  });

  it("returns home and forgets the offset on reset", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ x: -120, y: 40 }));
    const { result } = renderHook(() => useDraggableDock("test"));
    act(() => result.current.reset());
    expect(result.current.x.get()).toBe(0);
    expect(result.current.y.get()).toBe(0);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
