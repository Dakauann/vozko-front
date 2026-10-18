"use client";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

const colorMap = {
  primary: {
    solid: "tile-brand",
    light: "bg-muted",
    text: "text-primary-ink",
    border: "border-border",
    ring: "ring-ring",
    gradient: "from-primary to-primary/80",
  },
  emerald: {
    solid: "tile-healthy",
    light: "bg-muted",
    text: "text-healthy-ink",
    border: "border-border",
    ring: "ring-healthy/30",
  },
  blue: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-info-ink",
    border: "border-border",
    ring: "ring-info/30",
  },
  amber: {
    solid: "tile-warning",
    light: "bg-muted",
    text: "text-warning-ink",
    border: "border-border",
    ring: "ring-warning/30",
  },
  rose: {
    solid: "tile-fault",
    light: "bg-muted",
    text: "text-destructive-ink",
    border: "border-border",
    ring: "ring-destructive/30",
  },
  purple: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-muted-foreground dark:text-chart-4",
    border: "border-border",
    ring: "ring-chart-4/30",
  },
  orange: {
    solid: "tile-warning",
    light: "bg-muted",
    text: "text-warning-ink",
    border: "border-border",
    ring: "ring-warning/30",
  },
  yellow: {
    solid: "tile-warning",
    light: "bg-muted",
    text: "text-warning-ink",
    border: "border-border",
    ring: "ring-warning/30",
  },
  cyan: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-muted-foreground dark:text-info-ink",
    border: "border-border",
    ring: "ring-info/30",
  },
  slate: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    ring: "ring-slate-500/30",
  },
  red: {
    solid: "tile-fault",
    light: "bg-muted",
    text: "text-destructive-ink",
    border: "border-border",
    ring: "ring-destructive/30",
  },
  green: {
    solid: "tile-healthy",
    light: "bg-muted",
    text: "text-healthy-ink",
    border: "border-border",
    ring: "ring-healthy/30",
  },
  indigo: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-muted-foreground dark:text-info-ink",
    border: "border-border",
    ring: "ring-info/30",
  },
  violet: {
    solid: "tile-neutral",
    light: "bg-muted",
    text: "text-muted-foreground dark:text-chart-4",
    border: "border-border",
    ring: "ring-chart-4/30",
  },
} as const;

type AccentColor = keyof typeof colorMap;

export type { AccentColor };
export { colorMap as accentColorMap };

interface IconBoxProps {
  children: ReactNode;
  color?: AccentColor;
  size?: "sm" | "md" | "lg";
  className?: string;
  animated?: boolean;
}

const plateByColor: Record<string, string> = {
  primary: "tile-brand",
  slate: "tile-neutral",
  emerald: "tile-healthy",
  green: "tile-healthy",
  rose: "tile-fault",
  red: "tile-fault",
  amber: "tile-warning",
  orange: "tile-warning",
  yellow: "tile-warning",
  blue: "tile-1",
  indigo: "tile-1",
  cyan: "tile-4",
  violet: "tile-5",
  purple: "tile-5",
};

export function IconBox({
  children,
  color = "primary",
  size = "md",
  className,
}: IconBoxProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  };
  const iconSizeClasses = {
    sm: "[&>svg]:h-4 [&>svg]:w-4",
    md: "[&>svg]:h-[18px] [&>svg]:w-[18px]",
    lg: "[&>svg]:h-5 [&>svg]:w-5",
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        sizeClasses[size],
        iconSizeClasses[size],
        plateByColor[color] ?? plateByColor.primary,
        className,
      )}
    >
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  label: string;
  color?: AccentColor;
  pulse?: boolean;
  icon?: ReactNode;
}

export function StatusBadge({
  label,
  color = "slate",
  pulse = false,
  icon,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[--radius] border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground",
      )}
    >
      {pulse ? (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              colorMap[color].solid,
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              colorMap[color].solid,
            )}
          />
        </span>
      ) : icon ? (
        <span className={cn("[&>svg]:h-3.5 [&>svg]:w-3.5", colorMap[color].text)}>{icon}</span>
      ) : (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", colorMap[color].solid)}
        />
      )}
      {label}
    </span>
  );
}


