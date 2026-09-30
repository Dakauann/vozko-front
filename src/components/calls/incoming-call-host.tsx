"use client";

import { PhoneDisconnect, PhoneIncoming } from "@/components/icons";
import { useTranslations } from "next-intl";

import { useCallSession } from "@/contexts/call-session-context";
import { useOfferSecondsLeft } from "@/hooks/use-call-clock";
import { formatPhoneForDisplay } from "@/lib/phone/display";

export function IncomingCallHost() {
  const t = useTranslations("calling.incoming");
  const { incomingCall, acceptIncomingCall, declineIncomingCall, callState } = useCallSession();
  const secondsLeft = useOfferSecondsLeft(incomingCall);

  if (!incomingCall) return null;

  const busy = callState !== null && callState.status !== "ended";
  const channel = incomingCall.channel === "sip" ? "sip" : "whatsapp";

  return (
    <div
      role="alertdialog"
      aria-labelledby="incoming-call-title"
      aria-describedby="incoming-call-number"
      className="fixed bottom-20 right-4 z-[66] w-[min(320px,calc(100vw-2rem))] rounded-[--radius] border border-border-strong bg-card p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-primary-ink">
          <PhoneIncoming className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="incoming-call-title" className="legend leading-none">
            {t("title", { channel: t(`channel.${channel}`) })}
          </p>
          <p id="incoming-call-number" className="readout mt-1.5 truncate text-base font-semibold text-foreground">
            {incomingCall.fromNumber ? formatPhoneForDisplay(incomingCall.fromNumber) : t("unknownNumber")}
          </p>
          {secondsLeft !== null ? (
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">{t("expiresIn", { seconds: secondsLeft })}</p>
          ) : null}
          {busy ? <p className="mt-1 text-xs text-warning-ink">{t("busy")}</p> : null}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => declineIncomingCall(incomingCall.offerId)}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[--radius] border border-control-edge text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <PhoneDisconnect className="h-4 w-4" aria-hidden="true" />
          {t("decline")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => acceptIncomingCall(incomingCall.offerId)}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[--radius] bg-primary text-sm font-semibold text-primary-foreground shadow-button transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
        >
          <PhoneIncoming className="h-4 w-4" aria-hidden="true" />
          {t("accept")}
        </button>
      </div>
    </div>
  );
}
