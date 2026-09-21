"use client";

import { PhoneCall, PhoneDisconnect, SpinnerGap } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";

import {
  setCallActive,
  subscribeCallRequest,
} from "@/lib/call-session/call-session-control";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useCallSessionWs } from "@/hooks/use-call-session-ws";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

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

  const canUseCalling = can("call_session", "use");

  const { callState, startCall, endCall } = useCallSessionWs({
    token: user?.id ?? "",
    enabled: !!currentWorkspace?.id && canUseCalling,
  });

  useEffect(() => {
    return subscribeCallRequest(
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
    setCallActive(hasActiveCall);
    return () => setCallActive(false);
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

  if (!canUseCalling || !hasActiveCall || !callState) return null;

  const ringing = callState.status === "ringing";
  const waiting = callState.status === "waiting_slot";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-3",
        "rounded-[--radius] border border-border bg-card px-3 py-2 shadow-2xl",
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
        <span className="readout mt-1 truncate text-sm font-semibold leading-none text-foreground">
          {callState.phoneNumber}
        </span>
      </span>

      {callState.status === "answered" && (
        <span className="readout shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
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
