"use client";

import { CircleNotch, TreeStructure } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { useEffect, useMemo, useState, useTransition } from "react";

import Button from "@/components/elevated-design/button";
import type { Department } from "@/lib/department/types";
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

interface DepartmentRowSwitcherProps {
  departmentId?: string | null;
  onAssign: (departmentId: string) => Promise<DepartmentAssignmentResult>;
  onAssigned?: (
    item: unknown | null,
    department: Department,
  ) => void | Promise<void>;
  className?: string;
}

export function DepartmentRowSwitcher({
  departmentId,
  onAssign,
  onAssigned,
  className,
}: DepartmentRowSwitcherProps) {
  const t = useTranslations("departmentAssignment");
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { departments, currentDepartment, isLoading } = useDepartment();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [isSaving, startTransition] = useTransition();

  const isPrivileged =
    user?.role === "admin" ||
    (!!user?.id &&
      !!currentWorkspace?.ownerId &&
      user.id === currentWorkspace.ownerId) ||
    currentWorkspace?.currentUserRole === "owner" ||
    currentWorkspace?.currentUserRole === "admin";

  const normalizedDepartmentId = departmentId?.trim() ?? "";

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
    ) ?? null;

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
          title: t("updatedTitle"),
          description: t("updatedDescription", {
            department: selectedDepartment.name,
          }),
        });

        await onAssigned?.(result.item ?? null, selectedDepartment);

        if (!onAssigned) {
          router.refresh();
        }
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
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors",
            normalizedDepartmentId
              ? "border-border bg-muted text-foreground hover:bg-muted"
              : "border-border bg-card text-muted-foreground hover:bg-muted",
            className,
          )}
        >
          <TreeStructure className="h-3.5 w-3.5 shrink-0" weight="fill" />
          <span className="max-w-[120px] truncate">
            {currentDepartmentName}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-72"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-3 p-1">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {t("switchTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("currentLabel")}: {currentDepartmentName}
            </p>
          </div>

          <ElevatedSelect
            value={selectedDepartmentId}
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
            title={isSaving ? t("saving") : t("saveAction")}
            icon={
              isSaving ? (
                <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
              ) : (
                <TreeStructure className="h-4 w-4" weight="fill" />
              )
            }
            iconVisible
            onClick={(event) => {
              event.stopPropagation();
              handleAssign();
            }}
            disabled={
              isSaving ||
              !selectedDepartment ||
              selectedDepartment.id === normalizedDepartmentId
            }
            className="w-full justify-center"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
