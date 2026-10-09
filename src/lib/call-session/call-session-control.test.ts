import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  callSurfaceOwner,
  presetDial,
  releaseCallSurface,
  requestCall,
  setCallSurface,
  setDialerOpen,
  subscribeCallRequest,
  subscribeDialPreset,
  useCallSurfaceClaim,
  useCallSurfaceOwner,
  type CallRequest,
  type DialPreset,
} from "@/lib/call-session/call-session-control";

describe("call requests and presets", () => {
  it("carry the lead the call is about", () => {
    const requests: CallRequest[] = [];
    const presets: DialPreset[] = [];
    const stop = [subscribeCallRequest((r) => requests.push(r)), subscribeDialPreset((p) => presets.push(p))];
    requestCall({ phoneNumber: "100", trunkId: "t1", leadId: "lead-1" });
    presetDial({ phoneNumber: "100", leadId: "lead-1" });
    stop.forEach((fn) => fn());
    expect(requests).toEqual([{ phoneNumber: "100", trunkId: "t1", leadId: "lead-1" }]);
    expect(presets).toEqual([{ phoneNumber: "100", leadId: "lead-1" }]);
  });
});

describe("call surface", () => {
  afterEach(() => {
    releaseCallSurface("dialer");
    releaseCallSurface("call_list");
  });

  it("has no owner until a surface claims it", () => {
    expect(callSurfaceOwner()).toBeNull();
    setCallSurface("call_list");
    expect(callSurfaceOwner()).toBe("call_list");
    releaseCallSurface("call_list");
    expect(callSurfaceOwner()).toBeNull();
  });

  it("goes to the latest claim and back to the earlier one when it is released", () => {
    setCallSurface("call_list");
    setCallSurface("dialer");
    expect(callSurfaceOwner()).toBe("dialer");
    releaseCallSurface("dialer");
    expect(callSurfaceOwner()).toBe("call_list");
  });

  it("is not taken away by a surface that does not hold it", () => {
    setCallSurface("call_list");
    releaseCallSurface("dialer");
    setDialerOpen(false);
    expect(callSurfaceOwner()).toBe("call_list");
  });

  it("keeps the dialer flag as a claim by the dialer", () => {
    setDialerOpen(true);
    expect(callSurfaceOwner()).toBe("dialer");
    setDialerOpen(false);
    expect(callSurfaceOwner()).toBeNull();
  });

  it("tells subscribed components who owns it", () => {
    const { result } = renderHook(() => useCallSurfaceOwner());
    expect(result.current).toBeNull();
    act(() => setCallSurface("call_list"));
    expect(result.current).toBe("call_list");
    act(() => releaseCallSurface("call_list"));
    expect(result.current).toBeNull();
  });

  it("is claimed while a component asks for it and released when it stops or unmounts", () => {
    const { rerender, unmount } = renderHook(({ claimed }) => useCallSurfaceClaim("call_list", claimed), {
      initialProps: { claimed: false },
    });
    expect(callSurfaceOwner()).toBeNull();
    rerender({ claimed: true });
    expect(callSurfaceOwner()).toBe("call_list");
    rerender({ claimed: false });
    expect(callSurfaceOwner()).toBeNull();
    rerender({ claimed: true });
    unmount();
    expect(callSurfaceOwner()).toBeNull();
  });
});
