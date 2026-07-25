"use client";

import type { ReactNode } from "react";

import { ArrowLeft } from "@phosphor-icons/react";

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

export function DashboardPageHeader({
  icon,
  badge,
  description,
  title,
  actions,
  back,
  colorClass = "text-primary",
}: DashboardPageHeaderProps) {
  // Compact mode (create / edit / detail pages): the Stripe/Linear pattern, a
  // small muted back breadcrumb, a restrained ~20px title (no uppercase eyebrow,
  // no 64px hero, no load choreography), a muted subtitle, actions on the right.
  if (title) {
    return (
      <div className="space-y-2">
        {back && (
          <button
            type="button"
            onClick={back.onClick}
            className="-ml-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
            {back.label}
          </button>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {/* House "symbol": a solid accent tile with a white glyph (the
                  bg fills with the accent via currentColor from colorClass;
                  the inner span flips the glyph to white). Compact 36px. */}
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-current shadow-sm ${colorClass}`}
              >
                <span className="flex text-white">{icon}</span>
              </span>
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            </div>
            {description && (
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      </div>
    );
  }

  // Eyebrow mode (list pages): unchanged, icon + uppercase badge + description.
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={colorClass}>{icon}</span>
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${colorClass}`}
          >
            {badge}
          </span>
        </div>

        <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
