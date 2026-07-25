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
  /**
   * Hide text labels below this breakpoint (icons stay).
   * Useful for dense toolbars on small screens.
   */
  collapseLabels?: "sm" | "md";
  /** Accessible name for the control group. */
  "aria-label"?: string;
};

/**
 * Compact toolbar pill toggle (Quiet Infrastructure).
 * Active segment uses solid Signal Blue; inactive stays muted in a soft well.
 * Use for date presets, channel filters, view modes, and other exclusive choices.
 */
export function ElevatedPillToggle<T extends string = string>({
  options,
  value,
  onChange,
  className,
  size = "sm",
  collapseLabels,
  "aria-label": ariaLabel,
}: ElevatedPillToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        // nowrap: keep the control as one toolbar unit so siblings wrap around it
        // instead of the group fracturing and overlapping neighbors.
        "inline-flex shrink-0 flex-nowrap items-center gap-0.5 rounded-lg border border-border/70 bg-muted/50 p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const disabled = Boolean(opt.disabled);
        const textTitle =
          opt.title ??
          (typeof opt.label === "string" ? opt.label : undefined);
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            title={textTitle}
            aria-label={textTitle}
            aria-pressed={active}
            onClick={() => {
              if (!disabled) onChange(opt.value);
            }}
            className={cn(
              "inline-flex items-center justify-center rounded-md font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              size === "sm" && "gap-1 px-2 py-1 text-[11px]",
              size === "md" && "gap-1.5 px-2.5 py-1.5 text-xs",
              collapseLabels === "sm" && "max-sm:px-2",
              collapseLabels === "md" && "max-md:px-2",
              disabled && "cursor-not-allowed opacity-40",
              !disabled &&
                active &&
                "bg-primary text-primary-foreground shadow-sm",
              !disabled &&
                !active &&
                "text-muted-foreground hover:text-foreground",
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
