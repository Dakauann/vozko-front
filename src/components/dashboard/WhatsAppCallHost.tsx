"use client";

import { PhoneCall, PhoneDisconnect, SpinnerGap } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";

import {
  setDialerCallActive,
  subscribeDialerCallRequest,
} from "@/lib/dialer/dialer-control";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useDialerWs } from "@/hooks/use-dialer-ws";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * WhatsApp call host.
 *
 * This replaced the persistent dialer. VoIP was removed from the product —
 * SIP trunks, ramais, transfers, presence, the keypad and the docked right-edge
 * panel are all gone — but WhatsApp calling stayed, and a WhatsApp call still
 * has to be placed by something and shown while it runs.
 *
 * So this component is deliberately headless until it has work to do:
 *
 *   - it renders NOTHING at rest (no edge tab, no panel, no launcher);
 *   - a call starts only when a conversation asks for one via
 *     `requestDialerCall({ phoneNumber, whatsAppPhoneId })`, which is what the
 *     "Ligar" action in the CRM does;
 *   - while a call is live it shows one compact status strip with the number,
 *     the state and hang up.
 *
 * There is no free-dial entry point on purpose: without SIP there is no number
 * to dial that is not already a conversation.
 */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function WhatsAppCallHost() {
  const t = useTranslations("whatsappCall");
  const { user } = useAuth();
  const { currentWorkspace, can } = useWorkspace();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const canUseDialer = can("dialer", "use");

  const { callState, startCall, endCall } = useDialerWs({
    // Session-presence signal for the call socket (auth rides the cookie).
    token: user?.id ?? "",
    enabled: !!currentWorkspace?.id && canUseDialer,
  });

  // A conversation asked to place a call. WhatsApp only: a request without a
  // business phone has nowhere to go now that trunks are gone, so it is ignored
  // rather than silently dialled over a channel that no longer exists.
  useEffect(() => {
    return subscribeDialerCallRequest(
      ({ phoneNumber, whatsAppPhoneId, whatsAppPhoneLabel }) => {
        if (!whatsAppPhoneId) return;
        const clean = phoneNumber.replace(/[^\d+]/g, "");
        if (!clean) return;
        setActiveLabel(whatsAppPhoneLabel ?? null);
        startCall(clean, { whatsAppPhoneId });
      },
    );
  }, [startCall]);

  const hasActiveCall = callState != null && callState.status !== "ended";

  useEffect(() => {
    setDialerCallActive(hasActiveCall);
    return () => setDialerCallActive(false);
  }, [hasActiveCall]);

  useEffect(() => {
    if (callState?.status !== "answered" || !callState.answeredAt) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - (callState.answeredAt ?? Date.now())) / 1000),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [callState?.status, callState?.answeredAt]);

  const handleEnd = useCallback(() => {
    endCall();
    setActiveLabel(null);
  }, [endCall]);

  if (!canUseDialer || !hasActiveCall || !callState) return null;

  const ringing = callState.status === "ringing";
  const waiting = callState.status === "waiting_slot";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-3",
        "rounded-[--radius] border border-border border-t-rule-strong bg-card px-3 py-2 shadow-2xl",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          ringing || waiting ? "bg-muted-foreground" : "bg-healthy",
        )}
      />

      <span className="flex min-w-0 flex-col leading-none">
        <span className="legend leading-none">
          {waiting
            ? (t("waitingSlot") ?? "Aguardando")
            : ringing
              ? (t("ringing") ?? "Chamando")
              : (t("inCall") ?? "Em chamada")}
          {activeLabel ? ` · ${activeLabel}` : ""}
        </span>
        <span className="readout mt-1 truncate text-[13px] font-semibold leading-none text-foreground">
          {callState.phoneNumber}
        </span>
      </span>

      {callState.status === "answered" && (
        <span className="readout shrink-0 text-[13px] font-semibold tabular-nums text-muted-foreground">
          {formatDuration(elapsedSeconds)}
        </span>
      )}

      {(ringing || waiting) && (
        <SpinnerGap
          className="h-4 w-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        onClick={handleEnd}
        aria-label={t("endCall") ?? "Encerrar chamada"}
        title={t("endCall") ?? "Encerrar chamada"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius] bg-destructive text-destructive-foreground transition-colors hover:opacity-90"
      >
        <PhoneDisconnect className="h-4 w-4" aria-hidden="true" />
      </button>

      <PhoneCall className="sr-only" aria-hidden="true" />
    </div>
  );
}
