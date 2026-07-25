"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type BaseVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "vsl"
  | "action";

type LegacyVariant =
  | "main-cta"
  | "secondary-cta"
  | "main-cta-mobile"
  | "secondary-cta-mobile"
  | "vsl-cta";

type SegmentedVariant = BaseVariant | LegacyVariant;

type ControlSize = "sm" | "md" | "lg";

export interface ElevatedSegmentOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface ElevatedSegmentedControlProps {
  options: ElevatedSegmentOption[];
  value: string | null;
  onChange: (value: string) => void;
  variant?: SegmentedVariant;
  size?: ControlSize;
  className?: string;
  columns?: number;
  disabled?: boolean;
}

const variantAlias: Record<SegmentedVariant, BaseVariant> = {
  primary: "primary",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  vsl: "vsl",
  action: "action",
  "main-cta": "primary",
  "main-cta-mobile": "primary",
  "secondary-cta": "secondary",
  "secondary-cta-mobile": "secondary",
  "vsl-cta": "vsl",
};

const basePadding: Record<ControlSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-3 text-sm",
  lg: "px-5 py-[18px] text-sm",
};

const activeVariantClasses: Record<BaseVariant, string> = {
  primary: "bg-primary/5 text-primary border-2 border-dashed border-primary",
  secondary:
    "bg-secondary/10 text-secondary-foreground border-2 border-dashed border-secondary",
  outline:
    "bg-primary/5 text-[var(--text-primary)] border-2 border-dashed border-primary",
  ghost:
    "bg-background/90 text-[var(--text-primary)] border-2 border-dashed border-foreground/30 backdrop-blur",
  vsl: "bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 text-cyan-700 border-2 border-dashed border-cyan-500",
  action: "bg-primary/5 text-primary border-2 border-dashed border-primary",
};

const inactiveVariantClasses: Record<BaseVariant, string> = {
  primary:
    "bg-transparent text-muted-foreground border-2 border-dashed border-foreground/20 hover:border-foreground/30 hover:bg-muted/50",
  secondary:
    "bg-transparent text-muted-foreground border-2 border-dashed border-foreground/20 hover:border-foreground/30 hover:bg-muted/50",
  outline:
    "bg-transparent text-[var(--text-primary)] border-2 border-dashed border-foreground/20 hover:border-foreground/30 hover:bg-muted/50",
  ghost:
    "bg-transparent text-[var(--text-primary)] border-2 border-dashed border-border hover:border-foreground/20 hover:bg-muted/30",
  vsl: "bg-transparent text-muted-foreground border-2 border-dashed border-foreground/20 hover:border-cyan-300 hover:bg-cyan-50/30",
  action:
    "bg-transparent text-muted-foreground border-2 border-dashed border-foreground/20 hover:border-foreground/30 hover:bg-muted/50",
};

const iconColorByVariant: Record<BaseVariant, string> = {
  primary: "text-primary",
  secondary: "text-secondary-foreground",
  outline: "text-primary",
  ghost: "text-[var(--text-primary)]",
  vsl: "text-cyan-600",
  action: "text-primary",
};

export function ElevatedSegmentedControl({
  options,
  value,
  onChange,
  variant = "secondary",
  size = "md",
  className,
  columns,
  disabled,
}: ElevatedSegmentedControlProps) {
  const resolvedVariant = variantAlias[variant] ?? "secondary";
  const gridTemplateColumns = (columns ?? options.length) || 1;

  return (
    <div
      className={cn("grid gap-3", className)}
      style={{
        gridTemplateColumns: `repeat(${gridTemplateColumns}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const iconColor = iconColorByVariant[resolvedVariant];
        const inactiveClasses = inactiveVariantClasses[resolvedVariant];

        return (
          <motion.button
            key={option.value}
            type="button"
            onClick={() => {
              if (!disabled) {
                onChange(option.value);
              }
            }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex w-full flex-col items-start justify-center rounded-xl text-left font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              basePadding[size],
              disabled ? "cursor-not-allowed opacity-60" : "",
              isSelected
                ? activeVariantClasses[resolvedVariant]
                : inactiveClasses
            )}
            disabled={disabled}
          >
            <div className="flex w-full items-center gap-3">
              {option.icon ? (
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border border-dashed",
                    isSelected
                      ? `${iconColor} border-current bg-current/10`
                      : "text-muted-foreground border-foreground/20 bg-muted"
                  )}
                >
                  {option.icon}
                </span>
              ) : null}
              <div className="flex-1">
                <span className="block text-sm font-semibold">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                ) : null}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

export default ElevatedSegmentedControl;
