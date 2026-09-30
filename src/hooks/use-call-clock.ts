"use client";

import { useEffect, useState } from "react";

import type { CallSessionState } from "@/hooks/use-call-session-ws";
import { offerExpiresInMs, offerRingShare, type IncomingCallOffer } from "@/lib/call-session/inbound-call-types";

export function formatCallDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function useCallElapsedSeconds(callState: CallSessionState | null): number {
  const answeredAt = callState?.status === "answered" ? callState.answeredAt : undefined;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!answeredAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [answeredAt]);
  if (!answeredAt) return 0;
  return Math.max(0, Math.floor((now - answeredAt) / 1000));
}

export function useOfferRing(offer: IncomingCallOffer | null): { secondsLeft: number | null; share: number | null } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!offer) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [offer]);
  if (!offer) return { secondsLeft: null, share: null };
  const remaining = offerExpiresInMs(offer, now);
  return { secondsLeft: remaining === null ? null : Math.ceil(remaining / 1000), share: offerRingShare(offer, now) };
}
