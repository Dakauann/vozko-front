"use client";

import { AccessDenied } from "@/components/ui/access-denied";
import { CircleNotch } from "@/components/icons";
import MetaServiceCostDashboard from "@/components/dashboard/meta-service-cost-dashboard";
import { isSystemAdmin } from "@/lib/auth/roles";
import { useAuth } from "@/contexts/auth-context";

/**
 * Platform admin only. This page reports every workspace's messaging volume
 * against its spend, which is cross-tenant data no workspace user may see.
 *
 * The guard here only hides the surface. The endpoint behind it sits on the
 * admin subrouter, which enforces RequireRole(admin) server side, so a
 * non-admin who reaches this route directly still gets nothing back.
 */
export default function MetaServiceCostPage() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <CircleNotch className="h-8 w-8 animate-spin text-primary-ink" weight="bold" />
            </div>
        );
    }

    if (!isSystemAdmin(user?.role)) {
        return <AccessDenied backHref="/dashboard" />;
    }

    return <MetaServiceCostDashboard />;
}
