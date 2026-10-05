"use client";

import { useEffect } from "react";

import SessionUnavailable from "@/components/dashboard/SessionUnavailable";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { useRouter } from "@/i18n/routing";

export default function DashboardGate({ children }: { children: ReactNode }) {
  const { user, isLoading, serverError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user && !serverError) {
      router.replace("/login");
    }
  }, [isLoading, user, serverError, router]);

  if (isLoading) return <ScreenLoader fit="viewport" />;
  if (serverError && !user) return <SessionUnavailable />;
  if (!user) return <ScreenLoader fit="viewport" />;
  return <>{children}</>;
}
