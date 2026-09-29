"use client";

import { useState } from "react";

import { useWorkspace } from "@/contexts/workspace-context";
import type { ResourceAction, ResourceType } from "@/lib/workspace/types";

interface SettledPermission {
  workspaceId: string;
  allowed: boolean;
}

export function useSettledPermission(resource: ResourceType, action: ResourceAction): boolean {
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const [settled, setSettled] = useState<SettledPermission | null>(null);

  if (!permissionsLoading && workspaceId) {
    const allowed = can(resource, action);
    if (settled?.workspaceId !== workspaceId || settled.allowed !== allowed) {
      setSettled({ workspaceId, allowed });
    }
  }

  return Boolean(workspaceId) && settled?.workspaceId === workspaceId && settled.allowed;
}
