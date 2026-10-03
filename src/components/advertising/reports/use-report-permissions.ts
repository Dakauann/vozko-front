"use client";

import { useWorkspace } from "@/contexts/workspace-context";
import type { ResourceAction } from "@/lib/workspace/types";

export interface ReportPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function useReportPermissions(): ReportPermissions & { canRead: boolean; loading: boolean } {
  const { can, permissionsLoading } = useWorkspace();
  const allowed = (action: ResourceAction) => !permissionsLoading && can("ads", action);
  return {
    loading: permissionsLoading,
    canRead: allowed("read"),
    canCreate: allowed("create"),
    canUpdate: allowed("update"),
    canDelete: allowed("delete"),
  };
}
