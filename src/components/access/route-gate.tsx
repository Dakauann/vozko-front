"use client";

import type { ReactNode } from "react";

import { AccessDenied } from "@/components/ui/access-denied";
import { ComingSoon } from "@/components/ui/coming-soon";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccess } from "@/hooks/use-access";
import { usePathname } from "@/i18n/routing";

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { decidePath, describePermission } = useAccess();
  const decision = decidePath(pathname);

  switch (decision.status) {
    case "allowed":
      return <>{children}</>;
    case "loading":
      return <PageSkeleton />;
    case "upcoming":
      return <ComingSoon backHref="/dashboard" />;
    case "denied":
      return (
        <AccessDenied
          backHref="/dashboard"
          featureName={decision.feature?.name}
          requirements={decision.missing.map(describePermission)}
          managersOnly={decision.managersOnly}
        />
      );
  }
}
