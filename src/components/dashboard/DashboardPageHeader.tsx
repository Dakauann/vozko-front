"use client";

import type { ReactNode } from "react";

import { ArrowLeft } from "@/components/icons";
import { CircuitTracesWide } from "@/components/brand/circuit";
import { ScopeBreadcrumb } from "@/components/dashboard/ScopeBreadcrumb";

interface DashboardPageHeaderProps {
  icon: ReactNode;
  badge: string;
  description: string;
  title?: string;
  actions?: ReactNode;
  back?: { onClick: () => void; label: string };
  colorClass?: string;
}

export function DashboardPageHeader({
  icon,
  badge,
  description,
  title,
  actions,
  back,
}: DashboardPageHeaderProps) {
  const heading = title ?? badge;

  return (
    <div className="relative overflow-hidden border-b border-border pb-0">
      {
}
      <CircuitTracesWide tone="quiet" className="pointer-events-none absolute inset-y-2 right-0 hidden w-[min(38%,460px)] lg:block" />
      {back ? (
        <button
          type="button"
          onClick={back.onClick}
          className="legend -ml-0.5 mb-1 inline-flex items-center gap-1 transition-colors hover:!text-foreground focus-visible:rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" aria-hidden="true" />
          {back.label}
        </button>
      ) : (
        <ScopeBreadcrumb className="mb-1" />
      )}

      <div className="flex items-center gap-2">
        <span
          className="flex shrink-0 items-center text-muted-foreground [&_svg]:h-[18px] [&_svg]:w-[18px]"
          aria-hidden="true"
        >
          {icon}
        </span>
        {
}
        <h1 className="truncate font-display text-xl font-semibold leading-tight tracking-[0.01em] text-foreground">
          {heading}
        </h1>
      </div>

      {description && (
        <p className="mt-0.5 max-w-2xl text-sm leading-snug text-muted-foreground">
          {description}
        </p>
      )}

      {actions ? (
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
          {actions}
        </div>
      ) : (
        <div className="pb-3" />
      )}
    </div>
  );
}
