"use client";

import type { ReactNode } from "react";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { AccessDenied } from "@/components/ui/access-denied";
import { ComingSoon } from "@/components/ui/coming-soon";
import { useAccess } from "@/hooks/use-access";
import { usePathname } from "@/i18n/routing";

export function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { decidePath, describePermission } = useAccess();
  const decision = decidePath(pathname);

  switch (decision.status) {
    case "allowed":
      return <>{children}</>;
    case "loading":
      return <ScreenLoader />;
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
