"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { CalendarCheck, CheckCircle, PaperPlaneRight, PaperPlaneTilt } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { defaultScheduleValue, isoFromZonedInput, zonedInputFromIso, zonedInputValue } from "@/lib/campaign-wizard/schedule";
import type { SendMode } from "@/lib/campaign-wizard/steps";
import { cn } from "@/lib/utils";

export type { SendMode } from "@/lib/campaign-wizard/steps";

export interface SendSummaryRow {
  label: string;
  value: ReactNode;
}

export interface SendRefusal {
  key: string;
  text: string;
}

export interface SendConfirmCopy {
  title: string;
  body: string;
}

export interface SendStepConfirm {
  now: SendConfirmCopy;
  schedule: (scheduledIso: string | null) => SendConfirmCopy;
  note?: ReactNode;
}

export interface SendStepProps {
  timeZone: string;
  scheduledAt: string | null;
  scheduled: boolean;
  blocking: number | null;
  can: Record<SendMode, boolean>;
  startAllowed: boolean;
  launching: boolean;
  refused: readonly SendRefusal[];
  summary: readonly SendSummaryRow[];
  confirm: SendStepConfirm;
  notice?: ReactNode;
  scheduleExtra?: ReactNode;
  hideScheduleInput?: boolean;
  scheduleIncomplete?: boolean;
  onModeChange?: (mode: SendMode) => void;
  onLaunch: (scheduledAt: string | null) => Promise<boolean>;
  onReady: () => Promise<boolean>;
}

function Choice({ selected, onSelect, icon, title, body, disabled }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; body: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "border-primary-edge bg-card shadow-[inset_0_0_0_1px_hsl(var(--primary-edge))]" : "border-border bg-card hover:bg-muted",
      )}
    >
      <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-primary-edge" : "border-control-edge")} aria-hidden>
        {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}

export function SendStep({
  timeZone,
  scheduledAt,
  scheduled,
  blocking,
  can,
  startAllowed,
  launching,
  refused,
  summary,
  confirm,
  notice,
  scheduleExtra,
  hideScheduleInput = false,
  scheduleIncomplete = false,
  onModeChange,
  onLaunch,
  onReady,
}: SendStepProps) {
  const t = useTranslations("campaignWizard.send");
  const [mode, setMode] = useState<SendMode>(scheduled ? "schedule" : "now");
  const [when, setWhen] = useState(() => (scheduledAt ? zonedInputFromIso(scheduledAt, timeZone) : defaultScheduleValue(new Date(), timeZone)));
  const [confirming, setConfirming] = useState(false);
  const ready = blocking === 0;
  const scheduledIso = mode === "schedule" && !hideScheduleInput ? isoFromZonedInput(when, timeZone) : null;
  const scheduleMissing = mode === "schedule" && (hideScheduleInput ? scheduleIncomplete : !scheduledIso);
  const canStart = can[mode];
  const choose = (next: SendMode) => {
    setMode(next);
    onModeChange?.(next);
  };
  const confirmCopy = mode === "now" ? confirm.now : confirm.schedule(scheduledIso);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {notice}

        <div role="radiogroup" aria-label={t("mode")} className="grid gap-3 sm:grid-cols-3">
          <Choice selected={mode === "now"} onSelect={() => choose("now")} icon={<PaperPlaneTilt className="h-4 w-4 text-muted-foreground" />} title={t("now.title")} body={t("now.body")} />
          <Choice selected={mode === "schedule"} onSelect={() => choose("schedule")} icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />} title={t("schedule.title")} body={t("schedule.body")} />
          <Choice selected={mode === "ready"} onSelect={() => choose("ready")} icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />} title={t("ready.title")} body={t("ready.body")} />
        </div>

        {mode === "schedule" && !hideScheduleInput ? (
          <div className="max-w-sm space-y-1">
            <ElevatedInput
              type="datetime-local"
              label={t("schedule.when")}
              value={when}
              min={zonedInputValue(new Date(), timeZone)}
              onChange={(event) => setWhen(event.target.value)}
              icon={<CalendarCheck className="h-5 w-5" />}
            />
            <p className="px-1 text-2xs text-muted-foreground">{t("schedule.zone", { zone: timeZone })}</p>
          </div>
        ) : null}

        {mode === "schedule" && scheduleExtra ? scheduleExtra : null}

        {refused.length > 0 ? (
          <Notice tone="fault" title={t("refused")}>
            <ul className="list-disc space-y-0.5 pl-4">
              {refused.map((issue) => (
                <li key={issue.key}>{issue.text}</li>
              ))}
            </ul>
          </Notice>
        ) : null}

        {!ready && blocking !== null ? (
          <Notice tone="warning" title={t("notReady.title")}>
            <p>{t("notReady.body", { count: blocking })}</p>
          </Notice>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            variant="primary"
            size="lg"
            title={launching ? t("launching") : mode === "now" ? t("now.action") : mode === "ready" ? t("ready.action") : scheduled ? t("schedule.reschedule") : t("schedule.action")}
            icon={<PaperPlaneRight className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            disabled={!canStart || !ready || launching || scheduleMissing}
            onClick={() => (mode === "ready" ? void onReady() : setConfirming(true))}
          />
          {!startAllowed ? <span className="text-2xs text-muted-foreground">{t("noPermission")}</span> : null}
        </div>
      </div>

      <aside className="h-fit rounded-lg border border-border bg-card" aria-label={t("summaryTitle")}>
        <p className="legend border-b border-border px-4 py-2">{t("summaryTitle")}</p>
        <dl className="divide-y divide-border">
          {summary.map((row) => (
            <div key={row.label} className="px-4 py-2.5">
              <dt className="text-2xs text-muted-foreground">{row.label}</dt>
              <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </aside>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="default"
        icon={mode === "now" ? <PaperPlaneTilt size={28} /> : <CalendarCheck size={28} />}
        title={confirmCopy.title}
        description={confirmCopy.body}
        confirmLabel={mode === "now" ? t("confirm.nowAction") : t("confirm.scheduleAction")}
        onConfirm={async () => {
          await onLaunch(scheduledIso);
        }}
      >
        {confirm.note}
      </ConfirmDialog>
    </div>
  );
}
