"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { CALL_ACTION, CallContextNote, CallControl, CallerIdentity, CallStatusLine } from "@/components/calls/call-card";
import { CallTransferPanel } from "@/components/calls/call-transfer-panel";
import { ArrowsLeftRight, Microphone, MicrophoneSlash, PhoneDisconnect, SpinnerGap } from "@/components/icons";
import { useCallSession } from "@/contexts/call-session-context";
import { formatCallDuration, useCallElapsedSeconds } from "@/hooks/use-call-clock";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { transferErrorCode } from "@/lib/call-session/transfer";
import { callOutcome } from "@/lib/dialer/dial-string";
import { cn } from "@/lib/utils";

export function InCallPanel({ via }: { via?: string | null }) {
  const t = useTranslations("calling.dialer");
  const tt = useTranslations("calling.transfer");
  const { callState, endCall, muted, setMuted, transfer, lastErrorCode, clearError } = useCallSession();
  const mayTransfer = useSettledPermission("call_session", "transfer");
  const [transferOpen, setTransferOpen] = useState(false);
  const elapsed = useCallElapsedSeconds(callState);

  if (!callState) return null;

  const live = callState.status !== "ended";
  const answered = callState.status === "answered";
  const connecting = callState.status === "ringing" || callState.status === "waiting_slot";
  const transferredBy = callState.transferredBy;
  const transferError = answered ? transferErrorCode(lastErrorCode) : null;

  if (answered && mayTransfer && (transferOpen || transfer?.status === "ringing")) {
    return <CallTransferPanel onClose={() => setTransferOpen(false)} />;
  }

  const status = !live
    ? t(`outcome.${callOutcome(callState.reason)}`)
    : t(answered ? "inCall" : callState.status === "waiting_slot" ? "waitingSlot" : "ringing");
  const clock = answered ? (
    formatCallDuration(elapsed)
  ) : connecting ? (
    <SpinnerGap className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
  ) : callState.durationSeconds ? (
    formatCallDuration(callState.durationSeconds)
  ) : null;

  return (
    <div className="flex flex-col gap-3 px-4 pb-4 pt-4" role="status" aria-live="polite">
      <CallerIdentity number={callState.phoneNumber} channel={callState.channel ?? null} via={via} ringing={connecting} />
      <CallStatusLine tone={answered ? "live" : live ? "pending" : "ended"} label={status} trailing={clock} />

      {live && transferredBy ? (
        <CallContextNote
          title={
            transferredBy.queueName
              ? tt("fromQueue", { queue: transferredBy.queueName })
              : tt("fromColleague", { name: transferredBy.fromName ?? tt("colleague") })
          }
          detail={transferredBy.queueName && transferredBy.fromName ? tt("sentBy", { name: transferredBy.fromName }) : null}
          notes={transferredBy.notes}
        />
      ) : null}
      {answered && transfer?.status === "returned" ? (
        <p role="status" className="text-xs text-warning-ink">
          {tt(`returned.${transfer.reason === "declined" || transfer.reason === "cancelled" ? transfer.reason : "no_answer"}`)}
        </p>
      ) : null}
      {transferError ? (
        <p role="alert" className="text-xs text-destructive-ink">
          {tt(`errors.${transferError}`)}
        </p>
      ) : null}

      {live ? (
        <>
          <div className={cn("grid gap-2 pt-1", mayTransfer ? "grid-cols-2" : "grid-cols-1")}>
            <CallControl
              icon={muted ? <MicrophoneSlash /> : <Microphone />}
              label={t(muted ? "unmute" : "mute")}
              onClick={() => setMuted(!muted)}
              pressed={muted}
              disabled={!answered}
            />
            {mayTransfer ? (
              <CallControl
                icon={<ArrowsLeftRight />}
                label={tt("open")}
                onClick={() => {
                  clearError();
                  setTransferOpen(true);
                }}
                disabled={!answered}
              />
            ) : null}
          </div>
          <button type="button" onClick={endCall} className={cn(CALL_ACTION, "bg-destructive text-destructive-foreground hover:opacity-90")}>
            <PhoneDisconnect className="h-4 w-4" aria-hidden />
            {t("hangUp")}
          </button>
        </>
      ) : null}
    </div>
  );
}
