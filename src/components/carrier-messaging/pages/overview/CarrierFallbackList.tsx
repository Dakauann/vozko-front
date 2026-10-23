"use client";

import { useTranslations } from "next-intl";

import { Meter } from "@/components/charts/vozko";
import type { CarrierStat } from "@/lib/carrier-messaging/analytics";

import { useCountText, useRateText } from "./carrier-query";

export function CarrierFallbackList({ carriers }: { carriers: readonly CarrierStat[] }) {
  const t = useTranslations("carrierMessaging.pages.overview.carriers");
  const count = useCountText();
  const rate = useRateText();
  if (carriers.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-sm">
        <caption className="sr-only">{t("caption")}</caption>
        <thead>
          <tr className="border-b border-border text-left text-2xs font-semibold text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-semibold">{t("operator")}</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">{t("sent")}</th>
            <th scope="col" className="py-2 pr-3 text-right font-semibold">{t("delivered")}</th>
            <th scope="col" className="w-[38%] py-2 font-semibold">{t("fallback")}</th>
          </tr>
        </thead>
        <tbody>
          {carriers.map((carrier) => (
            <tr key={carrier.operator || "unknown"} className="border-b border-border last:border-0">
              <th scope="row" className="py-2.5 pr-3 text-left font-medium text-foreground">{carrier.operator || t("unknown")}</th>
              <td className="readout py-2.5 pr-3 text-right tabular-nums">{count(carrier.sent)}</td>
              <td className="readout py-2.5 pr-3 text-right tabular-nums">{count(carrier.delivered)}</td>
              <td className="py-2.5">
                <span className="flex items-center gap-2.5">
                  <Meter value={(carrier.fallback_rate ?? 0) * 100} color="hsl(var(--chart-4))" label={t("fallbackOf", { operator: carrier.operator || t("unknown") })} />
                  <span className="readout w-14 shrink-0 text-right text-sm font-semibold tabular-nums">{rate(carrier.fallback_rate)}</span>
                </span>
                <span className="mt-0.5 block text-2xs text-muted-foreground">{t("fellBack", { count: carrier.fell_back })}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
