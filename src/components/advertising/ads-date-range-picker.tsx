"use client";

import { useTranslations } from "next-intl";

import { CalendarBlank } from "@/components/icons";
import ElevatedDatePicker from "@/components/elevated-design/elevated-date-picker";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { RANGE_PRESETS, formatDay, type RangePreset } from "@/lib/advertising/date-range";
import type { AdRange } from "@/lib/advertising/types";

import { useAdsFormat } from "./use-ads-format";

export function AdsDateRangePicker({
  preset,
  range,
  custom,
  timezone,
  onPresetChange,
  onCustomChange,
}: {
  preset: RangePreset;
  range: AdRange | null;
  custom: AdRange;
  timezone: string;
  onPresetChange: (preset: RangePreset) => void;
  onCustomChange: (range: AdRange) => void;
}) {
  const t = useTranslations("adsManager.range");
  const fmt = useAdsFormat();

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="w-52">
          <ElevatedSelect
            value={preset}
            onValueChange={(value) => onPresetChange(value as RangePreset)}
            icon={<CalendarBlank className="h-4 w-4" />}
            aria-label={t("label")}
          >
            {RANGE_PRESETS.map((option) => (
              <ElevatedSelectItem key={option} value={option}>
                {t(`presets.${option}`)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
        {preset === "custom" ? (
          <>
            <div className="w-40">
              <ElevatedDatePicker
                id="ads-range-since"
                label={t("since")}
                value={custom.since}
                maxDate={custom.until ? new Date(`${custom.until}T00:00:00`) : undefined}
                onChange={(since) => onCustomChange({ ...custom, since })}
              />
            </div>
            <div className="w-40">
              <ElevatedDatePicker
                id="ads-range-until"
                label={t("until")}
                value={custom.until}
                minDate={custom.since ? new Date(`${custom.since}T00:00:00`) : undefined}
                onChange={(until) => onCustomChange({ ...custom, until })}
              />
            </div>
          </>
        ) : null}
      </div>
      <p className="text-2xs text-muted-foreground tabular-nums">
        {range ? `${formatDay(range.since, fmt.tag)} ${t("to")} ${formatDay(range.until, fmt.tag)} · ` : null}
        {t("timezone", { timezone: timezone || t("timezoneUnknown") })}
      </p>
    </div>
  );
}
