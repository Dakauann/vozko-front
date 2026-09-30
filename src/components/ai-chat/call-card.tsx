"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Phone } from "@/components/icons";
import { useCallSession } from "@/contexts/call-session-context";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { presetDial, requestCall } from "@/lib/call-session/call-session-control";
import type { CallCard } from "@/lib/aichat/types";
import { cn } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phone/display";

const BUTTON =
  "inline-flex items-center gap-1.5 self-start rounded-[--radius] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-DEFAULT hover:bg-primary-hover active:bg-primary-active disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto";

type Blocker = "noPermission" | "connecting" | "busy";

export function CallCardView({ card }: { card: CallCard }) {
  const t = useTranslations("calling.assistantCard");
  const mayCall = useSettledPermission("sip_trunks", "call");
  const mayUseCalls = useSettledPermission("call_session", "use");
  const { status, callState } = useCallSession();
  const [handedOver, setHandedOver] = useState(false);
  const { phoneNumber, trunkId, trunkName } = card.call;
  const direct = Boolean(trunkId);

  const blocker: Blocker | null =
    !mayCall || !mayUseCalls
      ? "noPermission"
      : !direct
        ? null
        : status !== "connected"
          ? "connecting"
          : callState !== null && callState.status !== "ended"
            ? "busy"
            : null;

  const place = () => {
    if (blocker) return;
    if (trunkId) requestCall({ phoneNumber, trunkId, label: trunkName });
    else presetDial({ phoneNumber });
    setHandedOver(true);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-3.5 shadow-sm" aria-label={t("title")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[--radius] border border-border bg-muted">
            <Phone weight="duotone" className="h-5 w-5 text-primary-ink" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="legend">{t("title")}</p>
            <p className="readout mt-1 truncate text-base font-semibold leading-none text-foreground">{formatPhoneForDisplay(phoneNumber)}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {trunkName ? t("via", { trunk: trunkName }) : t("chooseTrunk")}
            </p>
          </div>
        </div>
        <button type="button" onClick={place} disabled={blocker !== null} className={BUTTON}>
          <Phone weight="fill" className="h-3.5 w-3.5" aria-hidden />
          {t(direct ? "call" : "openDialer")}
        </button>
      </div>
      {blocker || handedOver ? (
        <p
          role="status"
          className={cn(
            "mt-3 border-t border-border pt-3 text-xs",
            blocker ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {t(blocker ?? (direct ? "started" : "handedOver"))}
        </p>
      ) : null}
    </section>
  );
}
