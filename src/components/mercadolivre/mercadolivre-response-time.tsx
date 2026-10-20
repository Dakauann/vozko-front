"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getMercadoLivreResponseTimeAction } from "@/app/actions/mercadolivre";
import { Clock } from "@/components/icons";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { durationParts, responseTimeSlots } from "@/lib/mercadolivre/questions";
import type { MercadoLivreResponseTime } from "@/lib/mercadolivre/types";

type LoadState = { status: "loading" } | { status: "failed" } | { status: "ready"; responseTime: MercadoLivreResponseTime };

function useResponseDuration() {
  const t = useTranslations("mercadolivre.questions.responseTime");
  return useCallback(
    (total: number) => {
      const { days, hours, minutes } = durationParts(total);
      const parts: string[] = [];
      if (days > 0) parts.push(t("days", { count: days }));
      if (hours > 0) parts.push(t("hours", { count: hours }));
      if (minutes > 0 || parts.length === 0) parts.push(t("minutes", { count: minutes }));
      return parts.join(" ");
    },
    [t],
  );
}

export function MercadoLivreResponseTime({ accountId }: { accountId: string }) {
  const t = useTranslations("mercadolivre.questions.responseTime");
  const duration = useResponseDuration();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void getMercadoLivreResponseTimeAction(accountId).then((result) => {
      if (cancelled) return;
      setState("error" in result ? { status: "failed" } : { status: "ready", responseTime: result.responseTime });
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const slots = state.status === "ready" ? responseTimeSlots(state.responseTime) : [];

  return (
    <ElevatedContainer className="space-y-3 p-5">
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
      </div>

      {state.status === "loading" ? <div className="h-12 animate-pulse rounded-[--radius] bg-muted" /> : null}
      {state.status === "failed" ? <p className="text-xs text-muted-foreground">{t("loadFailed")}</p> : null}
      {state.status === "ready" && slots.length === 0 ? <p className="text-sm text-muted-foreground">{t("unavailable")}</p> : null}

      {slots.length > 0 ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {slots.map((slot) => (
            <div key={slot.key} className="min-w-0 rounded-[--radius] border border-border p-3">
              <dt className="truncate text-2xs text-muted-foreground">{t(`slot.${slot.key}`)}</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">{duration(slot.minutes)}</dd>
              {slot.salesPercentIncrease !== undefined ? (
                <dd className="mt-0.5 text-2xs text-muted-foreground">{t("salesIncrease", { percent: slot.salesPercentIncrease })}</dd>
              ) : null}
            </div>
          ))}
        </dl>
      ) : null}
    </ElevatedContainer>
  );
}
