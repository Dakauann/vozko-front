"use client";

import { useCallSession } from "@/contexts/call-session-context";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { callBlocker, isCallLive, type CallBlocker } from "@/lib/call-session/call-readiness";

export interface CallReadiness {
  online: boolean;
  live: boolean;
  blocker: CallBlocker | null;
}

export function useMayPlaceCalls(): boolean {
  const mayCall = useSettledPermission("sip_trunks", "call");
  const mayUseCalls = useSettledPermission("call_session", "use");
  return mayCall && mayUseCalls;
}

export function useCallReadiness({ direct = true }: { direct?: boolean } = {}): CallReadiness {
  const permitted = useMayPlaceCalls();
  const { status, callState } = useCallSession();
  const online = status === "connected";
  const live = isCallLive(callState);
  return { online, live, blocker: callBlocker({ permitted, online, live, direct }) };
}
