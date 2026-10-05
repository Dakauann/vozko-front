"use client";

import { AccessDenied } from "@/components/ui/access-denied";
import { ScreenLoader } from "@/components/brand/screen-loader";
import MetaServiceCostDashboard from "@/components/dashboard/meta-service-cost-dashboard";
import { isSystemAdmin } from "@/lib/auth/roles";
import { useAuth } from "@/contexts/auth-context";

export default function MetaServiceCostPage() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <ScreenLoader fit="screen" />;
    }

    if (!isSystemAdmin(user?.role)) {
        return <AccessDenied backHref="/dashboard" />;
    }

    return <MetaServiceCostDashboard />;
}
