"use client";

import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { CommentAnalysisAlerts } from "@/components/audience/alerts";
import { EmptyState, Skeleton } from "@/components/audience/shared";
import { Bell } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * Métricas > Alertas: what the analysis engine should tell you about.
 *
 * It sits under Métricas, beside Atendimento and Audiência, because that is what
 * an alert arms on: "quality below 70" and "conversations waiting on a person"
 * are the figures those two dashboards report.
 *
 * This page owns the CONVERSATION rules, which are workspace-scoped and had no
 * home before: a conversation rule is keyed on the workspace because there is no
 * channel account to key it on. Comment rules stay on the Instagram account's
 * own Audiência tab, where their account is already in scope. Both render the
 * same component against the same endpoints.
 *
 * There is deliberately NO channel picker here. One used to sit at the top and
 * silently decide what a new rule watched, while the dialog's own field of the
 * same name decided how the alert was SENT: an operator chose the second, never
 * knowingly chose the first, and ended up with a rule armed on a channel their
 * conversations are not on. It saved, showed "Regra ativa", and never fired.
 * The watched channel now lives in the dialog, next to everything else about the
 * rule, and this page simply lists them all.
 */
export default function AnalysisAlertsPage() {
  const t = useTranslations("audience.alertsPage");
  const tc = useTranslations("metricsOps.common");
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();

  // Matches the API: arming an alert is audience:send, because it sends.
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
