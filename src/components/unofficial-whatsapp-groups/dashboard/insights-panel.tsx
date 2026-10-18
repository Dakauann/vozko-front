"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/audience/shared";
import Button from "@/components/elevated-design/button";
import { Lightbulb, Plus } from "@/components/icons";
import { QuietEmpty } from "@/components/unofficial-whatsapp-groups/kit/empty";
import { WindowToggle } from "@/components/unofficial-whatsapp-groups/kit/filters";
import { GroupIdentity } from "@/components/unofficial-whatsapp-groups/kit/identity";
import { GroupsPanel } from "@/components/unofficial-whatsapp-groups/kit/panel";
import { RelativeTime } from "@/components/unofficial-whatsapp-groups/kit/relative-time";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { AlertChip } from "@/components/unofficial-whatsapp-groups/marks";
import { Link } from "@/i18n/routing";
import type { GroupInsight, WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";

import { filterInsights, INSIGHT_FILTERS, insightCounts, type InsightFilter } from "./dashboard-data";

const META_LINK =
  "max-w-[16rem] truncate rounded-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function InsightsPanel({
  insights,
  groupsById,
  timezone,
  loading,
  canConfigure,
  className,
}: {
  insights: GroupInsight[];
  groupsById: ReadonlyMap<string, WorkspaceGroup>;
  timezone: string;
  loading: boolean;
  canConfigure: boolean;
  className?: string;
}) {
  const t = useTranslations("unofficialGroups.dashboard.insightsPanel");
  const [filter, setFilter] = useState<InsightFilter>("all");
  const counts = useMemo(() => insightCounts(insights), [insights]);
  const shown = useMemo(() => filterInsights(insights, filter), [insights, filter]);

  return (
    <GroupsPanel
      title={t("title")}
      subtitle={t("subtitle")}
      className={className}
      actions={
        insights.length > 0 ? (
          <WindowToggle<InsightFilter>
            ariaLabel={t("filterLabel")}
            value={filter}
            onChange={setFilter}
            options={INSIGHT_FILTERS.map((value) => ({ value, label: t(`filters.${value}`, { count: counts[value] }) }))}
          />
        ) : null
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <QuietEmpty
          icon={<Lightbulb />}
          message={t("empty")}
          action={
            canConfigure ? (
              <Button
                variant="secondary"
                size="sm"
                link={groupsRoutes.analyses({ action: "create" })}
                newTab={false}
                title={t("create")}
                icon={<Plus className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
              />
            ) : undefined
          }
        />
      ) : shown.length === 0 ? (
        <QuietEmpty icon={<Lightbulb />} message={t("emptyLevel")} />
      ) : (
        <ul className="divide-y divide-border/60">
          {shown.map((insight, index) => {
            const group = groupsById.get(insight.groupId);
            return (
              <li key={`${insight.analysisId}-${insight.createdAt}-${index}`} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="shrink-0 pt-0.5">
                  <AlertChip level={insight.alertLevel} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs leading-snug text-foreground" title={insight.message}>
                    {insight.message}
                  </p>
                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
                    <Link href={groupsRoutes.analysis(insight.analysisId)} className={META_LINK} title={insight.analysisName}>
                      {insight.analysisName}
                    </Link>
                    {group ? (
                      <span className="min-w-0 max-w-[14rem]">
                        <GroupIdentity group={group} href={groupsRoutes.group(group.id)} size="sm" />
                      </span>
                    ) : (
                      <Link href={groupsRoutes.group(insight.groupId)} className={META_LINK}>
                        {t("openGroup")}
                      </Link>
                    )}
                    <RelativeTime at={insight.createdAt} timeZone={timezone} className="readout whitespace-nowrap tabular-nums" />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GroupsPanel>
  );
}
