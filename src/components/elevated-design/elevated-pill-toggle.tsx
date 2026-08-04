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
        // A bank of keys in a sunk track. The track is recessed into the panel;
        // the pressed key rises out of it. Selection is carried by that raised
        // surface plus a brightened label — not by an accent fill, which put a
        // saturated orange block in the middle of every CRM toolbar and was one
        // of the clearest survivors of the previous identity.
        //
        // nowrap: keep the control as one toolbar unit so siblings wrap around it
        // instead of the group fracturing and overlapping neighbors.
        "inline-flex shrink-0 flex-nowrap items-center gap-0.5 rounded-[--radius] border border-border border-t-rule-strong bg-muted p-0.5",
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
              "relative inline-flex items-center justify-center rounded-[--radius] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" && "gap-1 px-2 py-1 text-[11px]",
              size === "md" && "gap-1.5 px-2.5 py-1.5 text-xs",
              collapseLabels === "sm" && "max-sm:px-2",
              collapseLabels === "md" && "max-md:px-2",
              disabled && "cursor-not-allowed opacity-40",
              !disabled &&
                active &&
                "border border-border bg-card font-semibold text-foreground",
              !disabled &&
                !active &&
                "border border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {/* The lamp marks the pressed key, so selection never rests on the
                raised surface alone. */}
            {active && !disabled && (
              <span
                aria-hidden="true"
                className="mr-0.5 h-2.5 w-[3px] shrink-0 rounded-[1px] bg-[hsl(var(--lamp))]"
              />
            )}
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
