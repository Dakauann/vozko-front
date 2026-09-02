"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { CommentAnalysisAudience } from "@/components/instagram/comment-analysis-audience";
import { EmptyState, Skeleton } from "@/components/instagram/comment-analysis-shared";
import { UsersThree } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * Métricas > Audiência: the comment-analysis dashboard across the
 * workspace's accounts. The scope (account, post) lives in the URL so the
 * post detail dialog can deep-link here and a view can be shared.
 */
export default function AudiencePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <AudiencePageBody />
    </Suspense>
  );
}

function AudiencePageBody() {
  const t = useTranslations("commentAnalysis.audience");
  const tc = useTranslations("metricsOps.common");
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Matches the API: every /comment-analysis read is comment_analysis:read.
  const canRead = !permissionsLoading && can("comment_analysis", "read");

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
      <DashboardPageHeader
        badge={t("badge")}
        description={currentWorkspace ? t("description", { name: currentWorkspace.name }) : tc("selectWorkspace")}
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
