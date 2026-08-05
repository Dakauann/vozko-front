"use client";

import { AdminPlansManager } from "../page";
import { CircleNotch } from "@/components/icons";
import UserPlansCatalog from "@/components/dashboard/plans/UserPlansCatalog";
import { useAuth } from "@/contexts/auth-context";

function isSystemAdmin(role?: string | null) {
  return role === "admin" || role === "ADMIN" || role === "administrator";
}

export default function DashboardPlansManagePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <CircleNotch
          className="h-8 w-8 animate-spin text-primary-ink"
          weight="bold"
        />
      </div>
    );
  }

  if (!isSystemAdmin(user?.role)) {
    return <UserPlansCatalog />;
  }

  return <AdminPlansManager />;
}