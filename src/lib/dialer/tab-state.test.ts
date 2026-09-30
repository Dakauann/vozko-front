import { describe, expect, it } from "vitest";

import { dialerTabState } from "./tab-state";

describe("dialer tab state", () => {
    it("rests when nothing is happening", () => {
        expect(dialerTabState({ callStatus: null, hasIncomingCall: false, transferRinging: false })).toEqual({ status: "idle", label: "idle" });
        expect(dialerTabState({ callStatus: "ended", hasIncomingCall: false, transferRinging: false })).toEqual({ status: "idle", label: "idle" });
    });

    it("calls attention to a call ringing in", () => {
        expect(dialerTabState({ callStatus: null, hasIncomingCall: true, transferRinging: false })).toEqual({ status: "alert", label: "incoming" });
    });

    it("shows the clock once the call is answered", () => {
        expect(dialerTabState({ callStatus: "answered", hasIncomingCall: false, transferRinging: false })).toEqual({ status: "live", label: "timer" });
    });

    it("says the caller is waiting while a colleague is rung", () => {
        expect(dialerTabState({ callStatus: "answered", hasIncomingCall: false, transferRinging: true })).toEqual({ status: "live", label: "holding" });
    });

    it("says it is still calling before anyone answers", () => {
        expect(dialerTabState({ callStatus: "ringing", hasIncomingCall: false, transferRinging: false })).toEqual({ status: "live", label: "ringing" });
        expect(dialerTabState({ callStatus: "waiting_slot", hasIncomingCall: false, transferRinging: false })).toEqual({ status: "live", label: "ringing" });
    });

    it("keeps the current call in front of a second one ringing in", () => {
        expect(dialerTabState({ callStatus: "answered", hasIncomingCall: true, transferRinging: false })).toEqual({ status: "live", label: "timer" });
    });
});
