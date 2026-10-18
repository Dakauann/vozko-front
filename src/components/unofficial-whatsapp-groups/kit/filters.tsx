"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { MagnifyingGlass, X } from "@/components/icons";

export interface ActiveFilter {
  key: string;
  label: string;
  onClear: () => void;
}

export function ActiveFilterChips({
  filters,
  onClearAll,
  resultLabel,
}: {
  filters: ActiveFilter[];
  onClearAll: () => void;
  resultLabel?: string;
}) {
  const t = useTranslations("unofficialGroups.kit.filters");
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((filter) => (
        <span
          key={filter.key}
          className="inline-flex max-w-[16rem] items-center gap-1 rounded-[--radius] border border-border bg-muted py-0.5 pl-2 pr-0.5 text-2xs font-medium text-foreground"
        >
          <span className="truncate" title={filter.label}>
            {filter.label}
          </span>
          <button
            type="button"
            onClick={filter.onClear}
            aria-label={t("clearOne", { label: filter.label })}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" weight="bold" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="rounded-sm px-1 text-2xs font-semibold text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("clearAll")}
      </button>
      {resultLabel ? <span className="readout ml-auto text-2xs text-muted-foreground">{resultLabel}</span> : null}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  debounceMs = 300,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  debounceMs?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const emitted = useRef(value.trim());
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (value.trim() !== emitted.current) {
      emitted.current = value.trim();
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    const next = draft.trim();
    if (next === emitted.current) return;
    const timer = setTimeout(() => {
      emitted.current = next;
      onChangeRef.current(next);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [draft, debounceMs]);

  return (
    <div className={className ?? "w-full sm:w-64"}>
      <ElevatedInput
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        label={placeholder}
        aria-label={ariaLabel}
        controlSize="sm"
        icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
      />
    </div>
  );
}

export function WindowToggle<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const byKey = new Map(options.map((option) => [String(option.value), option.value]));
  return (
    <ElevatedPillToggle<string>
      aria-label={ariaLabel}
      className={className}
      value={String(value)}
      options={options.map((option) => ({ value: String(option.value), label: option.label }))}
      onChange={(next) => {
        const picked = byKey.get(next);
        if (picked !== undefined) onChange(picked);
      }}
    />
  );
}

export function CountChip({
  count,
  noun,
  filtered,
  loading,
}: {
  count: number;
  noun: (count: number) => string;
  filtered?: boolean;
  loading?: boolean;
}) {
  const t = useTranslations("unofficialGroups.kit.filters");
  if (loading || count <= 0) return null;
  return (
    <span className="readout inline-flex items-center rounded-[--radius] border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-foreground">
      {filtered ? t("filteredCount", { label: noun(count) }) : noun(count)}
    </span>
  );
}
