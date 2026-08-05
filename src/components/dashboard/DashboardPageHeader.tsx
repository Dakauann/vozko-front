"use client";

import type { ReactNode } from "react";

import { ArrowLeft } from "@/components/icons";

interface DashboardPageHeaderProps {
  icon: ReactNode;
  badge: string;
  description: string;
  /** Optional compact page/entity title (e.g. "Criar nova campanha"). When set,
   * the header renders in its tight one-row form (icon + title) and the uppercase
   * `badge` eyebrow is dropped. */
  title?: string;
  actions?: ReactNode;
  /** Optional back affordance, an inline chevron for create/edit/detail pages. */
  back?: { onClick: () => void; label: string };
  colorClass?: string;
}

/**
 * The page strip.
 *
 * One form for every page, closed by a hairline: the name of the thing on the
 * left, the actions rack on the right, content below. It is called from 77
 * places, so both prop shapes are preserved exactly — only the render changed.
 *
 * Two deliberate departures from the previous header:
 *
 * - The solid accent tile behind the glyph is gone. Accent here means "current"
 *   or "commit"; an accent block on every page title spends the one signal the
 *   interface has on decoration, and it appeared on all 77.
 * - `badge` is no longer set as an uppercase eyebrow above the heading. When
 *   there is no `title`, the badge IS the heading and is rendered as one; a
 *   label stacked above a heading is a kicker, and the heading can carry itself.
 *
 * `colorClass` is accepted for call-site compatibility and intentionally not
 * applied to a fill: pages differentiate by name, not by hue.
 */
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
    <div className="rule-engraved pb-3">
      {back && (
        <button
          type="button"
          onClick={back.onClick}
          className="legend -ml-0.5 mb-1.5 inline-flex items-center gap-1 transition-colors hover:!text-foreground focus-visible:rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" aria-hidden="true" />
          {back.label}
        </button>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="flex shrink-0 items-center text-muted-foreground [&_svg]:h-4 [&_svg]:w-4"
              aria-hidden="true"
            >
              {icon}
            </span>
            <h1 className="truncate text-lg font-semibold leading-tight tracking-[-0.015em] text-foreground">
              {heading}
            </h1>
          </div>
          {description && (
            <p className="mt-1 max-w-2xl text-sm leading-snug text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        )}
      </div>
    </div>
  );
}
