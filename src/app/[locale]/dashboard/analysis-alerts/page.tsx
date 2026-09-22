"use client";

import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { CommentAnalysisAlerts } from "@/components/audience/alerts";
import { EmptyState, Skeleton } from "@/components/audience/shared";
import { Bell } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";

export default function AnalysisAlertsPage() {
  const t = useTranslations("audience.alertsPage");
  const tc = useTranslations("metricsOps.common");
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();

  const canManage = !permissionsLoading && can("audience", "send");

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        badge={t("badge")}
        description={currentWorkspace ? t("description") : tc("selectWorkspace")}
        icon={<Bell className="h-6 w-6" weight="fill" />}
      />

      {permissionsLoading ? (
        <Skeleton className="h-64" />
      ) : !canManage ? (
        <div className="rounded-[--radius] border border-border bg-card">
          <EmptyState icon={<Bell weight="duotone" />} title={tc("noPermission")} description={t("noPermissionDesc")} />
        </div>
      ) : (
        <CommentAnalysisAlerts accountId={currentWorkspace?.id ?? ""} subjectKind="conversation" />
      )}
    </div>
  );
}
