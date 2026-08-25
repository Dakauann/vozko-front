"use client";

import { CircleNotch, TreeStructure, Warning } from "@/components/icons";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { useEffect, useMemo, useState, useTransition } from "react";

import Button from "@/components/elevated-design/button";
import type { Department } from "@/lib/department/types";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useDepartment } from "@/contexts/department-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

type DepartmentAssignmentResult = {
  error?: string | null;
  item?: unknown | null;
};

interface DepartmentAssignmentCardProps {
  departmentId?: string | null;
  onAssign: (departmentId: string) => Promise<DepartmentAssignmentResult>;
  onAssigned?: (
    item: unknown | null,
    department: Department,
  ) => void | Promise<void>;
  className?: string;
}

export function DepartmentAssignmentCard({
  departmentId,
  onAssign,
  onAssigned,
  className,
}: DepartmentAssignmentCardProps) {
  const t = useTranslations("departmentAssignment");
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { departments, currentDepartment, isLoading } = useDepartment();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [isAssigning, startTransition] = useTransition();

  const isPrivileged =
    user?.role === "admin" ||
    (!!user?.id &&
      !!currentWorkspace?.ownerId &&
      user.id === currentWorkspace.ownerId) ||
    currentWorkspace?.currentUserRole === "owner" ||
    currentWorkspace?.currentUserRole === "admin";

  const normalizedDepartmentId = departmentId?.trim() ?? "";
  const isAssigned = Boolean(normalizedDepartmentId);

  const availableDepartments = useMemo(
    () => departments.filter((department) => department.id),
    [departments],
  );

  useEffect(() => {
    if (availableDepartments.length === 0) {
      setSelectedDepartmentId("");
      return;
    }

    setSelectedDepartmentId((currentValue) => {
      if (
        currentValue &&
        availableDepartments.some(
          (department) => department.id === currentValue,
        )
      ) {
        return currentValue;
      }

      if (
        normalizedDepartmentId &&
        availableDepartments.some(
          (department) => department.id === normalizedDepartmentId,
        )
      ) {
        return normalizedDepartmentId;
      }

      if (
        currentDepartment &&
        availableDepartments.some(
          (department) => department.id === currentDepartment.id,
        )
      ) {
        return currentDepartment.id;
      }

      return availableDepartments[0]?.id ?? "";
    });
  }, [availableDepartments, currentDepartment, normalizedDepartmentId]);

  const currentDepartmentName =
    availableDepartments.find(
      (department) => department.id === normalizedDepartmentId,
    )?.name ?? t("allDepartments");

  const selectedDepartment =
    availableDepartments.find(
      (department) => department.id === selectedDepartmentId,
    ) ?? availableDepartments[0];

  const handleAssign = () => {
    if (!selectedDepartment) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await onAssign(selectedDepartment.id);
        if (result.error) {
          toast({
            title: t("errorTitle"),
            description: result.error,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: isAssigned ? t("updatedTitle") : t("successTitle"),
          description: isAssigned
            ? t("updatedDescription", {
                department: selectedDepartment.name,
              })
            : t("successDescription", {
                department: selectedDepartment.name,
              }),
        });

        if (onAssigned) {
          await onAssigned(result.item ?? null, selectedDepartment);
          return;
        }

        router.refresh();
      } catch (error) {
        toast({
          title: t("errorTitle"),
          description:
            error instanceof Error ? error.message : t("unexpectedError"),
          variant: "destructive",
        });
      }
    });
  };

  if (!isPrivileged || isLoading || availableDepartments.length === 0) {
    return null;
  }

  return (
    <ElevatedContainer
      className={cn(
        "!p-5 border-warning/60 bg-warning/70 dark:border-border dark:bg-muted",
        className,
      )}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[--radius] bg-warning text-warning-foreground shadow-sm">
              <Warning weight="fill" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xs font-semibold text-warning-ink">
                {t("scopeLabel")}
              </p>
              <h3 className="font-display text-base font-semibold tracking-[0.01em] text-foreground">
                {isAssigned ? t("switchTitle") : t("title")}
              </h3>
            </div>
          </div>

          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {isAssigned
              ? `${t("currentLabel")}: ${currentDepartmentName}`
              : t("description")}
          </p>

          <span className="inline-flex items-center gap-2 rounded-full bg-warning px-3 py-1.5 text-xs font-semibold text-warning-foreground">
            <TreeStructure weight="fill" className="h-3.5 w-3.5" />
            {currentDepartmentName}
          </span>
        </div>

        <div className="flex w-full flex-col gap-3 xl:w-[320px] xl:min-w-[320px]">
          <ElevatedSelect
            value={selectedDepartment?.id ?? ""}
            onValueChange={setSelectedDepartmentId}
            label={t("selectLabel")}
            placeholder={t("selectPlaceholder")}
            className="w-full"
          >
            {availableDepartments.map((department) => (
              <ElevatedSelectItem key={department.id} value={department.id}>
                {department.name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>

          <Button
            type="button"
            variant="action"
            title={
              isAssigning
                ? isAssigned
                  ? t("saving")
                  : t("assigning")
                : isAssigned
                  ? t("saveAction")
                  : t("action")
            }
            icon={
              isAssigning ? (
                <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
              ) : (
                <TreeStructure className="h-4 w-4" weight="fill" />
              )
            }
            iconVisible
            onClick={handleAssign}
            disabled={
              isAssigning ||
              !selectedDepartment ||
              selectedDepartment.id === normalizedDepartmentId
            }
            className="w-full justify-center"
          />
        </div>
      </div>
    </ElevatedContainer>
  );
}
