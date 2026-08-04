"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A section of a settings panel.
 *
 * Settings pages here were built as a vertical stack of identical cards, each
 * with a coloured icon tile, an h3 and a subtitle. That is the same-size-card
 * scaffold: five floating boxes, five sets of chrome, and no way to tell at a
 * glance which one you are in — the container repeated the structure the
 * heading was already carrying.
 *
 * A console panel does not stack boxes. It is one surface, divided by engraved
 * rules, with each division legended. So this renders a section head — legend,
 * title, optional description and actions — over a hairline, and lets the
 * content sit directly on the panel beneath it.
 *
 * `boxed` opts a section back into its own well, for the rare case where the
 * content genuinely is a separate object (a danger zone, a nested list).
 */
export interface PanelSectionProps {
  /** Silkscreen legend above the title. Names the group, not the action. */
  legend?: string;
  title: string;
  description?: string;
  /** Controls that act on this section, right-aligned in the head. */
  actions?: ReactNode;
  /** Renders the section inside its own well instead of on the bare panel. */
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
          {legend ? <p className="legend mb-1">{legend}</p> : null}
          <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-[68ch] text-[13px] leading-snug text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        ) : null}
      </header>

      <div className={cn(boxed ? "px-4 py-4" : "pt-4", contentClassName)}>
        {children}
      </div>
    </section>
  );
}

export default PanelSection;
