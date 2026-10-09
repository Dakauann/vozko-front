"use client";

import { GeocodingUsageAdmin } from "@/components/admin/geocoding/geocoding-usage-admin";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/contexts/auth-context";
import { isSystemAdmin } from "@/lib/auth/roles";

export default function AdminGeocodingPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <ScreenLoader fit="screen" />;
  }

  if (!isSystemAdmin(user?.role)) {
    return <AccessDenied backHref="/dashboard" />;
  }

  return <GeocodingUsageAdmin />;
}
