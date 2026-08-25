"use client";

import type { ReactNode } from "react";

import { ArrowLeft } from "@/components/icons";
import { CircuitTracesWide } from "@/components/brand/circuit";
import { ScopeBreadcrumb } from "@/components/dashboard/ScopeBreadcrumb";

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
 * The page head, in the Azure register — called from 77 places, so both prop
 * shapes are preserved exactly; only the render changed.
 *
 * The reference stacks it: trail, then title, then the command bar. So this
 * renders (1) the breadcrumb trail (derived from the pathname — no call site
 * passes anything) or the explicit `back` affordance when a page provides one,
 * (2) the title line with its quiet glyph, (3) the description, and (4) the
 * command bar — the actions rack moved from the far right to the LEFT edge
 * under the title, which is where the reference puts "New dashboard ▾ …".
 * A hairline closes the whole block, command bar or not.
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
    <div className="relative overflow-hidden border-b border-border pb-0">
      {/* The brand's trace lines at the head of every page — the right half
          of this block is structurally empty (trail, title, description and
          the command rack all sit left), so the ornament sits behind no
          text. The WIDE variant self-fits the band: it takes the whole free
          region and right-anchors inside it (preserveAspectRatio), so no
          stroke is ever cut mid-line whatever the header's height. */}
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
        {/* The one place the display face meets an operator every day —
            "Títulos/Destaques" from the brand board. Oxanium is semi-wide, so
            the negative Inter tracking comes off; 600 holds its weight. */}
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
