"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { useDepartment } from "@/contexts/department-context";

export type SendDepartmentStatus = "loading" | "failed" | "ready";

export interface SendDepartment {
  status: SendDepartmentStatus;
  required: boolean;
  departmentId: string;
  name: string | null;
  ready: boolean;
  choose: (id: string) => void;
  reload: () => void;
}

export function useSendDepartment(): SendDepartment {
  const { departments, currentDepartment, isResolved, loadFailed, refreshDepartments } = useDepartment();
  const [chosen, setChosen] = useState<string | null>(null);
  const known = departments.filter((department) => department.id);
  const fallback = currentDepartment && known.some((department) => department.id === currentDepartment.id) ? currentDepartment.id : "";
  const departmentId = chosen ?? fallback;
  const status: SendDepartmentStatus = loadFailed ? "failed" : isResolved ? "ready" : "loading";
  const required = known.length > 0;
  return {
    status,
    required,
    departmentId,
    name: known.find((department) => department.id === departmentId)?.name ?? null,
    ready: status === "ready" && (!required || departmentId !== ""),
    choose: setChosen,
    reload: () => void refreshDepartments(),
  };
}

export function SendDepartmentField({ department }: { department: SendDepartment }) {
  const t = useTranslations("leadSends.department");
  const tDialog = useTranslations("leadsPage.bulk.dialog");
  const { departments } = useDepartment();
  if (department.status === "loading") {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        {t("loading")}
      </p>
    );
  }
  if (department.status === "failed") {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-destructive-ink">{t("failed")}</span>
        <Button variant="secondary" size="sm" title={tDialog("retry")} onClick={department.reload} />
      </div>
    );
  }
  if (!department.required) return null;
  return (
    <div className="space-y-1">
      <ElevatedSelect
        label={t("label")}
        aria-label={t("label")}
        value={department.departmentId}
        onValueChange={department.choose}
        contentClassName="z-[200]"
      >
        {departments
          .filter((candidate) => candidate.id)
          .map((candidate) => (
            <ElevatedSelectItem key={candidate.id} value={candidate.id}>
              {candidate.name}
            </ElevatedSelectItem>
          ))}
      </ElevatedSelect>
      {!department.departmentId ? <p className="text-xs text-muted-foreground">{t("required")}</p> : null}
    </div>
  );
}
