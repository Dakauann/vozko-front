"use client";

import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { CommentAnalysisAlerts } from "@/components/audience/alerts";
import { Bell } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";

export default function AnalysisAlertsPage() {
  const t = useTranslations("audience.alertsPage");
  const tc = useTranslations("metricsOps.common");
  const { currentWorkspace } = useWorkspace();

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        badge={t("badge")}
        description={currentWorkspace ? t("description") : tc("selectWorkspace")}
        icon={<Bell className="h-6 w-6" weight="fill" />}
      />

      <CommentAnalysisAlerts accountId={currentWorkspace?.id ?? ""} subjectKind="conversation" />
    </div>
  );
}
