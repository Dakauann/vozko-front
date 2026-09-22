"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PanelSectionProps {
  legend?: string;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  boxed?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function PanelSection({
  legend,
  title,
  description,
  actions,
  boxed = false,
  className,
  contentClassName,
  children,
}: PanelSectionProps) {
  return (
    <section className={cn(boxed && "well overflow-hidden", className)}>
      <header
        className={cn(
          "rule-engraved flex flex-wrap items-start justify-between gap-3 pb-3",
          boxed && "bg-muted px-4 pt-3",
        )}
      >
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-[68ch] text-sm leading-snug text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {
}
        {legend || actions ? (
          <div className="flex shrink-0 items-center gap-3">
            {legend ? <p className="legend">{legend}</p> : null}
            {actions ? (
              <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className={cn(boxed ? "px-4 py-4" : "pt-4", contentClassName)}>
        {children}
      </div>
    </section>
  );
}

export default PanelSection;
