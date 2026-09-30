"use client";

import { useTranslations } from "next-intl";

import { CALL_ACTION, CallContextNote, CallerIdentity } from "@/components/calls/call-card";
import { PhoneDisconnect, PhoneIncoming } from "@/components/icons";
import { useCallSession } from "@/contexts/call-session-context";
import { useOfferRing } from "@/hooks/use-call-clock";
import { callChannelOf } from "@/lib/call-session/channel";
import { cn } from "@/lib/utils";

export function IncomingCallHost() {
  const t = useTranslations("calling.incoming");
  const tt = useTranslations("calling.transfer");
  const { incomingCall, acceptIncomingCall, declineIncomingCall, callState } = useCallSession();
  const { secondsLeft, share } = useOfferRing(incomingCall);

  if (!incomingCall) return null;

  const busy = callState !== null && callState.status !== "ended";
  const channel = callChannelOf(incomingCall.channel);
  const transfer = incomingCall.transfer;
  const resume = incomingCall.resume === true;

  return (
    <div
      role="alertdialog"
      aria-labelledby="incoming-call-title"
      aria-describedby="incoming-call-number"
      className="fixed bottom-20 right-4 z-[66] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-strong bg-card shadow-2xl"
    >
      {share !== null ? (
        <div className="h-1 w-full bg-muted" aria-hidden>
          <div
            className={cn("h-full transition-[width] duration-500 ease-linear", resume ? "bg-warning" : "bg-primary")}
            style={{ width: `${share * 100}%` }}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p id="incoming-call-title" className="legend leading-none">
            {resume ? t("resumeTitle") : channel ? t("title", { channel: t(`channel.${channel}`) }) : t("titlePlain")}
          </p>
          {secondsLeft !== null ? (
            <span className="readout shrink-0 text-xs tabular-nums text-muted-foreground" aria-label={t("expiresIn", { seconds: secondsLeft })}>
              {secondsLeft}s
            </span>
          ) : null}
        </div>

        <CallerIdentity number={incomingCall.fromNumber || null} channel={channel} ringing={!resume} numberId="incoming-call-number" />

        {resume ? <p className="text-xs text-muted-foreground">{t("resumeHint")}</p> : null}
        {transfer ? (
          <CallContextNote
            title={
              transfer.queueName
                ? tt("fromQueue", { queue: transfer.queueName })
                : tt("fromColleague", { name: transfer.fromName ?? tt("colleague") })
            }
            detail={transfer.queueName && transfer.fromName ? tt("sentBy", { name: transfer.fromName }) : null}
            notes={transfer.notes}
          />
        ) : null}
        {busy ? <p className="text-xs text-warning-ink">{t("busy")}</p> : null}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => declineIncomingCall(incomingCall.offerId)}
            className={cn(CALL_ACTION, "border border-destructive text-destructive-ink hover:bg-destructive hover:text-destructive-foreground")}
          >
            <PhoneDisconnect className="h-4 w-4" aria-hidden />
            {t(resume ? "endHeldCall" : "decline")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => acceptIncomingCall(incomingCall.offerId)}
            className={cn(CALL_ACTION, "bg-healthy text-healthy-foreground hover:opacity-90")}
          >
            <PhoneIncoming className="h-4 w-4" aria-hidden />
            {t(resume ? "resume" : "accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
