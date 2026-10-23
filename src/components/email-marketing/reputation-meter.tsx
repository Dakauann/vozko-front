"use client";

import { useFormatter, useTranslations } from "next-intl";

import { CheckCircle, WarningCircle } from "@/components/icons";
import { rateFraction, reputationScale } from "@/lib/email-marketing/figures";
import type { EmailReputationLevel } from "@/lib/email-marketing/types";
import { cn } from "@/lib/utils";

const LEVEL_INK: Record<EmailReputationLevel, string> = {
  ok: "text-healthy-ink",
  warning: "text-warning-ink",
  over: "text-destructive-ink",
};

const LEVEL_FILL: Record<EmailReputationLevel, string> = {
  ok: "bg-healthy",
  warning: "bg-warning",
  over: "bg-destructive",
};

const LEVEL_COPY: Record<EmailReputationLevel, "under" | "near" | "over"> = {
  ok: "under",
  warning: "near",
  over: "over",
};

export function ReputationMeter({ label, rate, warning, limit, level }: { label: string; rate: number; warning: number; limit: number; level: EmailReputationLevel }) {
  const t = useTranslations("emailMarketing.reputation");
  const format = useFormatter();
  const percent = (basisPoints: number) => format.number(rateFraction(basisPoints), { style: "percent", maximumFractionDigits: 2, minimumFractionDigits: 1 });
  const scale = reputationScale(rate, warning, limit);
  const Glyph = level === "ok" ? CheckCircle : WarningCircle;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Glyph aria-hidden="true" weight="fill" className={cn("h-4 w-4", LEVEL_INK[level])} />
          {label}
        </p>
        <p className={cn("readout font-display text-lg font-semibold", level === "over" ? "text-destructive-ink" : "text-foreground")}>{percent(rate)}</p>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(rate, limit)}
        aria-valuetext={t("valueText", { rate: percent(rate), limit: percent(limit) })}
        className="relative h-2 w-full rounded-full bg-muted"
      >
        <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-panel", LEVEL_FILL[level])} style={{ width: `${scale.valueShare * 100}%` }} />
        <span aria-hidden="true" className="absolute -inset-y-1 w-px bg-muted-foreground" style={{ left: `calc(${scale.warningShare * 100}% - 0.5px)` }} />
        <span aria-hidden="true" className="absolute -inset-y-1 w-0.5 rounded-full bg-foreground" style={{ left: `calc(${scale.limitShare * 100}% - 1px)` }} />
      </div>
      <div className="relative h-4 text-2xs text-muted-foreground">
        <span className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums" style={{ left: `${scale.warningShare * 100}%` }}>
          {t("warningMark", { warning: percent(warning) })}
        </span>
        <span className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums" style={{ left: `${scale.limitShare * 100}%` }}>
          {t("limit", { limit: percent(limit) })}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t(LEVEL_COPY[level])}</p>
    </div>
  );
}
