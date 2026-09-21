"use client";

import { useTranslations } from "next-intl";

import { TreeStructure } from "@/components/icons";
import { useDepartment } from "@/contexts/department-context";
import { cn } from "@/lib/utils";

export function NoDepartmentNotice({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("departmentScope");
  const { scope } = useDepartment();

  if (!scope.blockedByMissingDepartment) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-2 text-center",
        compact ? "px-4 py-2" : "rounded-[--radius] border border-border bg-muted px-6 py-8",
        className,
      )}
    >
      {!compact && (
        <div className="flex h-12 w-12 items-center justify-center rounded-[--radius] bg-card">
          <TreeStructure weight="duotone" className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-semibold text-foreground">{t("blockedTitle")}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{t("blockedBody")}</p>
      <p className="max-w-sm text-xs font-medium text-muted-foreground">{t("blockedAction")}</p>
    </div>
  );
}

export function useBlockedByMissingDepartment(): boolean {
  return useDepartment().scope.blockedByMissingDepartment;
}
