"use client";

import { useCallback, useMemo, type ReactNode, type Ref } from "react";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import Button from "@/components/elevated-design/button";
import { Info, WarningCircle } from "@/components/icons";

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
        "min-w-0 rounded-[--radius] border border-border bg-card p-4",
        className,
      )}
      style={{ boxShadow: softSurfaceShadow }}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({
  icon,
  iconBg,
  title,
  subtitle,
  id,
  meta,
}: {
  icon?: ReactNode;
  iconBg?: string;
  title: string;
  subtitle?: string;
  id?: string;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex min-w-0 items-center gap-2">
      {icon ? (
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-[--radius] [&_svg]:h-3.5 [&_svg]:w-3.5",
            iconBg,
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <h2
          id={id}
          className="shrink-0 font-display text-base font-semibold leading-tight tracking-[0.01em] text-foreground"
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="min-w-0 truncate text-xs text-muted-foreground" title={subtitle}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {meta ? <div className="shrink-0 text-xs text-muted-foreground">{meta}</div> : null}
    </div>
  );
}

export function Chapter({
  id,
  icon,
  iconBg,
  title,
  subtitle,
  meta,
  children,
  className,
  ref,
}: {
  id: string;
  icon?: ReactNode;
  iconBg?: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLElement>;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      ref={ref}
      aria-labelledby={headingId}
      className={cn("flex min-w-0 flex-col", className)}
    >
      <SectionLabel
        id={headingId}
        icon={icon}
        iconBg={iconBg}
        title={title}
        subtitle={subtitle}
        meta={meta}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
    </section>
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

export function SectionNotice({
  title,
  message,
  tone = "info",
  action,
}: {
  title: string;
  message?: string;
  tone?: "info" | "warning";
  action?: { label: string; onClick: () => void };
}) {
  const Icon = tone === "warning" ? WarningCircle : Info;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-[--radius] border border-border bg-card px-3 py-2.5 sm:flex-nowrap"
      style={{ boxShadow: softSurfaceShadow }}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius]",
          tone === "warning" ? "bg-warning/15 text-warning-ink" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" weight="fill" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {message ? <p className="mt-0.5 text-xs text-muted-foreground">{message}</p> : null}
      </div>
      {action ? <Button variant="secondary" title={action.label} onClick={action.onClick} /> : null}
    </div>
  );
}

export function SectionError({
  busy,
  onRetry,
  retrying,
}: {
  busy: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  const t = useTranslations("metricsOps.common");
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius] border border-border bg-muted px-3 py-2 text-sm"
    >
      <span className="text-destructive-ink">
        {busy ? t("sectionBusy") : t("sectionError")}
      </span>
      <Button variant="secondary" title={t("retry")} onClick={onRetry} disabled={retrying} />
    </div>
  );
}
