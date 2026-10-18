"use client";

import * as React from "react";
import { CaretDown, Clock, Plus, Trash, Warning } from "@/components/icons";
import { useLocale, useTranslations } from "next-intl";

import { ElevatedSwitch as Switch } from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  WORKING_HOURS_DAY_ORDER,
  WORKING_HOURS_TIMEZONES,
  WORKING_HOURS_WEEKDAYS,
  browserTimezone,
  defaultWorkingHours,
  validateWorkingHours,
  type WorkingHoursDay,
  type WorkingHoursIssue,
  type WorkingHoursSpec,
} from "@/lib/working-hours/types";
import { cn } from "@/lib/utils";

import { useWorkingHoursSummary } from "./use-working-hours-summary";

type WorkingHoursEditorProps = {
  value: WorkingHoursSpec | null;
  onChange: (next: WorkingHoursSpec | null) => void;
  disabled?: boolean;
  offHint: string;
};

type Windows = { start: string; end: string }[];

const NEW_DAY: Windows = [{ start: "09:00", end: "18:00" }];
const NEW_WINDOW = { start: "13:00", end: "18:00" };

export function WorkingHoursEditor({
  value,
  onChange,
  disabled,
  offHint,
}: WorkingHoursEditorProps) {
  const t = useTranslations("workingHours");

  const handleToggle = (on: boolean) => {
    onChange(on ? defaultWorkingHours(browserTimezone()) : null);
  };

  return (
    <div className="space-y-4 rounded-[--radius] border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="pr-4 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-foreground">{t("enableLabel")}</p>
            <ExplainerHint id="settings.workingHours" />
          </div>
          <p className="text-xs text-muted-foreground">
            {value ? t("enableHint") : offHint}
          </p>
        </div>
        <Switch
          checked={!!value}
          onCheckedChange={handleToggle}
          disabled={disabled}
          aria-label={t("enableLabel")}
        />
      </div>

      {value ? <WorkingHoursFields value={value} onChange={onChange} disabled={disabled} /> : null}
    </div>
  );
}

export function CompactWorkingHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: WorkingHoursSpec;
  onChange: (next: WorkingHoursSpec) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("workingHours");
  const summary = useWorkingHoursSummary(value);
  const [editing, setEditing] = React.useState(false);
  const open = editing || validateWorkingHours(value).length > 0;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2">
        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{summary}</span>
        <span className="text-xs text-muted-foreground">{value.timezone.replace(/_/g, " ")}</span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setEditing((current) => !current)}
          className="ml-auto inline-flex items-center gap-1 rounded-[--radius] px-1.5 py-0.5 text-xs font-medium text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {t("editHours")}
          <CaretDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open ? (
        <div className="border-t border-border px-3 py-3">
          <WorkingHoursFields value={value} onChange={(next) => next && onChange(next)} disabled={disabled} dense />
        </div>
      ) : null}
    </div>
  );
}

function WorkingHoursFields({
  value,
  onChange,
  disabled,
  dense = false,
}: {
  value: WorkingHoursSpec;
  onChange: (next: WorkingHoursSpec | null) => void;
  disabled?: boolean;
  dense?: boolean;
}) {
  const t = useTranslations("workingHours");
  const issues = validateWorkingHours(value);

  const patchDay = (day: WorkingHoursDay, windows: Windows) => {
    const days = { ...value.days };
    if (windows.length === 0) {
      delete days[day];
    } else {
      days[day] = windows;
    }
    onChange({ ...value, days });
  };

  const globalIssue = issues.find(
    (i) => i.kind === "noOpenTime" || i.kind === "noTimezone",
  );

  const timezone = (
    <ElevatedSelect
      value={value.timezone}
      onValueChange={(tz) => onChange({ ...value, timezone: tz })}
      disabled={disabled}
      placeholder={t("timezoneLabel")}
    >
      {timezoneOptions(value.timezone).map((tz) => (
        <ElevatedSelectItem key={tz} value={tz}>
          {tz.replace(/_/g, " ")}
        </ElevatedSelectItem>
      ))}
    </ElevatedSelect>
  );

  const applyButton = (
    <button
      type="button"
      disabled={disabled || !firstOpenWeekday(value)}
      onClick={() => onChange(applyToWeekdays(value))}
      className="rounded-[--radius] px-2 py-1 text-xs font-medium text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {t("applyToWeekdays")}
    </button>
  );

  return (
    <div className={dense ? "space-y-3" : "space-y-4"}>
      {dense ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label className="block w-full max-w-xs">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("timezoneLabel")}</span>
            {timezone}
          </label>
          {applyButton}
        </div>
      ) : (
        <>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">
              {t("timezoneLabel")}
            </span>
            {timezone}
            <span className="mt-1 block text-2xs text-muted-foreground">
              {t("timezoneHint")}
            </span>
          </label>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">{t("weekLabel")}</p>
            {applyButton}
          </div>
        </>
      )}

      <div className={dense ? "divide-y divide-border" : "space-y-1.5"}>
        {WORKING_HOURS_DAY_ORDER.map((day) => {
          const Row = dense ? DenseDayRow : DayRow;
          return (
            <Row
              key={day}
              day={day}
              windows={value.days[day] ?? []}
              issues={issues}
              disabled={disabled}
              onChange={(windows) => patchDay(day, windows)}
            />
          );
        })}
      </div>

      {globalIssue ? (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <Warning weight="fill" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {globalIssue.kind === "noTimezone"
              ? t("errors.noTimezone")
              : t("errors.noOpenTime")}
          </span>
        </p>
      ) : null}

      <p className="text-2xs text-muted-foreground">{t("overnightHint")}</p>
    </div>
  );
}

function firstOpenWeekday(spec: WorkingHoursSpec): WorkingHoursDay | null {
  return (
    WORKING_HOURS_WEEKDAYS.find((day) => (spec.days[day] ?? []).length > 0) ?? null
  );
}

function applyToWeekdays(spec: WorkingHoursSpec): WorkingHoursSpec {
  const source = firstOpenWeekday(spec);
  if (!source) return spec;
  const template = spec.days[source] ?? [];
  const days = { ...spec.days };
  for (const day of WORKING_HOURS_WEEKDAYS) {
    days[day] = template.map((w) => ({ ...w }));
  }
  return { ...spec, days };
}

function timezoneOptions(current: string): string[] {
  if (!current || WORKING_HOURS_TIMEZONES.includes(current)) {
    return [...WORKING_HOURS_TIMEZONES];
  }
  return [current, ...WORKING_HOURS_TIMEZONES];
}

type DayRowProps = {
  day: WorkingHoursDay;
  windows: Windows;
  issues: WorkingHoursIssue[];
  disabled?: boolean;
  onChange: (windows: Windows) => void;
};

function useWindowIssue(day: WorkingHoursDay, issues: WorkingHoursIssue[]) {
  const t = useTranslations("workingHours");
  const issueFor = (index: number) =>
    issues.find(
      (i) =>
        (i.kind === "badTime" || i.kind === "emptyWindow" || i.kind === "overlap") &&
        i.day === day &&
        i.index === index,
    );
  const issueText = (issue: WorkingHoursIssue) =>
    issue.kind === "badTime"
      ? t("errors.badTime")
      : issue.kind === "emptyWindow"
        ? t("errors.emptyWindow")
        : t("errors.overlap");
  return { issueFor, issueText };
}

function patchWindow(windows: Windows, index: number, patch: Partial<Windows[number]>): Windows {
  return windows.map((w, i) => (i === index ? { ...w, ...patch } : w));
}

function DayRow({ day, windows, issues, disabled, onChange }: DayRowProps) {
  const t = useTranslations("workingHours");
  const open = windows.length > 0;
  const { issueFor, issueText } = useWindowIssue(day, issues);

  return (
    <div className="rounded-[--radius] border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Switch
          checked={open}
          disabled={disabled}
          onCheckedChange={(on) => onChange(on ? NEW_DAY : [])}
          aria-label={t(`days.${day}`)}
        />
        <span className="w-24 shrink-0 text-sm font-medium text-foreground">
          {t(`days.${day}`)}
        </span>
        {!open ? (
          <span className="text-xs text-muted-foreground">{t("closed")}</span>
        ) : null}
      </div>

      {open ? (
        <div className="mt-2.5 space-y-2 pl-[3.25rem]">
          {windows.map((window, index) => {
            const issue = issueFor(index);
            return (
              <div key={index} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TimeField
                    value={window.start}
                    invalid={!!issue}
                    disabled={disabled}
                    aria-label={t("startLabel")}
                    onChange={(next) => onChange(patchWindow(windows, index, { start: next }))}
                  />
                  <span className="text-xs text-muted-foreground">{t("to")}</span>
                  <TimeField
                    value={window.end}
                    invalid={!!issue}
                    disabled={disabled}
                    aria-label={t("endLabel")}
                    onChange={(next) => onChange(patchWindow(windows, index, { end: next }))}
                  />
                  <RemoveWindow disabled={disabled} onClick={() => onChange(windows.filter((_, i) => i !== index))} />
                </div>
                {issue ? <p className="text-2xs text-destructive">{issueText(issue)}</p> : null}
              </div>
            );
          })}

          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([...windows, NEW_WINDOW])}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-[--radius] px-1 py-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addWindow")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DenseDayRow({ day, windows, issues, disabled, onChange }: DayRowProps) {
  const t = useTranslations("workingHours");
  const locale = useLocale();
  const open = windows.length > 0;
  const { issueFor, issueText } = useWindowIssue(day, issues);
  const rowIssues = windows.map((_, index) => issueFor(index)).filter((issue) => issue !== undefined);

  return (
    <div className="py-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          aria-pressed={open}
          aria-label={t(`days.${day}`)}
          title={t(`days.${day}`)}
          disabled={disabled}
          onClick={() => onChange(open ? [] : NEW_DAY)}
          className={cn(
            "h-7 w-12 shrink-0 rounded-md border text-xs font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
            open ? "border-border-strong bg-card text-foreground shadow-sm" : "border-dashed border-border bg-transparent text-muted-foreground hover:bg-muted",
          )}
        >
          {shortDay(day, locale)}
        </button>
        {open ? (
          <>
            {windows.map((window, index) => (
              <span key={index} className="inline-flex items-center gap-1">
                <TimeField
                  dense
                  value={window.start}
                  invalid={!!issueFor(index)}
                  disabled={disabled}
                  aria-label={t("startLabel")}
                  onChange={(next) => onChange(patchWindow(windows, index, { start: next }))}
                />
                <span className="text-2xs text-muted-foreground">{t("to")}</span>
                <TimeField
                  dense
                  value={window.end}
                  invalid={!!issueFor(index)}
                  disabled={disabled}
                  aria-label={t("endLabel")}
                  onChange={(next) => onChange(patchWindow(windows, index, { end: next }))}
                />
                <RemoveWindow disabled={disabled} onClick={() => onChange(windows.filter((_, i) => i !== index))} />
              </span>
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange([...windows, NEW_WINDOW])}
              aria-label={t("addWindow")}
              title={t("addWindow")}
              className="rounded-[--radius] p-1 text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{t("closed")}</span>
        )}
      </div>
      {rowIssues.map((issue, index) => (
        <p key={index} className="mt-1 pl-[3.75rem] text-2xs text-destructive">{issueText(issue)}</p>
      ))}
    </div>
  );
}

function shortDay(day: WorkingHoursDay, locale: string): string {
  const monday = Date.UTC(2024, 0, 1);
  const offset = WORKING_HOURS_DAY_ORDER.indexOf(day);
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(monday + offset * 86_400_000)).replace(".", "");
}

function RemoveWindow({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  const t = useTranslations("workingHours");
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={t("removeWindow")}
      className="rounded-[--radius] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed"
    >
      <Trash className="h-4 w-4" />
    </button>
  );
}

function TimeField({
  value,
  onChange,
  invalid,
  disabled,
  dense = false,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  dense?: boolean;
}) {
  return (
    <input
      {...rest}
      type="time"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "rounded-[--radius] border bg-card text-foreground outline-none focus:border-primary disabled:cursor-not-allowed",
        dense ? "h-7 w-[5.75rem] px-2 text-xs tabular-nums" : "w-28 px-2.5 py-1.5 text-sm",
        invalid ? "border-destructive" : "border-border",
      )}
    />
  );
}
