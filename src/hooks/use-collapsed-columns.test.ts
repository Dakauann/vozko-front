import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({ id: "viewer-1" as string | null }));

vi.mock("@/contexts/auth-context", () => ({
  useSignedInUserId: () => viewer.id,
}));

import { useCollapsedColumns } from "./use-collapsed-columns";

describe("useCollapsedColumns", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("remembers a collapsed column for the viewer across remounts", () => {
    viewer.id = "viewer-remount";
    const first = renderHook(() => useCollapsedColumns("opportunities"));
    act(() => first.result.current.toggle("stage-a"));
    expect(first.result.current.isCollapsed("stage-a")).toBe(true);
    first.unmount();

    const second = renderHook(() => useCollapsedColumns("opportunities"));
    expect(second.result.current.isCollapsed("stage-a")).toBe(true);
    expect(window.localStorage.getItem("crm.kanban.collapsed.opportunities.viewer-remount")).toBe(
      '["stage-a"]',
    );
  });

  it("keeps working when storage refuses writes, as in a private window", () => {
    viewer.id = "viewer-private";
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = renderHook(() => useCollapsedColumns("conversation-funnel"));

    act(() => result.current.toggle("stage-b"));

    expect(result.current.isCollapsed("stage-b")).toBe(true);
    setItem.mockRestore();
  });

  it("stores nothing without a signed in viewer, but still collapses for the session", () => {
    viewer.id = null;
    const { result } = renderHook(() => useCollapsedColumns("opportunities"));

    act(() => result.current.toggle("stage-c"));

    expect(result.current.isCollapsed("stage-c")).toBe(true);
    expect(window.localStorage.length).toBe(0);
  });
});
