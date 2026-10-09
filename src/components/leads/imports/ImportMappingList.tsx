"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import {
  ElevatedSelect,
  ElevatedSelectGroup,
  ElevatedSelectItem,
  ElevatedSelectLabel,
} from "@/components/elevated-design/elevated-select";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { groupImportFields, recognisedColumnCount, type LeadImportJob } from "@/lib/leads/imports";
import { cn } from "@/lib/utils";

import {
  importColumnName,
  importFieldLabel,
  importGroupLabel,
  importRequiresLabel,
  type ImportTranslator,
} from "./import-messages";

export const NO_IMPORT_FIELD = "__none";

function sampleOf(job: LeadImportJob, index: number): string {
  for (const row of job.preview.sample) {
    const value = row[index]?.trim();
    if (value) return value;
  }
  return "";
}

export function ImportMappingList({
  job,
  mapping,
  onAssign,
  errorColumn,
  disabled,
}: {
  job: LeadImportJob;
  mapping: readonly string[];
  onAssign: (index: number, field: string) => void;
  errorColumn: number | null;
  disabled?: boolean;
}) {
  const t = useTranslations("leadsPage.import") as unknown as ImportTranslator;
  const groups = useMemo(() => groupImportFields(job.fields), [job.fields]);
  const headers = job.preview.headers;

  return (
    <section className="space-y-2" aria-label={t("mapping.title")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("mapping.title")}</h3>
        <p className="text-xs tabular-nums text-muted-foreground">
          {t("mapping.recognised", { count: recognisedColumnCount(mapping), total: headers.length })}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{t("mapping.help")}</p>
      <ul className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
        {headers.map((_, index) => {
          const column = importColumnName(t, headers, index);
          const sample = sampleOf(job, index);
          const field = mapping[index] ?? "";
          return (
            <li
              key={index}
              data-column={index}
              className={cn(
                "grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-2 rounded-[--radius] px-1.5 py-1",
                errorColumn === index && "bg-muted shadow-[inset_0_-2px_0_0_hsl(var(--destructive))]",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-foreground" title={column}>
                  {column}
                </p>
                <p className="truncate text-2xs text-muted-foreground" title={sample || undefined}>
                  {sample || <EmptyValue />}
                </p>
              </div>
              <ElevatedSelect
                value={field || NO_IMPORT_FIELD}
                onValueChange={(value) => onAssign(index, value === NO_IMPORT_FIELD ? "" : value)}
                disabled={disabled}
                aria-label={t("mapping.choose", { column })}
              >
                <ElevatedSelectItem value={NO_IMPORT_FIELD}>{t("mapping.none")}</ElevatedSelectItem>
                {groups.map((group) => (
                  <ElevatedSelectGroup key={group.group}>
                    <ElevatedSelectLabel>{importGroupLabel(t, group.group)}</ElevatedSelectLabel>
                    {group.fields.map((option) => (
                      <ElevatedSelectItem
                        key={option.key}
                        value={option.key}
                        disabled={!option.allowed}
                        description={
                          !option.allowed
                            ? importRequiresLabel(t, option.requires)
                            : option.sensitive
                              ? t("mapping.sensitive")
                              : undefined
                        }
                      >
                        {importFieldLabel(t, option.key, job.fields)}
                      </ElevatedSelectItem>
                    ))}
                  </ElevatedSelectGroup>
                ))}
              </ElevatedSelect>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
