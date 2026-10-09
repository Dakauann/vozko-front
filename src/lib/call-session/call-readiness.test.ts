import { describe, expect, it } from "vitest";

import { callBlocker, isCallLive } from "@/lib/call-session/call-readiness";

describe("callBlocker", () => {
  const cases = [
    { name: "a member without permission", input: { permitted: false, online: true, live: false, direct: true }, want: "noPermission" },
    { name: "no permission even when only handing over", input: { permitted: false, online: true, live: false, direct: false }, want: "noPermission" },
    { name: "the call service still connecting", input: { permitted: true, online: false, live: false, direct: true }, want: "connecting" },
    { name: "a call already live", input: { permitted: true, online: true, live: true, direct: true }, want: "busy" },
    { name: "offline wins over a live call", input: { permitted: true, online: false, live: true, direct: true }, want: "connecting" },
    { name: "a hand over to the dialer while offline", input: { permitted: true, online: false, live: true, direct: false }, want: null },
    { name: "a ready member", input: { permitted: true, online: true, live: false, direct: true }, want: null },
  ] as const;

  for (const { name, input, want } of cases) {
    it(`answers ${String(want)} for ${name}`, () => {
      expect(callBlocker(input)).toBe(want);
    });
  }
});

describe("isCallLive", () => {
  const cases = [
    { name: "no call", callState: null, want: false },
    { name: "a ringing call", callState: { status: "ringing" }, want: true },
    { name: "a call waiting for a slot", callState: { status: "waiting_slot" }, want: true },
    { name: "an answered call", callState: { status: "answered" }, want: true },
    { name: "an ended call", callState: { status: "ended" }, want: false },
  ] as const;

  for (const { name, callState, want } of cases) {
    it(`answers ${String(want)} for ${name}`, () => {
      expect(isCallLive(callState)).toBe(want);
    });
  }
});
