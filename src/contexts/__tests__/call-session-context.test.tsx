import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const workspace = vi.hoisted(() => ({ value: { loading: false, allowed: true, id: "ws-1" } }));
const enabledSeen = vi.hoisted(() => ({ values: [] as boolean[] }));

vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: workspace.value.id },
    permissionsLoading: workspace.value.loading,
    can: () => !workspace.value.loading && workspace.value.allowed,
  }),
}));
vi.mock("@/hooks/use-call-session-ws", () => ({
  useCallSessionWs: ({ enabled }: { enabled: boolean }) => {
    enabledSeen.values.push(enabled);
    return {};
  },
}));

import { CallSessionProvider } from "@/contexts/call-session-context";

function tree(state: { loading: boolean; allowed: boolean; id: string }) {
  workspace.value = state;
  return <CallSessionProvider>{null}</CallSessionProvider>;
}

describe("CallSessionProvider", () => {
  it("keeps the call socket up while permissions reload", () => {
    enabledSeen.values = [];
    const view = render(tree({ loading: false, allowed: true, id: "ws-1" }));
    view.rerender(tree({ loading: true, allowed: true, id: "ws-1" }));
    view.rerender(tree({ loading: false, allowed: true, id: "ws-1" }));
    const firstEnabled = enabledSeen.values.indexOf(true);
    expect(firstEnabled).toBeGreaterThanOrEqual(0);
    expect(enabledSeen.values.slice(firstEnabled).every(Boolean)).toBe(true);
  });

  it("closes the socket once the permission is really gone or the workspace changes", () => {
    enabledSeen.values = [];
    const view = render(tree({ loading: false, allowed: true, id: "ws-1" }));
    view.rerender(tree({ loading: false, allowed: false, id: "ws-1" }));
    expect(enabledSeen.values.at(-1)).toBe(false);
    view.rerender(tree({ loading: false, allowed: true, id: "ws-1" }));
    view.rerender(tree({ loading: true, allowed: true, id: "ws-2" }));
    expect(enabledSeen.values.at(-1)).toBe(false);
  });

  it("stays closed until permissions have loaded at least once", () => {
    enabledSeen.values = [];
    render(tree({ loading: true, allowed: true, id: "ws-1" }));
    expect(enabledSeen.values).toEqual([false]);
  });
});
