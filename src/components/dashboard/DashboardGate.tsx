"use client";

import { useEffect } from "react";

import SessionUnavailable from "@/components/dashboard/SessionUnavailable";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "@/i18n/routing";

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

/**
 * Client-side auth gate for the dashboard. The security boundary is the API
 * (every request is authenticated server-side); this only controls what the UI
 * shows: a loader while identity resolves, a retry screen on a transient backend
 * error, a redirect to /login when unauthenticated, and the app once signed in.
 */
export default function DashboardGate({ children }: { children: ReactNode }) {
  const { user, isLoading, serverError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user && !serverError) {
      router.replace("/login");
    }
  }, [isLoading, user, serverError, router]);

  if (isLoading) return <FullScreenLoader />;
  if (serverError && !user) return <SessionUnavailable />;
  if (!user) return <FullScreenLoader />; // redirecting to /login
  return <>{children}</>;
}
