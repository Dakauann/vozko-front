"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";

export const ATTENDANCE_COLORS = {
  signal: "hsl(var(--chart-1))",
  finished: "hsl(var(--healthy))",
  ongoing: "hsl(var(--info))",
  pending: "hsl(var(--warning))",
  open: "hsl(var(--chart-4))",
  closeHuman: "hsl(var(--healthy))",
  closeAI: "hsl(var(--chart-5))",
  closeSystem: "hsl(var(--warning))",
  onTrack: "hsl(var(--healthy))",
  atRisk: "hsl(var(--warning))",
  offTrack: "hsl(var(--destructive))",
  neutral: "hsl(var(--muted-foreground))",
} as const;

export const LOCALE_TAG: Record<string, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
};

export function localeTagFor(locale: string): string {
  return LOCALE_TAG[locale] ?? "en-US";
}

export function useMetricsFmt() {
  const locale = useLocale();
  const tc = useTranslations("metricsOps.common");
  const tag = localeTagFor(locale);
  const na = tc("na");
  const minUnit = tc("minUnit");
  const dayUnit = tc("dayUnit");
  return useMemo(
    () => ({
      na,
      num: (v: number | null | undefined) => {
        if (v === null || v === undefined) return "0";
        return v.toLocaleString(tag);
      },
      mins: (v: number | null | undefined) => {
        if (v === null || v === undefined) return na;
        if (v < 1) return `${Math.round(v * 60)}s`;
        return `${v.toLocaleString(tag, { maximumFractionDigits: 1 })} ${minUnit}`;
      },
      days: (v: number | null | undefined) => {
        if (v === null || v === undefined) return na;
        const digits = v < 10 ? 1 : 0;
        return `${v.toLocaleString(tag, { maximumFractionDigits: digits })}${dayUnit}`;
      },
      pct: (v: number | null | undefined) => {
        if (v === null || v === undefined) return na;
        return `${v.toLocaleString(tag, { maximumFractionDigits: 1 })}%`;
      },
      money: (cents: number | null | undefined, currency?: string) => {
        if (cents === null || cents === undefined) return na;
        const value = cents / 100;
        if (!currency) {
          return value.toLocaleString(tag, { maximumFractionDigits: 2 });
        }
        try {
          return value.toLocaleString(tag, {
            style: "currency",
            currency,
            maximumFractionDigits: 2,
          });
        } catch {
          return `${currency} ${value.toLocaleString(tag, { maximumFractionDigits: 2 })}`;
        }
      },
      rate: (v: number | null | undefined, suffix: string) => {
        if (v === null || v === undefined) return na;
        return `${v.toLocaleString(tag, { maximumFractionDigits: 2 })}${suffix}`;
      },
    }),
    [tag, na, minUnit, dayUnit],
  );
}

export type MetricsFmt = ReturnType<typeof useMetricsFmt>;

export function usePresenceLabel() {
  const tc = useTranslations("metricsOps.common");
  return useCallback(
    (p: string) => {
      if (p === "online") return tc("online");
      if (p === "on_call") return tc("onCall");
      return tc("offline");
    },
    [tc],
  );
}

export function useActorKindLabel() {
  const tc = useTranslations("metricsOps.common");
  return useCallback(
    (kind: string) => (kind === "ai" ? tc("ai") : tc("human")),
    [tc],
  );
}

export function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[--radius] border border-border bg-card p-3",
        className,
      )}
      style={{ boxShadow: softSurfaceShadow }}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  icon,
  iconBg,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-[--radius]",
            iconBg,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyChart({
  icon,
  message,
  height = 220,
}: {
  icon: ReactNode;
  message: string;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-muted-foreground"
      style={{ height }}
    >
      <div className="mb-2 opacity-40">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-[--radius] bg-muted"
      style={{ height }}
      aria-hidden
    />
  );
}

export function StatLine({
  label,
  value,
  tone = "default",
  title,
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "muted" | "healthy" | "destructive";
  title?: string;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 py-1.5"
      title={title}
    >
      <span className="text-2xs font-semibold text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "readout text-sm font-semibold tabular-nums",
          tone === "warning"
            ? "text-warning-ink"
            : tone === "muted"
              ? "text-muted-foreground"
              : tone === "healthy"
                ? "text-healthy-ink"
                : tone === "destructive"
                  ? "text-destructive-ink"
                  : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function UnavailableNote({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p className={cn("py-3 text-xs text-muted-foreground", className)}>
      {message}
    </p>
  );
}
