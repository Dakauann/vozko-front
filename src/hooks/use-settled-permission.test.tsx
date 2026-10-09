import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const workspace = {
  currentWorkspace: { id: "ws-1" } as { id: string } | null,
  permissionsLoading: false,
  allowed: true,
};

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: workspace.currentWorkspace,
    permissionsLoading: workspace.permissionsLoading,
    can: () => !workspace.permissionsLoading && workspace.allowed,
  }),
}));

import { usePermissionVerdict, useSettledPermission } from "./use-settled-permission";

function renderVerdict() {
  return renderHook(() => usePermissionVerdict("leads", "read_addresses"));
}

describe("usePermissionVerdict", () => {
  beforeEach(() => {
    workspace.currentWorkspace = { id: "ws-1" };
    workspace.permissionsLoading = false;
    workspace.allowed = true;
  });

  it("has no verdict while the permissions load", () => {
    workspace.permissionsLoading = true;
    expect(renderVerdict().result.current).toBeNull();
  });

  it("has no verdict without a workspace", () => {
    workspace.currentWorkspace = null;
    expect(renderVerdict().result.current).toBeNull();
  });

  it("answers once the permissions settle", () => {
    expect(renderVerdict().result.current).toBe(true);
    workspace.allowed = false;
    expect(renderVerdict().result.current).toBe(false);
  });

  it("keeps the settled verdict while the same workspace reloads its permissions", () => {
    const { result, rerender } = renderVerdict();
    workspace.permissionsLoading = true;
    rerender();
    expect(result.current).toBe(true);
  });

  it("forgets the verdict when the workspace changes, until the new one settles", () => {
    const { result, rerender } = renderVerdict();
    workspace.currentWorkspace = { id: "ws-2" };
    workspace.permissionsLoading = true;
    rerender();
    expect(result.current).toBeNull();
    workspace.permissionsLoading = false;
    workspace.allowed = false;
    rerender();
    expect(result.current).toBe(false);
  });
});

describe("useSettledPermission", () => {
  beforeEach(() => {
    workspace.currentWorkspace = { id: "ws-1" };
    workspace.permissionsLoading = false;
    workspace.allowed = true;
  });

  it("refuses until the permission is known to be granted", () => {
    workspace.permissionsLoading = true;
    expect(renderHook(() => useSettledPermission("leads", "read_addresses")).result.current).toBe(false);
  });

  it("allows a settled grant", () => {
    expect(renderHook(() => useSettledPermission("leads", "read_addresses")).result.current).toBe(true);
  });
});
