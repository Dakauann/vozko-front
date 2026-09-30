"use client";

import { useCallSession } from "@/contexts/call-session-context";
import { useCallSounds } from "@/hooks/use-call-sounds";

export function CallSoundsHost() {
  const { callState, incomingCall } = useCallSession();
  useCallSounds(callState?.status ?? null, incomingCall !== null);
  return null;
}
