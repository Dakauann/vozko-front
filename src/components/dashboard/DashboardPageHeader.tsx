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
  layout?: "stacked" | "inline";
}

function HeaderHeading({
  icon,
  heading,
  description,
  back,
  descriptionClassName,
}: {
  icon: ReactNode;
  heading: string;
  description: string;
  back?: { onClick: () => void; label: string };
  descriptionClassName: string;
}) {
  return (
    <>
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
        <h1 className="truncate font-display text-xl font-semibold leading-tight tracking-[0.01em] text-foreground">
          {heading}
        </h1>
      </div>

      {description && <p className={descriptionClassName}>{description}</p>}
    </>
  );
}

export function DashboardPageHeader({
  icon,
  badge,
  description,
  title,
  actions,
  back,
  layout = "stacked",
}: DashboardPageHeaderProps) {
  const heading = title ?? badge;

  if (layout === "inline") {
    return (
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border pb-2.5">
        <div className="min-w-0 flex-1">
          <HeaderHeading
            icon={icon}
            heading={heading}
            description={description}
            back={back}
            descriptionClassName="mt-0.5 truncate text-xs text-muted-foreground"
          />
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border-b border-border pb-0">
      <CircuitTracesWide tone="quiet" className="pointer-events-none absolute inset-y-2 right-0 hidden w-[min(38%,460px)] lg:block" />
      <HeaderHeading
        icon={icon}
        heading={heading}
        description={description}
        back={back}
        descriptionClassName="mt-0.5 max-w-2xl text-sm leading-snug text-muted-foreground"
      />

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
