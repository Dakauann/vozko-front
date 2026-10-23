"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState, type ReactNode } from "react";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle, type ElevatedPillOption } from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { X } from "@/components/icons";
import { Slider } from "@/components/ui/slider";
import { expandHex, isHexColor } from "@/lib/email-design/look";
import { runeCount } from "@/lib/email-design/limits";
import { insertAtCaret, type CustomField } from "@/lib/email-design/merge-tags";
import { cn } from "@/lib/utils";

import { MergeTagMenu } from "./merge-tag-menu";

function expandHexOrRaw(value: string): string {
  return isHexColor(value) ? expandHex(value) : value.toLowerCase();
}

export function FieldGroup({ title, children, meta }: { title: string; children: ReactNode; meta?: ReactNode }) {
  return (
    <section className="border-t border-border px-4 pb-4 pt-3 first:border-t-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="legend">{title}</h3>
        {meta}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  fieldKey: string;
  maxLength?: number;
  showCount?: boolean;
  multiline?: boolean;
  rows?: number;
  mergeTags?: readonly CustomField[] | null;
  type?: string;
  inputMode?: "url" | "text" | "email";
  help?: string;
  disabled?: boolean;
}

export function TextField({ label, value, onChange, fieldKey, maxLength, showCount, multiline, rows = 3, mergeTags, type = "text", inputMode, help, disabled }: TextFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const caret = useRef<{ start: number; end: number } | null>(null);

  const remember = () => {
    const element = multiline ? areaRef.current : inputRef.current;
    if (element) caret.current = { start: element.selectionStart ?? value.length, end: element.selectionEnd ?? value.length };
  };

  const insert = (tag: string) => {
    const at = caret.current ?? { start: value.length, end: value.length };
    const next = insertAtCaret(value, at.start, at.end, tag);
    onChange(next.text);
    const element = multiline ? areaRef.current : inputRef.current;
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      element.setSelectionRange(next.caret, next.caret);
    });
  };

  const showMeta = Boolean(mergeTags) || (showCount && maxLength !== undefined) || Boolean(help);
  const common = {
    label,
    value,
    disabled,
    maxLength,
    "data-email-field": fieldKey,
    onSelect: remember,
    onKeyUp: remember,
    onBlur: remember,
  };

  return (
    <div>
      {multiline ? (
        <ElevatedTextarea {...common} ref={areaRef} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <ElevatedInput {...common} ref={inputRef} type={type} inputMode={inputMode} spellCheck={type === "text" && inputMode !== "url"} onChange={(event) => onChange(event.target.value)} />
      )}
      {showMeta ? (
        <div className="mt-1 flex min-h-7 items-center justify-between gap-2">
          {mergeTags ? <MergeTagMenu customFields={mergeTags} onPick={insert} disabled={disabled} align="start" /> : help ? <p className="text-2xs text-muted-foreground">{help}</p> : <span />}
          {showCount && maxLength !== undefined ? (
            <span className="readout text-2xs text-muted-foreground" aria-live="polite">
              {runeCount(value)}/{maxLength}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface ColorFieldProps {
  label: string;
  value: string | undefined;
  inherited: string;
  onChange: (value: string) => void;
  fieldKey: string;
  optional?: boolean;
  disabled?: boolean;
}

export function ColorField({ label, value, inherited, onChange, fieldKey, optional, disabled }: ColorFieldProps) {
  const t = useTranslations("emailEditor.inspector");
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value ?? "");
  const swatch = value !== undefined && isHexColor(value) ? expandHex(value) : inherited;

  const commit = (raw: string) => {
    setDraft(null);
    const trimmed = raw.trim();
    if (trimmed === "") {
      if (optional && value) onChange("");
      return;
    }
    const next = trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex items-center gap-2" data-email-field={fieldKey}>
      <label className="relative inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[--radius] border border-control-edge bg-card focus-within:ring-2 focus-within:ring-ring dark:bg-muted">
        <span aria-hidden className="h-7 w-7 rounded-[4px] border border-border" style={{ backgroundColor: swatch }} />
        <input
          type="color"
          aria-label={t("pickColor", { name: label })}
          value={swatch}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </label>
      <ElevatedInput
        className="min-w-0 flex-1"
        inputClassName="readout uppercase"
        label={label}
        value={shown}
        placeholder={optional ? inherited.toUpperCase() : undefined}
        maxLength={7}
        spellCheck={false}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value);
          const typed = event.target.value.trim();
          const next = typed.startsWith("#") ? typed : `#${typed}`;
          if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next.toLowerCase());
        }}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
        }}
      />
      {optional && value && expandHexOrRaw(value) !== inherited.toLowerCase() ? (
        <button
          type="button"
          aria-label={t("resetColor", { name: label })}
          title={t("resetColor", { name: label })}
          disabled={disabled}
          onClick={() => {
            setDraft(null);
            onChange("");
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
  fieldKey: string;
  disabled?: boolean;
}

export function RangeField({ label, value, min, max, step = 1, unit, onChange, fieldKey, disabled }: RangeFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, Math.round(next / step) * step));
    if (clamped !== value) onChange(clamped);
  };
  const commit = (raw: string) => {
    setDraft(null);
    const parsed = Number(raw.replace(",", "."));
    if (raw.trim() !== "" && Number.isFinite(parsed)) set(parsed);
  };
  return (
    <div data-email-field={fieldKey}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span id={id} className="text-xs font-medium text-foreground">
          {label}
        </span>
        <span className="flex items-center gap-1">
          <ElevatedInput
            aria-labelledby={id}
            type="number"
            inputMode="numeric"
            controlSize="sm"
            className="w-[4.5rem]"
            inputClassName="readout text-right"
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            value={draft ?? String(value)}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit(event.currentTarget.value);
            }}
          />
          <span className="w-5 text-2xs text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider aria-labelledby={id} aria-valuetext={`${value} ${unit}`} value={[value]} min={min} max={max} step={step} disabled={disabled} onValueChange={([next]) => set(next)} />
    </div>
  );
}

export function ChoiceField<T extends string>({ label, options, value, onChange, fieldKey, disabled }: { label: string; options: ElevatedPillOption<T>[]; value: T; onChange: (value: T) => void; fieldKey: string; disabled?: boolean }) {
  return (
    <div data-email-field={fieldKey}>
      <p className="mb-1.5 text-xs font-medium text-foreground">{label}</p>
      <ElevatedPillToggle size="md" aria-label={label} className={cn("w-full [&>button]:flex-1", disabled && "pointer-events-none opacity-60")} options={options} value={value} onChange={onChange} />
    </div>
  );
}

export function SelectField<T extends string>({ label, options, value, onChange, fieldKey, disabled }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; fieldKey: string; disabled?: boolean }) {
  return (
    <div data-email-field={fieldKey}>
      <ElevatedSelect label={label} value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
        {options.map((option) => (
          <ElevatedSelectItem key={option.value} value={option.value}>
            {option.label}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
    </div>
  );
}
