"use client";

import { useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import type { SeriesSibling } from "@/lib/unofficial-whatsapp-groups/types";

import { seriesRenames } from "./series-model";

export function SeriesApplyToggle({
  series,
  checked,
  onChange,
  renamesSubject,
  baseName,
  explainer,
  disabled,
}: {
  series: SeriesSibling[];
  checked: boolean;
  onChange: (v: boolean) => void;
  renamesSubject?: boolean;
  baseName?: string;
  explainer?: ReactNode;
  disabled?: boolean;
}) {
  const t = useTranslations("unofficialGroups.kit.series");
  const id = useId();
  if (series.length < 2) return null;
  const name = baseName?.trim() ?? "";
  const renames = renamesSubject && checked && name ? seriesRenames(name, series) : [];
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <label htmlFor={id} className="cursor-pointer text-xs font-semibold text-foreground">
              {t("apply", { count: series.length })}
            </label>
            {explainer}
          </div>
          <p className="mt-0.5 text-2xs text-muted-foreground">{t("hint")}</p>
        </div>
      </div>
      {renames.length > 0 ? (
        <div className="ml-6 space-y-1">
          <p className="text-2xs font-semibold text-muted-foreground">{t("renames")}</p>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {renames.map((rename) => (
              <li key={rename.groupId} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-2 text-2xs">
                <span className="truncate text-muted-foreground" title={rename.from}>
                  {rename.from}
                </span>
                <span aria-hidden className="text-muted-foreground">
                  →
                </span>
                <span className="readout truncate font-semibold text-foreground" title={rename.to}>
                  {rename.to}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
