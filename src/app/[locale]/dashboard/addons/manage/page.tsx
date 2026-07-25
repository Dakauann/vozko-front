"use client";

import { AdminAddonsManager } from "@/components/dashboard/addons/AdminAddonsManager";
import { CircleNotch } from "@phosphor-icons/react";
import UserAddonsCatalog from "@/components/dashboard/addons/UserAddonsCatalog";
import { useAuth } from "@/contexts/auth-context";

function isSystemAdmin(role?: string | null) {
  return role === "admin" || role === "ADMIN" || role === "administrator";
}

export default function DashboardAddonsManagePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <CircleNotch className="h-8 w-8 animate-spin text-primary" weight="bold" />
      </div>
    );
  }

  if (!isSystemAdmin(user?.role)) {
    return <UserAddonsCatalog />;
  }

  return <AdminAddonsManager />;
}
