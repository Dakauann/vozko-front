"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ToneSwatch } from "@/components/elevated-design/tone-swatch";
import { CHIP_CHOSEN } from "@/components/ui/button-surfaces";
import { optionTone, toggleChoice, type CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { EMPTY_CHOICE, fromSelectValue } from "@/lib/forms/optional-select";
import { cn } from "@/lib/utils";

export interface CustomFieldInputProps {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export default function CustomFieldInput({ field, value, onChange, error, disabled }: CustomFieldInputProps) {
  const t = useTranslations("customFields.input");
  const inputId = `cf-${field.key}`;
  const groupId = useId();
  const label = field.required ? `${field.label} *` : field.label;
  const options = field.options ?? [];

  if (field.type === "multiselect") {
    const chosen = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        <p id={groupId} className="pl-1 text-sm font-medium text-foreground">
          {label}
        </p>
        <div role="group" aria-labelledby={groupId} aria-describedby={error ? `${groupId}-error` : undefined} className="flex flex-wrap gap-1.5">
          {options.map((option) => {
            const pressed = chosen.includes(option);
            const tone = optionTone(field, option);
            return (
              <button
                key={option}
                type="button"
                aria-pressed={pressed}
                disabled={disabled}
                onClick={() => {
                  const next = toggleChoice(chosen, option, options);
                  onChange(next.length > 0 ? next : undefined);
                }}
                className={cn(
                  "inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors sm:min-h-[28px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  pressed ? CHIP_CHOSEN : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {tone ? <ToneSwatch tone={tone} className="size-2.5" /> : null}
                {option}
              </button>
            );
          })}
        </div>
        <FieldError id={`${groupId}-error`} message={error} />
      </div>
    );
  }

  if (field.type === "select") {
    const current = typeof value === "string" && value ? value : field.required ? "" : EMPTY_CHOICE;
    return (
      <div className="space-y-1.5">
        <ElevatedSelect
          label={label}
          value={current}
          onValueChange={(next) => {
            const chosen = fromSelectValue(next);
            onChange(chosen || undefined);
          }}
          disabled={disabled}
          className="w-full"
        >
          {field.required ? null : <ElevatedSelectItem value={EMPTY_CHOICE}>{t("none")}</ElevatedSelectItem>}
          {options.map((option) => {
            const tone = optionTone(field, option);
            return (
              <ElevatedSelectItem key={option} value={option}>
                <span className="inline-flex items-center gap-2">
                  {tone ? <ToneSwatch tone={tone} className="size-2.5" /> : null}
                  {option}
                </span>
              </ElevatedSelectItem>
            );
          })}
        </ElevatedSelect>
        <FieldError message={error} />
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="space-y-1.5 pl-1">
        <ElevatedSwitch
          id={inputId}
          label={label}
          checked={value === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked)}
        />
        <FieldError message={error} />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div className="space-y-1.5">
        <ElevatedDatePicker
          id={inputId}
          label={label}
          disabled={disabled}
          hasError={!!error}
          value={typeof value === "string" ? value.slice(0, 10) : ""}
          onChange={(next: string) => onChange(next || undefined)}
        />
        <FieldError message={error} />
      </div>
    );
  }

  return (
    <ElevatedInput
      id={inputId}
      label={label}
      variant="outline"
      controlSize="sm"
      type={field.type === "number" ? "number" : "text"}
      inputMode={field.type === "number" ? "decimal" : undefined}
      disabled={disabled}
      error={error}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(event) => {
        const raw = event.target.value;
        if (field.type !== "number") {
          onChange(raw);
          return;
        }
        onChange(raw === "" ? undefined : Number(raw));
      }}
    />
  );
}

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="pl-1 text-xs text-destructive-ink">
      {message}
    </p>
  );
}
