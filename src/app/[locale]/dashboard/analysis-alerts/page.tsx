"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { CommentAnalysisAlerts } from "@/components/audience/alerts";
import { EmptyState, Panel, Skeleton } from "@/components/audience/shared";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { Bell } from "@/components/icons";
import { AUDIENCE_SOURCES, type AudienceSource } from "@/lib/audience/types";
import { useWorkspace } from "@/contexts/workspace-context";

/**
 * Métricas > Alertas: what the analysis engine should tell you about.
 *
 * It sits under Métricas, beside Atendimento and Audiência, because that is what
 * an alert is about: the vocabulary it arms on ("quality below 70",
 * "conversations waiting on a person") is the same set of figures the Audiência
 * dashboard reports, and an operator who has just seen one go wrong is the
 * person who wants to be told next time.
 *
 * This page owns the CONVERSATION rules, which are workspace-scoped and had no
 * home before: a conversation rule is keyed on the workspace because there is no
 * channel account to key it on. Comment rules stay on the Instagram account's
 * own Audiência tab, where their account is already in scope. Both render the
 * same component against the same endpoints.
 */
export default function AnalysisAlertsPage() {
  const t = useTranslations("audience.alertsPage");
  const tChannel = useTranslations("audience.channels");
  const tc = useTranslations("metricsOps.common");
  const { currentWorkspace, can, permissionsLoading } = useWorkspace();

  // Matches the API: arming an alert is audience:send, because it sends.
  const canManage = !permissionsLoading && can("audience", "send");

  // A rule watches one channel, so this is asked before anything else rather
  // than offering an "all channels" option that could never be armed.
  const channels = AUDIENCE_SOURCES.filter((s) => s !== "instagram");
  const [source, setSource] = useState<AudienceSource>(channels[0]);

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
        <>
          <Panel title={t("channelTitle")} description={t("channelDescription")}>
            <ElevatedSelect
              label={t("channelLabel")}
              value={source}
              onValueChange={(v) => setSource(v as AudienceSource)}
              className="max-w-xs"
            >
              {channels.map((s) => (
                <ElevatedSelectItem key={s} value={s}>
                  {tChannel(s)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </Panel>

          {/*
            Remounted per channel: the rule list, the metric picker and the
            sender list are all scoped to it, and carrying a previous channel's
            draft across would arm a rule on a number it does not belong to.
          */}
          <CommentAnalysisAlerts
            key={source}
            accountId={currentWorkspace?.id ?? ""}
            subjectKind="conversation"
            source={source}
          />
        </>
      )}
    </div>
  );
}
