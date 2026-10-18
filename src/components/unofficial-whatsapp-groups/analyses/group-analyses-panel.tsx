"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateGroupAnalysisAction } from "@/app/actions/unofficial-whatsapp-groups";
import Button from "@/components/elevated-design/button";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowSquareOut, Brain, Eye, Pause, Play, Plus } from "@/components/icons";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { useWorkspace } from "@/contexts/workspace-context";
import { Link, useRouter } from "@/i18n/routing";
import type { GroupAnalysisRow, WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";

import { AnalysisStatusMark, TriggerSummary } from "../kit/figures";
import { MarkDot } from "../kit/kpi-band";
import { NotFollowedNotice } from "../kit/notices";
import { RelativeTime } from "../kit/relative-time";
import { groupsRoutes } from "../kit/routes";
import { useGroupsFormat } from "../kit/use-groups-format";
import { AnalysisFormSheet } from "./analysis-form-sheet";
import { NextCycle, RowAction } from "./analysis-parts";

type PanelGroup = Pick<WorkspaceGroup, "id" | "subject" | "pictureUrl" | "memberCount" | "followedAt">;

type GroupAnalysesPanelProps = {
  analyses: GroupAnalysisRow[];
  onChanged: () => void;
  onFollow?: () => void;
  followBusy?: boolean;
} & ({ group: PanelGroup; groupId?: never; followed?: never } | { group?: never; groupId: string; followed: boolean });

export function GroupAnalysesPanel(props: GroupAnalysesPanelProps) {
  const { analyses, onChanged, onFollow, followBusy } = props;
  const groupId = props.group ? props.group.id : props.groupId;
  const followed = props.group ? Boolean(props.group.followedAt) : props.followed;
  const t = useTranslations("unofficialGroups.analyses.groupPanel");
  const tc = useTranslations("unofficialGroups.analyses");
  const tl = useTranslations("unofficialGroups.analyses.listPage");
  const tp = useTranslations("unofficialGroups.analyses.panel");
  const router = useRouter();
  const fmt = useGroupsFormat();
  const { can } = useWorkspace();
  const canConfigure = can("unofficial_whatsapp_groups", "configure");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleStatus = useCallback(
    async (row: GroupAnalysisRow) => {
      const status = row.status === "active" ? "paused" : "active";
      setBusyId(row.id);
      const result = await updateGroupAnalysisAction(row.id, { status });
      setBusyId(null);
      if (result.error) {
        toast.error(tc("toggleFailed"), { description: result.error });
        return;
      }
      toast(status === "active" ? tc("resumed") : tc("paused"), { description: row.name });
      onChanged();
    },
    [onChanged, tc],
  );

  const columns = useMemo<DashboardTableColumn<GroupAnalysisRow>[]>(
    () => [
      {
        key: "name",
        header: tl("columns.analysis"),
        render: (row) => (
          <div className="min-w-0 max-w-[22rem]">
            <Link
              href={groupsRoutes.analysis(row.id)}
              aria-label={tl("openAria", { name: row.name })}
              onClick={(event) => event.stopPropagation()}
              className="block truncate rounded-sm text-xs font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {row.name}
            </Link>
            {row.prompt ? (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={row.prompt}>
                {row.prompt}
              </p>
            ) : null}
          </div>
        ),
      },
      { key: "status", header: tl("columns.status"), render: (row) => <AnalysisStatusMark analysis={row} /> },
      {
        key: "trigger",
        header: tl("columns.trigger"),
        render: (row) => (
          <span className="text-xs text-foreground">
            <TriggerSummary analysis={row} withBatch />
          </span>
        ),
      },
      { key: "nextCycle", header: tl("columns.nextCycle"), render: (row) => <NextCycle analysis={row} /> },
      {
        key: "cycles",
        header: tl("columns.cycles"),
        className: "text-right",
        render: (row) => <span className="readout text-xs tabular-nums text-foreground">{fmt.num(row.runs)}</span>,
      },
      {
        key: "failures",
        header: t("failures"),
        className: "text-right",
        render: (row) => (
          <span className="readout inline-flex items-center justify-end gap-1.5 text-xs tabular-nums text-foreground">
            {row.failures > 0 ? <MarkDot mark="fault" /> : null}
            {fmt.num(row.failures)}
          </span>
        ),
      },
      { key: "lastCycle", header: tl("columns.lastCycle"), render: (row) => <RelativeTime at={row.lastRunAt} className="readout whitespace-nowrap text-xs tabular-nums" /> },
    ],
    [fmt, t, tl],
  );

  const renderRowActions = useCallback(
    (row: GroupAnalysisRow) => (
      <div className="flex items-center gap-1">
        {canConfigure ? (
          <RowAction
            label={row.status === "active" ? tc("pause") : tc("resume")}
            icon={row.status === "active" ? <Pause className="h-3.5 w-3.5" weight="bold" /> : <Play className="h-3.5 w-3.5" weight="bold" />}
            disabled={busyId === row.id}
            onClick={() => void toggleStatus(row)}
          />
        ) : null}
        <RowAction label={tc("open")} icon={<Eye className="h-3.5 w-3.5" weight="bold" />} onClick={() => router.push(groupsRoutes.analysis(row.id))} />
      </div>
    ),
    [busyId, canConfigure, router, tc, toggleStatus],
  );

  const createButton = canConfigure ? (
    <TooltipWrapper content={tp("createNeedsFollow")} enabled={!followed}>
      <Button
        variant="primary"
        size="sm"
        title={tc("create")}
        icon={<Plus className="h-4 w-4" weight="bold" />}
        iconVisible
        iconSide="left"
        disabled={!followed}
        onClick={() => setSheetOpen(true)}
      />
    </TooltipWrapper>
  ) : null;

  return (
    <div className="space-y-3">
      {!followed ? <NotFollowedNotice onFollow={onFollow} busy={followBusy} /> : null}

      <DashboardTable<GroupAnalysisRow>
        data={analyses}
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(groupsRoutes.analysis(row.id))}
        renderRowActions={renderRowActions}
        headerLeft={
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold leading-tight text-foreground">{t("title")}</h3>
            <p className="text-xs text-muted-foreground">{tp("description")}</p>
          </div>
        }
        headerRight={
          <div className="flex items-center gap-2">
            <Link
              href={groupsRoutes.analyses({ groupId })}
              className="inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("viewInList")}
              <ArrowSquareOut className="h-3.5 w-3.5" weight="bold" />
            </Link>
            {createButton}
          </div>
        }
        emptyState={{
          icon: <Brain className="h-7 w-7 text-muted-foreground" />,
          title: followed ? t("empty") : tp("emptyNotFollowed"),
        }}
      />

      {canConfigure && followed ? (
        <AnalysisFormSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          presetGroupId={groupId}
          lockGroup
          group={props.group}
          onSaved={() => onChanged()}
        />
      ) : null}
    </div>
  );
}
