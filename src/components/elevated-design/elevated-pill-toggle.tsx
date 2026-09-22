"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ElevatedPillOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  title?: string;
};

export type ElevatedPillToggleProps<T extends string = string> = {
  options: ElevatedPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  collapseLabels?: "sm" | "md";
  "aria-label"?: string;
  bare?: boolean;
};

export function ElevatedPillToggle<T extends string = string>({
  options,
  value,
  onChange,
  className,
  size = "sm",
  collapseLabels,
  "aria-label": ariaLabel,
  bare = false,
}: ElevatedPillToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 flex-nowrap items-center gap-0.5",
        bare
          ? "gap-0"
          : "rounded-lg border border-border bg-muted p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const disabled = Boolean(opt.disabled);
        const labelText =
          typeof opt.label === "string" ? opt.label : undefined;
        const textTitle = opt.title ?? labelText;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            title={textTitle}
            aria-label={labelText}
            aria-pressed={active}
            onClick={() => {
              if (!disabled) onChange(opt.value);
            }}
            className={cn(
              "relative inline-flex items-center justify-center rounded-[--radius] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "min-h-[34px] sm:min-h-0",
              size === "sm" && "gap-1 px-2 py-1 text-2xs max-sm:px-3",
              size === "md" && "gap-1.5 px-2.5 py-1.5 text-xs max-sm:px-3",
              collapseLabels === "sm" && "max-sm:px-2",
              collapseLabels === "md" && "max-md:px-2",
              disabled && "cursor-not-allowed opacity-40",
              !disabled &&
                active &&
                "bg-card font-semibold text-foreground shadow-sm",
              !disabled &&
                !active &&
                cn(
                  "text-muted-foreground hover:text-foreground",
                  bare ? "hover:bg-muted/60" : "hover:bg-card/60",
                ),
            )}
          >
            {opt.icon}
            {opt.label != null && opt.label !== "" ? (
              <span
                className={cn(
                  collapseLabels === "sm" && "max-sm:sr-only",
                  collapseLabels === "md" && "max-md:sr-only",
                )}
              >
                {opt.label}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default ElevatedPillToggle;
