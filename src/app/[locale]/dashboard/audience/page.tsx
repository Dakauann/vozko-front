"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { CommentAnalysisAudience } from "@/components/audience/audience";
import { EmptyState, Skeleton } from "@/components/audience/shared";
import { UsersThree } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";

export default function AudiencePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <AudiencePageBody />
    </Suspense>
  );
}

function AudiencePageBody() {
  const t = useTranslations("audience.page");
  const tc = useTranslations("metricsOps.common");
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canRead = !permissionsLoading && can("audience", "read");

  const onScopeChange = useCallback(
    (accountId: string, containerId: string | undefined) => {
      const params = new URLSearchParams();
      if (accountId) params.set("accountId", accountId);
      if (containerId) params.set("containerId", containerId);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return (
    <div className="space-y-4">
      {
}
      <DashboardPageHeader
        badge={t("badge")}
        description={currentWorkspace ? t("description") : tc("selectWorkspace")}
        icon={<UsersThree className="h-6 w-6" weight="fill" />}
      />

      {permissionsLoading ? (
        <Skeleton className="h-64" />
      ) : !canRead ? (
        <div className="rounded-[--radius] border border-border bg-card">
          <EmptyState icon={<UsersThree weight="duotone" />} title={tc("noPermission")} description={t("noPermissionDesc")} />
        </div>
      ) : (
        <CommentAnalysisAudience
          initialAccountId={searchParams.get("accountId") ?? undefined}
          initialContainerId={searchParams.get("containerId") ?? undefined}
          onScopeChange={onScopeChange}
        />
      )}
    </div>
  );
}
