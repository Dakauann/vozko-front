"use client";

import { Kanban, List, Table, Stack, FunnelSimple, CaretRight } from "@/components/icons";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { CrmViewMode } from "./CrmViewSwitcher";

interface CrmScopeBreadcrumbProps {
  viewMode: CrmViewMode;
  // Resolved funnel scope: a concrete funnel name, or the "Todos os funis" label.
  funnelLabel: string;
  isAllFunnels: boolean;
  // The swimlane axis label (Etapa / Etiqueta / Responsável), Kanban only.
  groupByLabel?: string;
  className?: string;
}

// A quiet, always-visible scope line so the user knows exactly what they are looking
// at on every surface: which view, which funnel scope, and (on the board) how it is
// grouped. Pure legibility, it changes no behavior. Follows the product register's
// "Quiet Infrastructure" voice: muted neutrals, one emphasis, no decorative color.
export default function CrmScopeBreadcrumb({
  viewMode,
  funnelLabel,
  isAllFunnels,
  groupByLabel,
  className,
}: CrmScopeBreadcrumbProps) {
  const t = useTranslations("crmBoard");

  const ViewIcon =
    viewMode === "funnel" ? Kanban : viewMode === "table" ? Table : List;
  const viewLabel =
    viewMode === "funnel"
      ? t("view.kanban")
      : viewMode === "table"
        ? t("view.table")
        : t("view.chat");

  const FunnelIcon = isAllFunnels ? Stack : FunnelSimple;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b border-border bg-muted px-4 py-1.5 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <ViewIcon weight="bold" className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="font-medium text-foreground/80">{viewLabel}</span>

      <CaretRight weight="bold" className="h-3 w-3 flex-shrink-0 text-muted-foreground/40" />

      <FunnelIcon
        weight={isAllFunnels ? "fill" : "bold"}
        className="h-3.5 w-3.5 flex-shrink-0"
      />
      <span className={cn("truncate", !isAllFunnels && "font-medium text-foreground/80")}>
        {funnelLabel}
      </span>

      {groupByLabel ? (
        <>
          <CaretRight weight="bold" className="h-3 w-3 flex-shrink-0 text-muted-foreground/40" />
          <span>{t("scope.groupedBy", { axis: groupByLabel })}</span>
        </>
      ) : null}
    </div>
  );
}
