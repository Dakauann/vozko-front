"use client";

import { useTranslations } from "next-intl";

import { DotsThree, DownloadSimple, PaperPlaneTilt, Pause, Play, Trash } from "@/components/icons";
import { DepartmentRowSwitcher } from "@/components/dashboard/DepartmentRowSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import type { Workflow } from "@/lib/workflows/types";

export function WorkflowRowActions({
  row,
  onPublish,
  onResume,
  onPause,
  onExport,
  onDelete,
  onAssignDepartment,
}: {
  row: Workflow;
  onPublish: (id: string) => void;
  onResume: (id: string) => void;
  onPause: (id: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  onAssignDepartment: (id: string, departmentId: string) => Promise<{ item: unknown; error?: string | null }>;
}) {
  const t = useTranslations("workflowsPage");
  const canUpdate = useSettledPermission("workflows", "update");
  const canDelete = useSettledPermission("workflows", "delete");

  return (
    <>
      {canUpdate && (
        <DepartmentRowSwitcher
          departmentId={row.departmentId}
          onAssign={(departmentId) => onAssignDepartment(row.id, departmentId)}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <DotsThree size={18} weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!canUpdate ? null : row.status === "draft" ? (
            <DropdownMenuItem onClick={() => onPublish(row.id)}>
              <PaperPlaneTilt size={14} className="mr-2" />
              {t("actions.publish")}
            </DropdownMenuItem>
          ) : row.status === "paused" ? (
            <DropdownMenuItem onClick={() => onResume(row.id)}>
              <Play size={14} className="mr-2" />
              {t("actions.resume")}
            </DropdownMenuItem>
          ) : row.status === "active" ? (
            <DropdownMenuItem onClick={() => onPause(row.id)}>
              <Pause size={14} className="mr-2" />
              {t("actions.pause")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => onExport(row.id)}>
            <DownloadSimple size={14} className="mr-2" />
            {t("actions.export")}
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem
              onClick={() => onDelete(row.id)}
              className="text-destructive-ink"
            >
              <Trash size={14} className="mr-2" />
              {t("actions.delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
