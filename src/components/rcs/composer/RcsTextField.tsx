"use client";

import { useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import type { BindingSource } from "@/lib/leads/sends";
import { runeCount } from "@/lib/rcs/limits";
import { insertToken, slotToken } from "@/lib/rcs/variables";
import { cn } from "@/lib/utils";

import { VariableChipRow, VariableMenu, type VariableTools } from "./variable-tools";

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

export function RcsTextField({
  label,
  value,
  onChange,
  max,
  multiline = false,
  placeholder,
  error,
  hint,
  aside,
  variables,
  variableStyle = "menu",
  type = "text",
  inputMode,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  multiline?: boolean;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  aside?: ReactNode;
  variables?: VariableTools | null;
  variableStyle?: "chips" | "menu";
  type?: "text" | "url" | "tel" | "number" | "datetime-local";
  inputMode?: "text" | "url" | "tel" | "decimal";
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("carrierMessaging");
  const ref = useRef<FieldElement | null>(null);
  const touched = useRef(false);

  const insert = (source: BindingSource) => {
    if (!variables) return;
    const element = ref.current;
    const slot = variables.addSource(source);
    const selection = element && touched.current ? { start: element.selectionStart ?? value.length, end: element.selectionEnd ?? value.length } : null;
    const next = insertToken(value, selection, slotToken(slot));
    onChange(next.text);
    requestAnimationFrame(() => {
      const current = ref.current;
      if (!current) return;
      current.focus();
      current.setSelectionRange(next.caret, next.caret);
    });
  };

  const count = runeCount(value);
  const showCounter = max !== undefined;
  const footer = variables || showCounter || hint || aside;

  return (
    <div className={cn("space-y-1.5", className)}>
      {multiline ? (
        <ElevatedTextarea
          ref={(element) => {
            ref.current = element;
          }}
          label={label}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            touched.current = true;
          }}
          maxLength={max}
          error={error}
          disabled={disabled}
          autoResize
          maxHeight={280}
          rows={3}
        />
      ) : (
        <ElevatedInput
          ref={(element) => {
            ref.current = element;
          }}
          label={label}
          value={value}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => {
            touched.current = true;
          }}
          maxLength={max}
          error={error}
          disabled={disabled}
        />
      )}
      {footer ? (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            {variables && variableStyle === "chips" ? <VariableChipRow tools={variables} onInsert={insert} disabled={disabled} /> : null}
            {variables && variableStyle === "menu" ? <VariableMenu tools={variables} onInsert={insert} disabled={disabled} /> : null}
            {hint ? <p className="text-2xs text-muted-foreground">{hint}</p> : null}
          </div>
          {aside ? <div className="shrink-0 pt-0.5">{aside}</div> : null}
          {showCounter && !aside ? (
            <span aria-live="polite" className="readout shrink-0 pt-1 text-2xs tabular-nums text-muted-foreground">
              {t("counter", { count, max })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
