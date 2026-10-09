"use client";

import { useFormatter, useTranslations } from "next-intl";

import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ToneChip } from "@/components/elevated-design/tone-swatch";
import { isFilledValue, optionTone, type CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { calendarDateOf } from "@/lib/leads/detail";

function OptionChip({ field, option }: { field: CustomFieldDefinition; option: string }) {
  const tone = optionTone(field, option);
  if (tone) return <ToneChip tone={tone} label={option} />;
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground">
      <span className="truncate">{option}</span>
    </span>
  );
}

export function CustomFieldValue({ field, value }: { field: CustomFieldDefinition; value: unknown }) {
  const t = useTranslations("customFields.input");
  const format = useFormatter();

  if (!isFilledValue(value)) return <EmptyValue />;

  switch (field.type) {
    case "select":
      return typeof value === "string" ? <OptionChip field={field} option={value} /> : <EmptyValue />;
    case "multiselect":
      return Array.isArray(value) ? (
        <span className="inline-flex flex-wrap justify-end gap-1">
          {value.filter((option): option is string => typeof option === "string").map((option) => (
            <OptionChip key={option} field={field} option={option} />
          ))}
        </span>
      ) : (
        <EmptyValue />
      );
    case "boolean":
      return <span>{value === true ? t("yes") : t("no")}</span>;
    case "number":
      return typeof value === "number" ? <span className="tabular-nums">{format.number(value)}</span> : <span>{String(value)}</span>;
    case "date": {
      const date = typeof value === "string" ? calendarDateOf(value) : null;
      return date ? <span>{format.dateTime(date, { dateStyle: "short", timeZone: "UTC" })}</span> : <span>{String(value)}</span>;
    }
    default:
      return <span className="break-words">{String(value)}</span>;
  }
}
