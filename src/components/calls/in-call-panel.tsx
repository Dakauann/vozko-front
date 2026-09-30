"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { CallTransferPanel } from "@/components/calls/call-transfer-panel";
import {
  ArrowsLeftRight,
  Microphone,
  MicrophoneSlash,
  PhoneDisconnect,
  SpinnerGap,
} from "@/components/icons";
import { useCallSession } from "@/contexts/call-session-context";
import { formatCallDuration, useCallElapsedSeconds } from "@/hooks/use-call-clock";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { transferErrorCode } from "@/lib/call-session/transfer";
import { callOutcome } from "@/lib/dialer/dial-string";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { cn } from "@/lib/utils";

const CONTROL =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[--radius] text-sm font-semibold transition-colors duration-DEFAULT focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

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

  return (
    <div className="flex flex-col items-center px-4 pb-5 pt-6 text-center" role="status" aria-live="polite">
      <span className="legend">
        {status}
        {via ? ` · ${via}` : ""}
      </span>
      <span className="readout mt-2 max-w-full truncate text-2xl font-semibold tracking-wide text-foreground">
        {formatPhoneForDisplay(callState.phoneNumber)}
      </span>
      <span className="mt-1.5 flex h-5 items-center">
        {answered ? (
          <span className="readout text-sm tabular-nums text-muted-foreground">{formatCallDuration(elapsed)}</span>
        ) : connecting ? (
          <SpinnerGap className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </span>

      {live && transferredBy ? (
        <div className="mt-4 w-full rounded-[--radius] border border-border bg-muted px-3 py-2 text-left">
          <p className="legend leading-none">
            {transferredBy.queueName
              ? tt("fromQueue", { queue: transferredBy.queueName })
              : tt("fromColleague", { name: transferredBy.fromName ?? tt("colleague") })}
          </p>
          {transferredBy.notes ? <p className="mt-1.5 whitespace-pre-wrap text-xs text-foreground">{transferredBy.notes}</p> : null}
        </div>
      ) : null}
      {answered && transfer?.status === "returned" ? (
        <p role="status" className="mt-3 text-xs text-warning-ink">
          {tt(`returned.${transfer.reason === "declined" || transfer.reason === "cancelled" ? transfer.reason : "no_answer"}`)}
        </p>
      ) : null}
      {transferError ? (
        <p role="alert" className="mt-3 text-xs text-destructive-ink">
          {tt(`errors.${transferError}`)}
        </p>
      ) : null}

      {live ? (
        <div className={cn("mt-6 grid w-full gap-2", mayTransfer ? "grid-cols-3" : "grid-cols-2")}>
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            aria-pressed={muted}
            disabled={!answered}
            className={cn(
              CONTROL,
              "border",
              muted ? "border-foreground bg-foreground text-background" : "border-control-edge text-foreground hover:bg-muted",
            )}
          >
            {muted ? <MicrophoneSlash className="h-4 w-4" /> : <Microphone className="h-4 w-4" />}
            {t(muted ? "unmute" : "mute")}
          </button>
          {mayTransfer ? (
            <button
              type="button"
              onClick={() => {
                clearError();
                setTransferOpen(true);
              }}
              disabled={!answered}
              className={cn(CONTROL, "border border-control-edge text-foreground hover:bg-muted")}
            >
              <ArrowsLeftRight className="h-4 w-4" aria-hidden />
              {tt("open")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={endCall}
            className={cn(CONTROL, "bg-destructive text-destructive-foreground hover:opacity-90")}
          >
            <PhoneDisconnect className="h-4 w-4" aria-hidden />
            {t("hangUp")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
