"use client";

import { CrmProvider } from "@/contexts/crm-context";
import { useAuth } from "@/contexts/auth-context";
import { useDepartment } from "@/contexts/department-context";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ReactNode } from "react";

interface DashboardCrmWrapperProps {
  children: ReactNode;
}

export default function DashboardCrmWrapper({
  children,
}: DashboardCrmWrapperProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { currentDepartment } = useDepartment();
  const crmScopeKey = `${currentWorkspace?.id ?? "no-workspace"}:${currentDepartment?.id ?? "all-departments"}`;

  return (
    <CrmProvider key={crmScopeKey} token={user?.id ?? ""} enabled>
      {children}
    </CrmProvider>
  );
}
