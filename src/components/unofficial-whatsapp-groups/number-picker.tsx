"use client";

import type { ReactNode } from "react";

import { Check } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import type { UnofficialWhatsAppInstance } from "@/lib/unofficial-whatsapp/types";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { cn } from "@/lib/utils";

import { numberLabel } from "./use-workspace-numbers";

export interface PickableNumber {
  number: UnofficialWhatsAppInstance;
  disabled: boolean;
  note?: ReactNode;
}

const PICKER_FRAME = "divide-y divide-border overflow-hidden rounded-[--radius] border border-border";

export function NumberPickerSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className={PICKER_FRAME}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-11 items-center gap-3 bg-card px-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

export function NumberPicker({
  label,
  options,
  selected,
  onToggle,
  ordered,
  describedBy,
}: {
  label: string;
  options: PickableNumber[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  ordered?: boolean;
  describedBy?: string;
}) {
  if (options.length === 0) return null;
  return (
    <div role="group" aria-label={label} aria-describedby={describedBy} className={PICKER_FRAME}>
      {options.map(({ number, disabled, note }) => {
        const position = selected.indexOf(number.id);
        const checked = position >= 0;
        return (
          <button
            key={number.id}
            type="button"
            role="checkbox"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onToggle(number.id)}
            className={cn(
              "flex w-full items-center gap-3 bg-card px-3 py-2 text-left transition-colors focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              checked ? "bg-muted" : "hover:bg-muted",
              disabled && "cursor-not-allowed opacity-60 hover:bg-card",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                checked ? "border-primary bg-primary text-primary-foreground" : "border-control-edge bg-card",
              )}
            >
              {checked && ordered ? (
                <span className="readout text-[9px] font-semibold leading-none">{position + 1}</span>
              ) : checked ? (
                <Check className="h-3 w-3" weight="bold" />
              ) : null}
            </span>
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", number.sessionLive ? "bg-healthy" : "bg-muted-foreground")}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-foreground">{numberLabel(number)}</span>
              {number.phoneNumber ? (
                <span className="readout block truncate font-mono text-2xs text-muted-foreground">{formatPhoneForDisplay(number.phoneNumber)}</span>
              ) : null}
            </span>
            {note ? <span className="shrink-0 text-2xs text-muted-foreground">{note}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
