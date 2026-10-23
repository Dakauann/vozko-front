"use client";

import { useFormatter, useTranslations } from "next-intl";

import { Meter } from "@/components/charts/vozko";
import { Check } from "@/components/icons";
import { ladderSteps, probationDaysLeft, probationShare, type LadderStepState } from "@/lib/email-marketing/ladder";
import type { EmailAccount, EmailProbation } from "@/lib/email-marketing/types";
import { cn } from "@/lib/utils";

const PAD_CLASS: Record<LadderStepState, string> = {
  done: "border-healthy bg-healthy text-healthy-foreground",
  current: "border-primary-edge bg-primary text-primary-foreground",
  next: "border-control-edge bg-card text-muted-foreground",
};

function StepPad({ state, index }: { state: LadderStepState; index: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border-2 text-2xs font-semibold tabular-nums", PAD_CLASS[state])}
    >
      {state === "done" ? <Check className="h-3.5 w-3.5" weight="bold" /> : index + 1}
    </span>
  );
}

export function SendingLadder({ account, compact = false }: { account: EmailAccount; compact?: boolean }) {
  const t = useTranslations("emailMarketing.ladder");
  const steps = ladderSteps(account.mode);

  return (
    <ol aria-label={t("label")} className={cn("grid gap-3", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
      {steps.map((step, index) => (
        <li key={step.mode} aria-current={step.state === "current" ? "step" : undefined} className="relative min-w-0">
          <div className="flex items-center">
            <StepPad state={step.state} index={index} />
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className={cn("ml-1 h-0.5 flex-1", step.state === "done" ? "bg-healthy" : "bg-border-strong")} />
            ) : null}
          </div>
          <p className={cn("mt-2 text-sm font-semibold leading-tight", step.state === "next" ? "text-muted-foreground" : "text-foreground")}>
            {t(`steps.${step.mode}.name`)}
            <span className="sr-only">{`, ${t(`states.${step.state}`)}`}</span>
          </p>
          {compact ? null : <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t(`steps.${step.mode}.text`)}</p>}
        </li>
      ))}
    </ol>
  );
}

export function ProbationProgress({ probation }: { probation: EmailProbation }) {
  const t = useTranslations("emailMarketing.ladder.probation");
  const format = useFormatter();
  const left = probationDaysLeft(probation);
  const targets = probation.targets;
  const percent = (value: number) => format.number(value, { style: "percent", maximumFractionDigits: 2 });
  const readouts = [
    { key: "delivered", value: probation.delivered, detail: t("target", { value: format.number(probation.delivered), target: format.number(targets.min_delivered) }) },
    { key: "hardBounces", value: probation.hard_bounces, detail: t("limit", { limit: percent(targets.max_bounce_per_mil / 1000) }) },
    { key: "complaints", value: probation.complaints, detail: t("limit", { limit: percent(targets.max_complaint_per_10k / 10_000) }) },
  ] as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-foreground">
          <span className="readout font-display text-lg font-semibold">{t("day", { day: probation.days, total: targets.days })}</span>
        </p>
        <p className="text-xs text-muted-foreground">{left > 0 ? t("daysLeft", { count: left }) : t("windowComplete")}</p>
      </div>
      <Meter value={probationShare(probation) * 100} label={t("progressLabel")} size="md" />
      <dl className="grid grid-cols-3 gap-px border border-border bg-border">
        {readouts.map((item) => (
          <div key={item.key} className="min-w-0 bg-card px-3 py-2">
            <dt className="legend truncate">{t(`window.${item.key}`)}</dt>
            <dd className="readout font-display text-base font-semibold text-foreground">{format.number(item.value)}</dd>
            <dd className="readout truncate text-2xs text-muted-foreground">{item.detail}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">{t(`outcomes.${probation.outcome}`, { count: left })}</p>
    </div>
  );
}
