import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CallSessionApi } from "@/hooks/use-call-session-ws";

const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const session = vi.hoisted(() => ({ value: {} as Partial<CallSessionApi> }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    permissionsLoading: false,
    currentWorkspace: { id: "ws-1" },
  }),
}));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => session.value }));

import { useCallReadiness, useMayPlaceCalls } from "@/hooks/use-call-readiness";

describe("useCallReadiness", () => {
  beforeEach(() => {
    grants.value = new Set(["sip_trunks:call", "call_session:use"]);
    session.value = { status: "connected", callState: null };
  });

  it("answers only whether a call can start and why not", () => {
    expect(renderHook(() => useCallReadiness()).result.current).toEqual({ online: true, live: false, blocker: null });
  });

  it("needs both the trunk call and the call session permissions", () => {
    grants.value = new Set(["call_session:use"]);
    expect(renderHook(() => useMayPlaceCalls()).result.current).toBe(false);
    expect(renderHook(() => useCallReadiness()).result.current.blocker).toBe("noPermission");
    grants.value = new Set(["sip_trunks:call"]);
    expect(renderHook(() => useCallReadiness()).result.current.blocker).toBe("noPermission");
    grants.value = new Set(["sip_trunks:call", "call_session:use"]);
    expect(renderHook(() => useMayPlaceCalls()).result.current).toBe(true);
  });

  it("waits for the call service and refuses a second call", () => {
    session.value = { status: "connecting", callState: null };
    expect(renderHook(() => useCallReadiness()).result.current).toEqual({ blocker: "connecting", online: false, live: false });

    session.value = { status: "connected", callState: { phoneNumber: "200", status: "answered" } };
    expect(renderHook(() => useCallReadiness()).result.current).toEqual({ blocker: "busy", online: true, live: true });

    session.value = { status: "connected", callState: { phoneNumber: "200", status: "ended" } };
    expect(renderHook(() => useCallReadiness()).result.current).toEqual({ blocker: null, online: true, live: false });
  });

  it("only checks permission when the number is handed to the dialer", () => {
    session.value = { status: "connecting", callState: { phoneNumber: "200", status: "answered" } };
    expect(renderHook(() => useCallReadiness({ direct: false })).result.current.blocker).toBeNull();
    grants.value = new Set();
    expect(renderHook(() => useCallReadiness({ direct: false })).result.current.blocker).toBe("noPermission");
  });
});
