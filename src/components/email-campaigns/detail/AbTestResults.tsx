"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Meter } from "@/components/charts/vozko";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { ClockCountdown, Crown } from "@/components/icons";
import { decideAt, remainingSeconds, share, splitDuration } from "@/lib/email-campaigns/format";
import type { ABTest, Metrics, VariantResult } from "@/lib/email-campaigns/types";
import { cn } from "@/lib/utils";

import { useWindowLabel } from "../wizard/AbTestFields";
import { EMAIL_SERIES_COLOR, useEmailFormat } from "../shared";

const TICK_MS = 1000;

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function VariantColumn({
  variant,
  subject,
  result,
  metric,
  winner,
  leading,
}: {
  variant: "a" | "b";
  subject: string;
  result: VariantResult;
  metric: ABTest["winner_metric"];
  winner: boolean;
  leading: boolean;
}) {
  const t = useTranslations("emailCampaigns.detail.ab");
  const { number, locale } = useEmailFormat();
  const percent = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(result.delivered > 0 ? value / result.delivered : 0);
  const rows = [
    { key: "opens" as const, value: result.opens, color: EMAIL_SERIES_COLOR.opens },
    { key: "clicks" as const, value: result.clicks, color: EMAIL_SERIES_COLOR.clicks },
  ];
  return (
    <div className={cn("min-w-0 space-y-3 bg-card px-4 py-4", winner && "shadow-[inset_0_2px_0_0_hsl(var(--primary))]")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="legend">{t(`variant.${variant}`)}</p>
          <p className="mt-0.5 break-words text-sm font-semibold text-foreground">{subject || t("noSubject")}</p>
        </div>
        {winner ? <StatusChip tone="healthy" label={t("winner")} icon={<Crown className="h-3.5 w-3.5" weight="fill" />} /> : leading ? <StatusChip tone="outline" label={t("leading")} /> : null}
      </div>
      <p className="text-2xs text-muted-foreground">{t("delivered", { count: number(result.delivered) })}</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.key} className={cn("space-y-1", row.key === metric ? "" : "opacity-80")}>
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("text-xs", row.key === metric ? "font-semibold text-foreground" : "text-muted-foreground")}>{t(`metrics.${row.key}`)}</span>
              <span className="readout text-sm font-semibold text-foreground">
                {percent(row.value)} <span className="text-2xs font-normal text-muted-foreground">({number(row.value)})</span>
              </span>
            </div>
            <Meter value={share(row.value, result.delivered)} color={row.color} size="sm" label={t(`metrics.${row.key}`)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AbTestResults({ test, subject, metrics, startedAt }: { test: ABTest; subject: string; metrics: Metrics | undefined; startedAt?: string }) {
  const t = useTranslations("emailCampaigns.detail.ab");
  const windowLabel = useWindowLabel();
  const { number } = useEmailFormat();
  const winner = metrics?.winner ?? test.winner;
  const target = decideAt(startedAt, test.decide_after_minutes);
  const now = useNow(!winner && target !== null);
  const left = remainingSeconds(target, now);
  const empty: VariantResult = { delivered: 0, opens: 0, clicks: 0 };
  const a = metrics?.variants?.a ?? empty;
  const b = metrics?.variants?.b ?? empty;
  const rest = metrics?.variants?.winner;
  const hits = (result: VariantResult) => (test.winner_metric === "clicks" ? result.clicks : result.opens);
  const aRate = a.delivered > 0 ? hits(a) / a.delivered : 0;
  const bRate = b.delivered > 0 ? hits(b) / b.delivered : 0;
  const leading = winner ? null : aRate === bRate ? null : aRate > bRate ? "a" : "b";

  let status: string;
  if (winner) status = t("decided", { variant: t(`variant.${winner}`) });
  else if (!startedAt) status = t("notStarted", { window: windowLabel(test.decide_after_minutes) });
  else if (left !== null && left > 0) {
    const { hours, minutes, seconds } = splitDuration(left);
    status = hours > 0 ? t("countdownHours", { hours, minutes }) : t("countdownMinutes", { minutes, seconds });
  } else status = t("deciding");

  return (
    <PanelSection
      boxed
      title={
        <span className="inline-flex items-center gap-1.5">
          {t("title")}
          <ExplainerHint id="emailCampaigns.abTest" />
        </span>
      }
      description={t("rule", { share: test.test_percent, metric: t(`metricsInline.${test.winner_metric}`), window: windowLabel(test.decide_after_minutes) })}
      actions={
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground" aria-live="polite">
          {winner ? <Crown className="h-4 w-4 text-healthy-ink" weight="fill" /> : <ClockCountdown className="h-4 w-4 text-muted-foreground" />}
          <span className="readout">{status}</span>
        </span>
      }
      contentClassName="p-0"
    >
      <div className="grid gap-px bg-border md:grid-cols-2">
        <VariantColumn variant="a" subject={subject} result={a} metric={test.winner_metric} winner={winner === "a"} leading={leading === "a"} />
        <VariantColumn variant="b" subject={test.variant_b_subject} result={b} metric={test.winner_metric} winner={winner === "b"} leading={leading === "b"} />
      </div>
      {rest && rest.delivered > 0 ? (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          {t("rest", { delivered: number(rest.delivered), opens: number(rest.opens), clicks: number(rest.clicks) })}
        </p>
      ) : null}
    </PanelSection>
  );
}
