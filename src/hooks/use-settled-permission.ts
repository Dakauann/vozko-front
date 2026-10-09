"use client";

import { useState } from "react";

import { useWorkspace } from "@/contexts/workspace-context";
import type { ResourceAction, ResourceType } from "@/lib/workspace/types";

interface SettledPermission {
  workspaceId: string;
  allowed: boolean;
}

export function usePermissionVerdict(resource: ResourceType, action: ResourceAction): boolean | null {
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const [settled, setSettled] = useState<SettledPermission | null>(null);

  if (!permissionsLoading && workspaceId) {
    const allowed = can(resource, action);
    if (settled?.workspaceId !== workspaceId || settled.allowed !== allowed) {
      setSettled({ workspaceId, allowed });
    }
  }

  return workspaceId && settled?.workspaceId === workspaceId ? settled.allowed : null;
}

export function useSettledPermission(resource: ResourceType, action: ResourceAction): boolean {
  return usePermissionVerdict(resource, action) === true;
}
