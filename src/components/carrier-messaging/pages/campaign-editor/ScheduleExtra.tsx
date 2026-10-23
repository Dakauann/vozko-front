"use client";

import { useLocale, useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ArrowsClockwise, CalendarBlank } from "@/components/icons";
import { RECURRENCE_FREQUENCIES, type CampaignDraft, type CampaignRecurrence, type RecurrenceFrequency } from "@/lib/carrier-messaging/campaigns";
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "@/lib/format/local-datetime";
import { WORKING_HOURS_TIMEZONES } from "@/lib/working-hours/types";
import { cn } from "@/lib/utils";

import { useScheduleSummary, weekdayName } from "../../shared/schedule-summary";
import { scheduleModeOf, withScheduleMode, type ScheduleMode } from "./editor-state";

type ScheduledMode = Exclude<ScheduleMode, "now">;

const MODES: readonly ScheduledMode[] = ["once", "recurring"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function localValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : toLocalDateTimeInput(date);
}

function withUntil(recurrence: CampaignRecurrence, until: string): CampaignRecurrence {
  const next: CampaignRecurrence = { frequency: recurrence.frequency, time: recurrence.time, timezone: recurrence.timezone };
  if (recurrence.weekdays) next.weekdays = recurrence.weekdays;
  if (recurrence.day_of_month !== undefined) next.day_of_month = recurrence.day_of_month;
  if (until) next.until = until;
  return next;
}

function toggleDay(days: readonly number[], day: number): number[] {
  return days.includes(day) ? days.filter((current) => current !== day) : [...days, day].sort((a, b) => a - b);
}

function RecurrenceFields({ recurrence, onChange }: { recurrence: CampaignRecurrence; onChange: (next: CampaignRecurrence) => void }) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.schedule");
  const locale = useLocale();
  const timezones = WORKING_HOURS_TIMEZONES.includes(recurrence.timezone) ? WORKING_HOURS_TIMEZONES : [recurrence.timezone, ...WORKING_HOURS_TIMEZONES];
  const setFrequency = (frequency: RecurrenceFrequency) => {
    const base: CampaignRecurrence = { frequency, time: recurrence.time, timezone: recurrence.timezone, ...(recurrence.until ? { until: recurrence.until } : {}) };
    if (frequency === "weekly") base.weekdays = recurrence.weekdays?.length ? recurrence.weekdays : [1];
    if (frequency === "monthly") base.day_of_month = recurrence.day_of_month ?? 1;
    onChange(base);
  };
  return (
    <div className="space-y-4 rounded-[--radius] border border-border bg-card p-4">
      <ElevatedPillToggle<RecurrenceFrequency>
        size="md"
        aria-label={t("frequency")}
        value={recurrence.frequency}
        onChange={setFrequency}
        options={RECURRENCE_FREQUENCIES.map((value) => ({ value, label: t(`frequencies.${value}`) }))}
      />
      {recurrence.frequency === "weekly" ? (
        <div role="group" aria-label={t("weekdays")} className="flex flex-wrap gap-1.5">
          {WEEK_ORDER.map((day) => {
            const on = (recurrence.weekdays ?? []).includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={weekdayName(locale, day, "long")}
                onClick={() => onChange({ ...recurrence, weekdays: toggleDay(recurrence.weekdays ?? [], day) })}
                className={cn(
                  "h-9 min-w-11 rounded-full border px-3 text-xs font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-control-edge bg-card text-foreground hover:bg-muted",
                )}
              >
                {weekdayName(locale, day)}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {recurrence.frequency === "monthly" ? (
          <ElevatedInput
            label={t("dayOfMonth")}
            type="number"
            min={1}
            max={31}
            value={recurrence.day_of_month ?? ""}
            onChange={(event) => onChange({ ...recurrence, day_of_month: event.target.value === "" ? undefined : Number(event.target.value) })}
          />
        ) : null}
        <ElevatedInput label={t("time")} type="time" value={recurrence.time} onChange={(event) => onChange({ ...recurrence, time: event.target.value })} />
        <ElevatedInput
          label={t("until")}
          type="date"
          value={recurrence.until ?? ""}
          onChange={(event) => onChange(withUntil(recurrence, event.target.value))}
        />
      </div>
      <ElevatedSelect label={t("timezone")} aria-label={t("timezone")} value={recurrence.timezone} onValueChange={(timezone) => onChange({ ...recurrence, timezone })}>
        {timezones.map((zone) => (
          <ElevatedSelectItem key={zone} value={zone}>
            {zone.replaceAll("_", " ")}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
    </div>
  );
}

export function ScheduleExtra({ draft, onChange, timezone }: { draft: CampaignDraft; onChange: (draft: CampaignDraft) => void; timezone: string }) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.schedule");
  const tSend = useTranslations("carrierMessaging.pages.campaignEditor.send");
  const summaryOf = useScheduleSummary();
  const current = scheduleModeOf(draft);
  const mode: ScheduledMode = current === "recurring" ? "recurring" : "once";
  const summary = summaryOf(draft);
  const icons = { once: CalendarBlank, recurring: ArrowsClockwise };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <ElevatedPillToggle<ScheduledMode>
        size="md"
        aria-label={tSend("scheduleKind")}
        value={mode}
        onChange={(next) => onChange(withScheduleMode(draft, next, timezone))}
        options={MODES.map((value) => {
          const Glyph = icons[value];
          return { value, label: t(`modes.${value}`), icon: <Glyph aria-hidden className="h-3.5 w-3.5" /> };
        })}
      />
      <p className="text-xs text-muted-foreground">{t(`modeHints.${mode}`)}</p>
      {mode === "once" ? (
        <ElevatedInput
          label={t("at")}
          type="datetime-local"
          value={localValue(draft.scheduled_at)}
          onChange={(event) => onChange({ ...draft, scheduled_at: fromLocalDateTimeInput(event.target.value)?.toISOString() ?? null })}
          className="max-w-xs"
        />
      ) : null}
      {mode === "recurring" && draft.recurrence ? <RecurrenceFields recurrence={draft.recurrence} onChange={(recurrence) => onChange({ ...draft, recurrence })} /> : null}
      {summary ? <p className="text-sm font-medium text-foreground">{summary}</p> : <p className="text-xs text-muted-foreground">{tSend("scheduleMissing")}</p>}
      <p className="text-xs text-muted-foreground">{t("quietHoursHint")}</p>
    </div>
  );
}
