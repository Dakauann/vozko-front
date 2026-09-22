"use client";

import { useTranslations } from "next-intl";

import type { Period, PeriodPreset } from "@/lib/audience/period";
import { PERIOD_PRESETS } from "@/lib/audience/period";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { cn } from "@/lib/utils";


export function PeriodPicker({
  value,
  onChange,
  className,
}: {
  value: Period;
  onChange: (period: Period) => void;
  className?: string;
}) {
  const t = useTranslations("audience.period");

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <ElevatedSelect
        aria-label={t("label")}
        value={value.preset}
        onValueChange={(preset) => onChange({ ...value, preset: preset as PeriodPreset })}
        className="w-[168px]"
      >
        {PERIOD_PRESETS.map((preset) => (
          <ElevatedSelectItem key={preset} value={preset}>
            {t(`presets.${preset}`)}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>

      {value.preset === "custom" ? (
        <>
          <ElevatedInput
            type="date"
            aria-label={t("from")}
            value={value.from ?? ""}
            max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="w-[150px]"
          />
          <ElevatedInput
            type="date"
            aria-label={t("to")}
            value={value.to ?? ""}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="w-[150px]"
          />
        </>
      ) : null}
    </div>
  );
}
