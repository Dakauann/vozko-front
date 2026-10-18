"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { TrendUp } from "@/components/icons";
import { flowTotals, hasFlow } from "@/components/unofficial-whatsapp-groups/kit/chart-model";
import { ChartPanel } from "@/components/unofficial-whatsapp-groups/kit/chart-panel";
import { FlowChart } from "@/components/unofficial-whatsapp-groups/kit/charts";
import { SignedFigure } from "@/components/unofficial-whatsapp-groups/kit/figures";
import { GroupIdentity } from "@/components/unofficial-whatsapp-groups/kit/identity";
import { PanelHead } from "@/components/unofficial-whatsapp-groups/kit/panel";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import { useRouter } from "@/i18n/routing";
import type { DailyPoint, GroupGrowth } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { growingGroups } from "./dashboard-data";

export function FlowPanel({ points, loading, className }: { points: DailyPoint[]; loading: boolean; className?: string }) {
  const t = useTranslations("unofficialGroups.dashboard.flow");
  const fmt = useGroupsFormat();
  const totals = useMemo(() => flowTotals(points), [points]);
  return (
    <ChartPanel
      title={t("title")}
      subtitle={t("subtitle")}
      height={230}
      state={loading ? "loading" : hasFlow(points) ? "ready" : "empty"}
      empty={{ icon: <TrendUp />, message: t("empty") }}
      readouts={[
        { label: t("joins"), value: fmt.signed(totals.joins) },
        { label: t("leaves"), value: fmt.signed(-totals.leaves) },
        { label: t("net"), value: fmt.signed(totals.net) },
      ]}
      className={className}
    >
      <FlowChart points={points} height={230} balance />
    </ChartPanel>
  );
}

export function TopGrowingPanel({ groups, loading, className }: { groups: GroupGrowth[]; loading: boolean; className?: string }) {
  const t = useTranslations("unofficialGroups.dashboard.growing");
  const fmt = useGroupsFormat();
  const router = useRouter();
  const growing = useMemo(() => growingGroups(groups), [groups]);

  const columns = useMemo<DashboardTableColumn<GroupGrowth>[]>(
    () => [
      {
        key: "group",
        header: t("columns.group"),
        className: "px-3",
        render: (row) => (
          <div className="min-w-0 max-w-[13rem]">
            <GroupIdentity group={{ id: row.groupId, subject: row.subject }} href={groupsRoutes.group(row.groupId)} />
          </div>
        ),
      },
      {
        key: "net",
        header: t("columns.net"),
        className: "px-3 text-right",
        render: (row) => (
          <div className="flex flex-col items-end">
            <SignedFigure value={row.net} className="text-xs" />
            <span
              title={`${t("columns.joins")} / ${t("columns.leaves")}`}
              className="readout whitespace-nowrap text-2xs tabular-nums text-muted-foreground"
            >
              {fmt.signed(row.joins)} / {fmt.signed(-row.leaves)}
            </span>
          </div>
        ),
      },
    ],
    [t, fmt],
  );

  return (
    <DashboardTable<GroupGrowth>
      className={cn("min-w-0", className)}
      data={growing}
      columns={columns}
      rowKey={(row) => row.groupId}
      loading={loading}
      onRowClick={(row) => router.push(groupsRoutes.group(row.groupId, { tab: "members" }))}
      headerLeft={<PanelHead title={t("title")} subtitle={t("subtitle")} className="border-b-0 pb-0" />}
      emptyState={{ icon: <TrendUp className="h-7 w-7 text-muted-foreground" />, title: t("empty") }}
    />
  );
}
