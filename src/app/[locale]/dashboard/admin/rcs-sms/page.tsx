"use client";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { CarrierAdminPage } from "@/components/carrier-messaging";
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/contexts/auth-context";
import { isSystemAdmin } from "@/lib/auth/roles";

export default function AdminRcsSmsPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <ScreenLoader fit="screen" />;
  if (!isSystemAdmin(user?.role)) return <AccessDenied backHref="/dashboard" />;
  return <CarrierAdminPage />;
}
