export type DialerTabState =
    | { status: "idle"; label: "idle" }
    | { status: "alert"; label: "incoming" }
    | { status: "live"; label: "holding" | "ringing" | "timer" };

export interface DialerTabInput {
    callStatus: "ringing" | "answered" | "waiting_slot" | "ended" | null;
    hasIncomingCall: boolean;
    transferRinging: boolean;
}

export function dialerTabState({ callStatus, hasIncomingCall, transferRinging }: DialerTabInput): DialerTabState {
    const inCall = callStatus !== null && callStatus !== "ended";
    if (hasIncomingCall && !inCall) return { status: "alert", label: "incoming" };
    if (!inCall) return { status: "idle", label: "idle" };
    if (transferRinging) return { status: "live", label: "holding" };
    if (callStatus === "answered") return { status: "live", label: "timer" };
    return { status: "live", label: "ringing" };
}
