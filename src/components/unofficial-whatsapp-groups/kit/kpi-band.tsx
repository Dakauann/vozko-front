"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/audience/shared";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import type { Icon } from "@/components/icons";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import type { KpiMark } from "./format";

export type { KpiMark } from "./format";

export interface KpiCell {
  key: string;
  label: string;
  value: string;
  total?: string;
  sub?: ReactNode;
  mark?: KpiMark;
  visual?: ReactNode;
  href?: string;
  title?: string;
  icon?: Icon;
  plate?: string;
}

const MARK_CLASS: Record<KpiMark, string> = {
  fault: "bg-destructive",
  warning: "bg-warning",
  healthy: "bg-healthy",
};

export function MarkDot({ mark, label, className }: { mark: KpiMark; label?: string; className?: string }) {
  const t = useTranslations("unofficialGroups.kit.mark");
  const name = label ?? t(mark);
  return <span role="img" aria-label={name} title={name} className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", MARK_CLASS[mark], className)} />;
}

const COLUMNS: Record<4 | 5 | 6 | 8, string> = {
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
  8: "xl:grid-cols-8",
};

function bandClass(columns: 4 | 5 | 6 | 8, className?: string) {
  return cn(
    "grid grid-cols-2 gap-px overflow-hidden rounded-[--radius] border border-border bg-border md:grid-cols-4",
    COLUMNS[columns],
    className,
  );
}

function CellBody({ cell, numeral, compact }: { cell: KpiCell; numeral: string; compact: boolean }) {
  return (
    <>
      <dt className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {cell.icon ? (
          <span className={cn("mr-0.5 flex shrink-0 items-center justify-center rounded-[--radius]", compact ? "h-6 w-6" : "h-8 w-8", cell.plate)}>
            <cell.icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} weight="fill" />
          </span>
        ) : null}
        <span className="truncate">{cell.label}</span>
        {cell.mark ? <MarkDot mark={cell.mark} /> : null}
      </dt>
      <dd className="mt-2 flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {cell.href ? (
            <Link
              href={cell.href}
              aria-label={cell.title ?? `${cell.label}: ${cell.value}`}
              className={cn(
                "readout truncate font-display font-semibold leading-none tracking-tight text-foreground after:absolute after:inset-0 focus-visible:outline-none",
                numeral,
              )}
            >
              {cell.value}
            </Link>
          ) : (
            <span className={cn("readout truncate font-display font-semibold leading-none tracking-tight text-foreground", numeral)}>{cell.value}</span>
          )}
          {cell.total ? <span className="readout shrink-0 truncate text-xs text-muted-foreground">{cell.total}</span> : null}
        </span>
        {cell.visual ? <span className="flex shrink-0 items-center">{cell.visual}</span> : null}
      </dd>
      {cell.sub ? <dd className="mt-1.5 truncate text-xs text-muted-foreground">{cell.sub}</dd> : null}
    </>
  );
}

export function KpiBand({
  label,
  cells,
  columns,
  loading,
  className,
}: {
  label: string;
  cells: KpiCell[];
  columns: 4 | 5 | 6 | 8;
  loading?: boolean;
  className?: string;
}) {
  const numeral = columns >= 6 ? "text-[1.5rem]" : "text-[1.75rem]";
  if (loading) {
    return (
      <div aria-hidden className={bandClass(columns, className)} style={{ boxShadow: softSurfaceShadow }}>
        {Array.from({ length: Math.max(cells.length, columns) }, (_, index) => (
          <div key={index} className="space-y-2.5 bg-card px-4 py-3">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <dl aria-label={label} className={bandClass(columns, className)} style={{ boxShadow: softSurfaceShadow }}>
      {cells.map((cell) => (
        <div
          key={cell.key}
          title={cell.title}
          className={cn(
            "relative min-w-0 bg-card px-4 py-3",
            cell.href &&
              "transition-colors hover:bg-[hsl(var(--accent-hover))] focus-within:z-10 focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring",
          )}
        >
          <CellBody cell={cell} numeral={numeral} compact={columns >= 8} />
        </div>
      ))}
    </dl>
  );
}
