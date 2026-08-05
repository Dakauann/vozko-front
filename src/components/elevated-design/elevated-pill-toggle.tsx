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
  /**
   * Drop the sunk track. Inside a ConsoleBank the legend and the hairline
   * already group the keys, so a second border around them would put a box
   * back on a panel that exists to have none.
   */
  bare?: boolean;
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
  bare = false,
}: ElevatedPillToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        // A quiet track holding the segments; the selected one rises out of it
        // as a white sheet. Not an accent fill: a saturated orange block in the
        // middle of every CRM toolbar spends the brand on a view switch.
        //
        // nowrap: keep the control as one toolbar unit so siblings wrap around it
        // instead of the group fracturing and overlapping neighbors.
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
              // Touch floor: a 26px key is a desktop key. Under a thumb it
              // needs 34px, and the icon-only collapse below md makes the keys
              // narrow at exactly the width where that matters most.
              "min-h-[34px] sm:min-h-0",
              size === "sm" && "gap-1 px-2 py-1 text-[11px] max-sm:px-3",
              size === "md" && "gap-1.5 px-2.5 py-1.5 text-xs max-sm:px-3",
              collapseLabels === "sm" && "max-sm:px-2",
              collapseLabels === "md" && "max-md:px-2",
              disabled && "cursor-not-allowed opacity-40",
              // The segmented control both reference systems ship: a quiet
              // track with the selected segment raised out of it as a white
              // sheet on a small shadow.
              //
              // The label stays NEUTRAL. An earlier pass set it in brand ink,
              // which made a view filter — "all channels", a date preset —
              // shout as loudly as the page's actual primary action, and put a
              // saturated word in the middle of every CRM toolbar. The raised
              // sheet plus the weight step is already an unambiguous "this
              // one"; the accent is not needed and is better spent elsewhere.
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
