"use client";

import { AccessDenied } from "@/components/ui/access-denied";
import { CircleNotch } from "@/components/icons";
import MetaServiceCostDashboard from "@/components/dashboard/meta-service-cost-dashboard";
import { isSystemAdmin } from "@/lib/auth/roles";
import { useAuth } from "@/contexts/auth-context";

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
