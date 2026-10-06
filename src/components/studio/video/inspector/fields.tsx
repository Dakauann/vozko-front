"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KeyState } from "@/lib/studio/keyframe-edit";
import { cn } from "@/lib/utils";

import { TOOLTIP_CLASS } from "../tool-button";

export const RANGE_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

const INPUT_CLASS =
  "h-7 w-full min-w-0 rounded-md border border-border bg-background px-2 text-xs tabular-nums text-foreground transition-colors placeholder:italic placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

const SCRUB_PX_PER_STEP = 3;

export function InspectorSection({ title, children, className, action }: { title: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("space-y-2 border-b border-border px-3 py-3", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

export function KeyMark({ state, hint }: { state: KeyState; hint: string }) {
  if (state === "static") return null;
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={hint} className="inline-flex h-3 w-3 items-center justify-center text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <svg viewBox="0 0 10 10" aria-hidden className="h-2 w-2">
            <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" fill={state === "key" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className={cn(TOOLTIP_CLASS, "max-w-56")}>
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

function FieldLabel({ htmlFor, label, mark, scrub }: { htmlFor: string; label: string; mark?: ReactNode; scrub?: (event: ReactPointerEvent<HTMLLabelElement>) => void }) {
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={htmlFor} onPointerDown={scrub} className={cn("block select-none text-2xs text-muted-foreground", scrub && "cursor-ew-resize")}>
        {label}
      </label>
      {mark}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | null;
  onCommit: (value: number) => void;
  onNudge?: (delta: number) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  disabled?: boolean;
  keyState?: KeyState;
  keyHint?: string;
}

function display(value: number | null, decimals: number): string {
  return value !== null && Number.isFinite(value) ? String(Number(value.toFixed(decimals))) : "";
}

function bounded(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}

export function NumberField({
  label,
  value,
  onCommit,
  onNudge,
  onGestureStart,
  onGestureEnd,
  unit,
  step = 1,
  min,
  max,
  decimals = 0,
  disabled,
  keyState = "static",
  keyHint,
}: NumberFieldProps) {
  const t = useTranslations("studio.video.inspector");
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const scrubbing = useRef<{ pointerId: number; x: number; moved: boolean } | null>(null);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft.replace(",", "."));
    setDraft(null);
    if (draft.trim() === "" || !Number.isFinite(parsed)) return;
    const next = bounded(parsed, min, max);
    if (next !== value) onCommit(next);
  };

  const nudge = (delta: number) => {
    if (onNudge) {
      onNudge(delta);
      return;
    }
    const current = latest.current;
    if (current === null) return;
    const next = bounded(Number((current + delta).toFixed(Math.max(decimals, 3))), min, max);
    if (next !== current) onCommit(next);
  };

  const scrub = disabled
    ? undefined
    : (event: ReactPointerEvent<HTMLLabelElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        scrubbing.current = { pointerId: event.pointerId, x: event.clientX, moved: false };
        const target = event.currentTarget;
        const move = (e: PointerEvent) => {
          const state = scrubbing.current;
          if (!state || e.pointerId !== state.pointerId) return;
          const steps = Math.trunc((e.clientX - state.x) / SCRUB_PX_PER_STEP);
          if (steps === 0) return;
          if (!state.moved) {
            state.moved = true;
            onGestureStart?.();
          }
          state.x += steps * SCRUB_PX_PER_STEP;
          nudge(steps * step * (e.shiftKey ? 10 : 1));
        };
        const end = (e: PointerEvent) => {
          const state = scrubbing.current;
          if (!state || e.pointerId !== state.pointerId) return;
          scrubbing.current = null;
          target.removeEventListener("pointermove", move);
          target.removeEventListener("pointerup", end);
          target.removeEventListener("pointercancel", end);
          if (state.moved) {
            onGestureEnd?.();
            target.addEventListener("click", (click) => click.preventDefault(), { once: true, capture: true });
          }
        };
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", end);
        target.addEventListener("pointercancel", end);
      };

  const interpolated = keyState === "interpolated";

  return (
    <div className="space-y-1">
      <FieldLabel htmlFor={id} label={label} scrub={scrub} mark={keyHint ? <KeyMark state={keyState} hint={keyHint} /> : null} />
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={draft ?? display(value, decimals)}
          placeholder={value === null ? t("mixed") : undefined}
          title={disabled ? undefined : t("scrubHint")}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setDraft(null);
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              setDraft(null);
              nudge((event.key === "ArrowUp" ? 1 : -1) * step * (event.shiftKey ? 10 : 1));
            }
          }}
          className={cn(INPUT_CLASS, unit && "pr-7", interpolated && "italic")}
        />
        {unit ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number | null;
  fallback: number;
  min: number;
  max: number;
  step: number;
  valueText: string;
  onChange: (value: number) => void;
  onCommit: () => void;
  onStart: () => void;
  disabled?: boolean;
  keyState?: KeyState;
  keyHint?: string;
}

export function SliderField({ label, value, fallback, min, max, step, valueText, onChange, onCommit, onStart, disabled, keyState = "static", keyHint }: SliderFieldProps) {
  const t = useTranslations("studio.video.inspector");
  const id = useId();
  const text = value === null ? t("mixed") : valueText;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <FieldLabel htmlFor={id} label={label} mark={keyHint ? <KeyMark state={keyState} hint={keyHint} /> : null} />
        <span className={cn("text-2xs tabular-nums", value === null ? "italic text-muted-foreground" : "text-foreground", keyState === "interpolated" && "italic")}>{text}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? fallback}
        disabled={disabled}
        aria-valuetext={text}
        onPointerDown={onStart}
        onKeyDown={(event) => {
          if (RANGE_KEYS.has(event.key)) event.stopPropagation();
          onStart();
        }}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
        className="h-1 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
      />
    </div>
  );
}

const MIXED_OPTION = "__mixed__";

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("studio.video.inspector");
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-2xs text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value ?? MIXED_OPTION}
        disabled={disabled}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next) onChange(next.value);
        }}
        className={cn(INPUT_CLASS, value === null && "italic text-muted-foreground")}
      >
        {value === null ? (
          <option value={MIXED_OPTION} disabled>
            {t("mixed")}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function ColorField({ label, value, onChange, disabled }: { label: string; value: string | null; onChange: (value: string) => void; disabled?: boolean }) {
  const t = useTranslations("studio.video.inspector");
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (next: string) => {
    setDraft(null);
    if (HEX.test(next) && next.toLowerCase() !== value?.toLowerCase()) onChange(next.toLowerCase());
  };
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-2xs text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          aria-label={label}
          value={value !== null && HEX.test(value) ? value : "#808080"}
          disabled={disabled}
          onChange={(event) => commit(event.target.value)}
          className="h-7 w-8 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5 disabled:cursor-not-allowed"
        />
        <input
          id={id}
          type="text"
          value={draft ?? value ?? ""}
          placeholder={value === null ? t("mixed") : undefined}
          disabled={disabled}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit(event.currentTarget.value);
            if (event.key === "Escape") setDraft(null);
          }}
          className={cn(INPUT_CLASS, "font-mono uppercase placeholder:font-sans placeholder:normal-case")}
        />
      </div>
    </div>
  );
}

export function ToggleField({ label, checked, onChange, disabled }: { label: string; checked: boolean | null; onChange: (value: boolean) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = checked === null;
  }, [checked]);
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
      <input ref={ref} type="checkbox" checked={checked ?? false} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-3.5 w-3.5 accent-primary" />
      {label}
    </label>
  );
}
