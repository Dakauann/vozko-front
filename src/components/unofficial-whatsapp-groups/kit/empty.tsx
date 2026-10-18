"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import type { DashboardTableEmptyState } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, FunnelSimple, WarningCircle } from "@/components/icons";
import { cn } from "@/lib/utils";

export function QuietEmpty({ icon, message, action, className }: { icon: ReactNode; message: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground", className)}>
      <span aria-hidden className="opacity-50 [&_svg]:h-7 [&_svg]:w-7">
        {icon}
      </span>
      <p className="max-w-xs text-xs">{message}</p>
      {action}
    </div>
  );
}

export interface TableEmpty {
  error(message: string, onRetry: () => void): DashboardTableEmptyState;
  noMatches(noun: string, onClear: () => void): DashboardTableEmptyState;
  firstUse(options: { icon: ReactNode; title: string; description?: string; action?: ReactNode }): DashboardTableEmptyState;
}

export function useTableEmpty(): TableEmpty {
  const t = useTranslations("unofficialGroups.kit.table");
  return useMemo<TableEmpty>(
    () => ({
      error: (message, onRetry) => ({
        icon: <WarningCircle className="h-7 w-7 text-destructive" weight="fill" />,
        title: message,
        description: t("errorHint"),
        action: <Button variant="secondary" title={t("retry")} icon={<ArrowClockwise />} iconVisible onClick={onRetry} />,
      }),
      noMatches: (noun, onClear) => ({
        icon: <FunnelSimple className="h-7 w-7 text-muted-foreground" />,
        title: t("noMatchesTitle", { noun }),
        description: t("noMatchesHint"),
        action: <Button variant="secondary" title={t("clearFilters")} onClick={onClear} />,
      }),
      firstUse: ({ icon, title, description, action }) => ({ icon, title, description, action }),
    }),
    [t],
  );
}
