"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { AdDayPart } from "@/lib/advertising/draft-types";
import { DAYS, HOURS, gridToSchedule, scheduleToGrid, selectedHours, setCell, setDay, setHour } from "@/lib/advertising/wizard-schedule";
import { cn } from "@/lib/utils";

const SUNDAY = new Date(Date.UTC(2023, 0, 1));

function weekdayNames(locale: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  return DAYS.map((day) => format.format(new Date(SUNDAY.getTime() + day * 86_400_000)));
}

export function ScheduleGrid({ value, onChange }: { value: AdDayPart[]; onChange: (parts: AdDayPart[]) => void }) {
  const t = useTranslations("adsWizard.schedule");
  const locale = useLocale();
  const names = useMemo(() => weekdayNames(locale), [locale]);
  const grid = useMemo(() => scheduleToGrid(value), [value]);
  const [paint, setPaint] = useState<boolean | null>(null);

  const commit = (next: boolean[][]) => onChange(gridToSchedule(next));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto" onPointerUp={() => setPaint(null)} onPointerLeave={() => setPaint(null)}>
        <table className="w-full min-w-[40rem] border-separate border-spacing-0.5 text-2xs tabular-nums text-muted-foreground">
          <thead>
            <tr>
              <th className="w-12" />
              {HOURS.map((hour) => (
                <th key={hour} className="p-0 font-normal">
                  <button
                    type="button"
                    onClick={() => commit(setHour(grid, hour, !DAYS.every((day) => grid[day][hour])))}
                    className="w-full rounded-sm py-0.5 hover:bg-muted hover:text-foreground"
                    aria-label={t("toggleHour", { hour })}
                  >
                    {hour}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day}>
                <th className="p-0 pr-1 text-left font-medium">
                  <button
                    type="button"
                    onClick={() => commit(setDay(grid, day, !grid[day].every(Boolean)))}
                    className="w-full rounded-sm px-1 py-0.5 text-left capitalize hover:bg-muted hover:text-foreground"
                  >
                    {names[day]}
                  </button>
                </th>
                {HOURS.map((hour) => {
                  const on = grid[day][hour];
                  return (
                    <td key={hour} className="p-0">
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={t("cell", { day: names[day], hour })}
                        onPointerDown={() => {
                          setPaint(!on);
                          commit(setCell(grid, day, hour, !on));
                        }}
                        onClick={(event) => {
                          if (event.detail === 0) commit(setCell(grid, day, hour, !on));
                        }}
                        onPointerEnter={() => {
                          if (paint !== null && on !== paint) commit(setCell(grid, day, hour, paint));
                        }}
                        className={cn(
                          "block h-5 w-full rounded-sm border transition-colors",
                          on ? "border-primary-edge bg-primary" : "border-border bg-card hover:bg-muted",
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">{t("selected", { hours: selectedHours(grid) })}</p>
    </div>
  );
}
