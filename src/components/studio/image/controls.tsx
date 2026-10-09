"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { CircleNotch, Info, WarningCircle } from "@/components/icons";
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from "@/components/ui/button-surfaces";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { swatchOf, typedColor, withSwatch } from "@/lib/studio/color";
import { clampTo, type Range } from "@/lib/studio/layer-ranges";
import { cn } from "@/lib/utils";

export const FIELD_CLASS =
  "readout h-7 w-full min-w-0 rounded-[--radius] border border-control-edge bg-card px-2 text-xs text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-muted";

export const LABEL_CLASS = "w-24 shrink-0 text-2xs text-muted-foreground";

const BUTTON_BASE =
  "inline-flex h-7 min-w-7 shrink-0 items-center justify-center gap-1.5 rounded-[--radius] px-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

export const ICON_BUTTON_CLASS = cn(
  BUTTON_BASE,
  "text-foreground hover:bg-muted active:bg-[hsl(var(--accent-hover))]",
  "aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:shadow-button-primary aria-pressed:hover:bg-[hsl(var(--primary-hover))] aria-pressed:[--icon-accent:currentColor]",
);

export const OUTLINE_BUTTON_CLASS = cn(BUTTON_BASE, "px-2.5", BUTTON_OUTLINE);

export const PRIMARY_BUTTON_CLASS = cn(BUTTON_BASE, "px-2.5 [--icon-accent:currentColor]", BUTTON_PRIMARY);

export function Hint({ label, children, side = "bottom" }: { label: string; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function InspectorSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-2 border-b border-border px-3 py-2.5 last:border-b-0">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 id={id} className="legend text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export type NoticeTone = "fault" | "info" | "progress" | "brand";

export function Notice({ tone, title, children, action }: { tone: NoticeTone; title: string; children?: ReactNode; action?: ReactNode }) {
  const Glyph = tone === "fault" ? WarningCircle : tone === "progress" ? CircleNotch : Info;
  const kind = tone === "fault" ? "notice-fault" : tone === "brand" ? "notice-brand" : tone === "info" ? "notice-info" : "";
  return (
    <div role={tone === "fault" ? "alert" : "status"} aria-live={tone === "fault" ? undefined : "polite"} className={cn("notice flex items-start gap-2 px-2.5 py-2 text-xs", kind)}>
      <Glyph className={cn("notice-ink mt-px h-3.5 w-3.5 shrink-0", tone === "progress" && "animate-spin")} aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="notice-ink font-semibold">{title}</p>
        {children ? <div>{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

function rounded(value: number, decimals: number): string {
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor);
}

export interface NumberFieldProps {
  label: string;
  short?: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  suffix?: string;
  disabled?: boolean;
  bare?: boolean;
}

export function NumberField({ label, short, value, onCommit, min, max, step = 1, decimals = 0, suffix, disabled, bare }: NumberFieldProps) {
  const shown = rounded(value, decimals);
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();

  const commit = (raw: string) => {
    setDraft(null);
    const parsed = Number(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(parsed)) return;
    const clamped = Math.min(Math.max(parsed, min ?? -Infinity), max ?? Infinity);
    if (rounded(clamped, decimals) !== shown) onCommit(clamped);
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {bare ? null : (
        <label htmlFor={id} className={cn("shrink-0 text-2xs font-medium text-muted-foreground", !short && "w-24")} title={label}>
          {short ?? label}
        </label>
      )}
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          aria-label={short || bare ? label : undefined}
          type="number"
          inputMode="decimal"
          value={draft ?? shown}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit(event.currentTarget.value);
            if (event.key === "Escape") {
              setDraft(null);
              event.currentTarget.blur();
            }
          }}
          className={cn(FIELD_CLASS, suffix ? "pr-6" : undefined)}
        />
        {suffix ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

export function ColorField({ label, value, onCommit, disabled, allowEmpty, emptyLabel }: { label: string; value: string; onCommit: (value: string) => void; disabled?: boolean; allowEmpty?: boolean; emptyLabel?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();

  const commit = (raw: string) => {
    setDraft(null);
    if (allowEmpty && raw.trim() === "") return value === "" ? undefined : onCommit("");
    const next = typedColor(raw, true);
    if (next !== null && next !== value.toLowerCase()) onCommit(next);
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        type="color"
        aria-label={label}
        value={swatchOf(value) ?? "#000000"}
        disabled={disabled}
        onChange={(event) => commit(withSwatch(value, event.target.value))}
        className="h-7 w-7 shrink-0 cursor-pointer rounded-[--radius] border border-control-edge bg-card p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
      />
      <input
        id={id}
        type="text"
        value={draft ?? value}
        placeholder={allowEmpty ? emptyLabel : undefined}
        disabled={disabled}
        maxLength={9}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
        }}
        className={cn(FIELD_CLASS, "font-mono uppercase")}
      />
    </div>
  );
}

export interface SliderEntry {
  range: Range;
  scale?: number;
  decimals?: number;
  suffix?: string;
}

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
  disabled?: boolean;
  entry?: SliderEntry;
}

function SliderEntryField({ label, value, entry, disabled, onCommit }: { label: string; value: number; entry: SliderEntry; disabled?: boolean; onCommit: (value: number) => void }) {
  const scale = entry.scale ?? 1;
  const decimals = entry.decimals ?? 0;
  return (
    <div className="w-16 shrink-0">
      <NumberField bare label={label} value={value * scale} min={entry.range[0] * scale} max={entry.range[1] * scale} step={10 ** -decimals} decimals={decimals} suffix={entry.suffix} disabled={disabled} onCommit={(typed) => onCommit(typed / scale)} />
    </div>
  );
}

export function SliderField({ label, value, min, max, step, format, onChange, onStart, onEnd, disabled, entry }: SliderFieldProps) {
  const [dragging, setDragging] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!dragging) return;
    const end = () => {
      setDragging(false);
      onEnd?.();
    };
    window.addEventListener("pointerup", end, { once: true });
    return () => window.removeEventListener("pointerup", end);
  }, [dragging, onEnd]);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span id={id} className={LABEL_CLASS}>
        {label}
      </span>
      <Slider
        aria-labelledby={id}
        value={[clampTo(value, [min, max])]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="min-w-0 flex-1"
        onPointerDown={() => {
          if (dragging) return;
          setDragging(true);
          onStart?.();
        }}
        onValueChange={([next]) => onChange(next)}
      />
      {entry ? (
        <SliderEntryField label={label} value={value} entry={entry} disabled={disabled} onCommit={onChange} />
      ) : (
        <span className="readout w-10 shrink-0 text-right text-2xs text-foreground">{format ? format(value) : value}</span>
      )}
    </div>
  );
}

export function ToggleButton({ label, pressed, onClick, children, disabled, className }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <Hint label={label}>
      <button type="button" aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} className={cn(ICON_BUTTON_CLASS, className)}>
        {children}
      </button>
    </Hint>
  );
}

export function IconButton({ label, onClick, children, disabled, className, showLabel }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; className?: string; showLabel?: boolean }) {
  const button = (
    <button type="button" aria-label={showLabel ? undefined : label} disabled={disabled} onClick={onClick} className={cn(ICON_BUTTON_CLASS, className)}>
      {children}
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
  return showLabel ? button : <Hint label={label}>{button}</Hint>;
}

export function SelectField<T extends string | number>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <select
        id={id}
        value={String(value)}
        disabled={disabled}
        onChange={(event) => {
          const picked = options.find((option) => String(option.value) === event.target.value);
          if (picked) onChange(picked.value);
        }}
        className={FIELD_CLASS}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextField({ label, value, placeholder, maxLength, onCommit }: { label: string; value: string; placeholder?: string; maxLength?: number; onCommit: (value: string) => void }) {
  const id = useId();
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        key={value}
        id={id}
        defaultValue={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onBlur={(event) => {
          if (event.target.value !== value) onCommit(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            event.currentTarget.value = value;
            event.currentTarget.blur();
          }
        }}
        className={cn(FIELD_CLASS, "select-text")}
      />
    </div>
  );
}

export function SwitchToggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <ElevatedSwitch aria-label={label} title={label} checked={checked} disabled={disabled} onCheckedChange={onChange} />;
}

export function SwitchRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2">
      <span className="text-xs text-foreground">{label}</span>
      <SwitchToggle label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}
