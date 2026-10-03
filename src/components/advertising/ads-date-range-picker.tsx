"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { CalendarBlank, CaretDown } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  RANGE_PRESETS,
  dayToLocalDate,
  earliestDay,
  formatDay,
  localDateToDay,
  previousRange,
  resolveRange,
  type RangePreset,
} from "@/lib/advertising/date-range";
import type { AdRange } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import { useAdsFormat } from "./use-ads-format";

export interface RangeChoice {
  preset: RangePreset;
  custom: AdRange;
  comparing: boolean;
}

function useRangeText() {
  const t = useTranslations("adsManager.range");
  const fmt = useAdsFormat();
  return (range: AdRange) => `${formatDay(range.since, fmt.tag)} ${t("to")} ${formatDay(range.until, fmt.tag)}`;
}

export function AdsDateRangePicker({
  value,
  today,
  timezone,
  onApply,
}: {
  value: RangeChoice;
  today: string | null;
  timezone: string;
  onApply: (choice: RangeChoice) => void;
}) {
  const t = useTranslations("adsManager.range");
  const rangeText = useRangeText();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<RangeChoice>(value);

  const applied = resolveRange(value.preset, value.custom, today);
  const chosen = resolveRange(pending.preset, pending.custom, today);
  const previous = chosen ? previousRange(chosen) : null;
  const from = chosen ? dayToLocalDate(chosen.since) : null;
  const to = chosen ? dayToLocalDate(chosen.until) : null;
  const first = today ? dayToLocalDate(earliestDay(today)) : null;
  const last = today ? dayToLocalDate(today) : null;
  const anchor = to ?? last;
  const firstMonth = anchor ? new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1) : undefined;

  const changeOpen = (next: boolean) => {
    if (next) setPending(value);
    setOpen(next);
  };

  const pickPreset = (preset: RangePreset) => {
    setPending((current) => ({ ...current, preset, custom: preset === "custom" && chosen ? chosen : current.custom }));
  };

  const pickDays = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from) return;
    const since = localDateToDay(range.from);
    const until = localDateToDay(range.to ?? range.from);
    setPending((current) => ({ ...current, preset: "custom", custom: { since, until } }));
  };

  const apply = () => {
    if (!chosen) return;
    onApply(pending);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!today}
          aria-label={t("label")}
          className="inline-flex h-8 max-w-full items-center gap-2 rounded-[--radius] border border-control-edge bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <CalendarBlank className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">
            {t(`presets.${value.preset}`)}
            {applied ? <span className="tabular-nums text-muted-foreground">{`: ${rangeText(applied)}`}</span> : null}
          </span>
          {value.comparing ? <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">{t("compare")}</span> : null}
          <CaretDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(46rem,calc(100vw-2rem))] p-0">
        <div className="flex flex-col sm:flex-row">
          <ul className="flex gap-1 overflow-x-auto border-b border-border p-2 sm:max-h-[26rem] sm:w-48 sm:shrink-0 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r">
            {RANGE_PRESETS.map((preset) => (
              <li key={preset} className="shrink-0">
                <button
                  type="button"
                  onClick={() => pickPreset(preset)}
                  aria-pressed={pending.preset === preset}
                  className={cn(
                    "w-full whitespace-nowrap rounded-[--radius] px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    pending.preset === preset ? "bg-muted font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(`presets.${preset}`)}
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0 flex-1 space-y-3 p-3">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={firstMonth}
              selected={from ? { from, to: to ?? undefined } : undefined}
              onSelect={pickDays}
              disabled={first && last ? [{ before: first }, { after: last }] : undefined}
              className="p-0"
            />
            <p className="text-xs tabular-nums text-muted-foreground">{chosen ? rangeText(chosen) : t("invalid")}</p>
            <div className="space-y-1">
              <ElevatedSwitch
                checked={pending.comparing}
                onCheckedChange={(comparing) => setPending((current) => ({ ...current, comparing }))}
                label={t("compare")}
              />
              {pending.comparing && previous ? (
                <p className="text-xs tabular-nums text-muted-foreground">{t("compareWith", { range: rangeText(previous) })}</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2.5">
          <p className="text-2xs text-muted-foreground">{t("timezone", { timezone: timezone || t("timezoneUnknown") })}</p>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" title={t("cancel")} onClick={() => setOpen(false)} />
            <Button variant="primary" size="sm" title={t("apply")} onClick={apply} disabled={!chosen} />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
