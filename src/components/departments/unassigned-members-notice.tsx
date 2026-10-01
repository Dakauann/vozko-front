"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, Users } from "@/components/icons";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import type { Department } from "@/lib/department/types";
import type { WorkspaceMember } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";

export function UnassignedMembersNotice({
  members,
  departments,
  canAssign,
  onAssign,
}: {
  members: WorkspaceMember[];
  departments: Department[];
  canAssign: boolean;
  onAssign: (departmentId: string, memberId: string) => Promise<void>;
}) {
  const t = useTranslations("departmentScope");
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const assign = async (departmentId: string, memberId: string) => {
    setAssigning(memberId);
    try {
      await onAssign(departmentId, memberId);
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div role="status" className="rounded-[--radius] border border-border bg-muted">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[--radius]"
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block text-xs font-semibold text-foreground">
            {t("adminNoDepartmentSummary", { count: members.length })}
          </span>
          <span className="block text-xs text-muted-foreground">{t("adminNoDepartmentTooltip")}</span>
          <span className="block text-xs font-medium text-primary-ink">
            {open ? t("unassignedHide") : t("unassignedShow")}
          </span>
        </span>
        <CaretDown
          weight="bold"
          aria-hidden
          className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <ul className="space-y-1 border-t border-border px-3 py-2.5">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-1 py-1">
              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" weight="fill" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{member.username || member.email}</span>
                {member.username ? <span className="block truncate text-2xs text-muted-foreground">{member.email}</span> : null}
              </span>
              {canAssign ? (
                <ElevatedSelect
                  value=""
                  placeholder={t("unassignedAddTo")}
                  onValueChange={(departmentId) => void assign(departmentId, member.id)}
                  disabled={assigning === member.id}
                  className="w-auto min-w-[180px]"
                >
                  {departments.map((department) => (
                    <ElevatedSelectItem key={department.id} value={department.id}>
                      {department.name}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
