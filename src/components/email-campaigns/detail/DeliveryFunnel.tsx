"use client";

import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import { share } from "@/lib/email-campaigns/format";
import type { Metrics } from "@/lib/email-campaigns/types";

import { EMAIL_SERIES_COLOR, useEmailFormat, type EmailSeries } from "../shared";

interface Stage {
  key: EmailSeries;
  value: number;
  conversion?: number;
}

export function DeliveryFunnel({ metrics, className }: { metrics: Metrics; className?: string }) {
  const t = useTranslations("emailCampaigns.detail.funnel");
  const { number, rate } = useEmailFormat();
  const stages: Stage[] = [
    { key: "sent", value: metrics.sent },
    { key: "delivered", value: metrics.delivered, conversion: metrics.delivery_rate },
    { key: "opens", value: metrics.opens, conversion: metrics.open_rate },
    { key: "clicks", value: metrics.clicks, conversion: metrics.click_to_open_rate },
  ];
  const top = Math.max(1, metrics.sent);

  return (
    <PanelSection boxed className={className} title={t("title")} description={t("description")}>
      <ol className="space-y-1">
        {stages.map((stage, index) => {
          const width = Math.max(share(stage.value, top), stage.value > 0 ? 2 : 0);
          return (
            <li key={stage.key}>
              {index > 0 && stage.conversion !== undefined ? (
                <p className="flex items-center gap-2 py-1 pl-2 text-2xs text-muted-foreground">
                  <span aria-hidden className="h-3 w-px bg-border-strong" />
                  {t(`conversion.${stage.key}`, { rate: rate(stage.conversion) })}
                </p>
              ) : null}
              <div className="flex items-center gap-3">
                <div className="relative h-7 flex-1 overflow-hidden rounded-[--radius] bg-muted">
                  <div className="h-full rounded-[--radius] transition-[width] duration-300 ease-panel" style={{ width: `${width}%`, backgroundColor: EMAIL_SERIES_COLOR[stage.key] }} />
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium text-foreground mix-blend-normal">
                    <span className="rounded-[3px] bg-card/90 px-1.5 py-px">{t(`stages.${stage.key}`)}</span>
                  </span>
                </div>
                <span className="readout w-20 shrink-0 text-right text-sm font-semibold text-foreground">{number(stage.value)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </PanelSection>
  );
}
