"use client";

import { useTranslations } from "next-intl";

import { TreeStructure } from "@/components/icons";
import { useDepartment } from "@/contexts/department-context";
import { cn } from "@/lib/utils";

/*
 * The explanation a member is owed when they can see nothing at all.
 *
 * Departments are a SCOPE, not a permission. A workspace with none filters on
 * permissions alone, so a full role sees everything. The moment one department
 * exists the rule changes for every non-admin: they see their own departments'
 * conversations, and a member in no department matches nothing.
 *
 * Left unexplained that renders as "no conversations yet", which says the
 * workspace is empty when it means none of it is theirs. Every screen that can
 * show an empty list should render this instead, so the member can act on it
 * rather than reporting a bug.
 *
 * It states facts about the reader alone: that they are in no department, and
 * that this workspace uses them. No names, no counts of other people's work,
 * nothing they could not already infer about their own account.
 */
export function NoDepartmentNotice({
  className,
  compact = false,
}: {
  className?: string;
  /** Inline in a list's empty slot, rather than as a standalone panel. */
  compact?: boolean;
}) {
  const t = useTranslations("departmentScope");
  const { scope } = useDepartment();

  // Renders nothing in every other state on purpose. A workspace that does not
  // use departments has nothing to explain, and an admin is never scoped, so
  // showing this to either would be noise that trains people to ignore it.
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

/**
 * Whether a caller should hand its empty slot to NoDepartmentNotice instead of
 * its own "nothing here" copy. Exported so a list can branch without repeating
 * the reasoning.
 */
export function useBlockedByMissingDepartment(): boolean {
  return useDepartment().scope.blockedByMissingDepartment;
}
