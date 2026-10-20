"use client";

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { ChatCircle, DownloadSimple, UserCircle, Users } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import EntryConversationDialog from "@/components/dashboard/EntryConversationDialog";
import EntryStageBadge from "@/components/dashboard/EntryStageBadge";
import type { EntryStage, EntryType, Stage } from "@/lib/conversations/types";
import { formatPhoneForDisplay } from "@/lib/phone/display";

import { CAMPAIGN_STAGE_COLOR, CAMPAIGN_STAGE_STATUS, type CampaignStageKey } from "./CampaignLiveOverview";

export interface CampaignContactRow {
  id: string;
  number: string;
  name?: string;
  group?: { jid?: string };
  conversationId: string | null;
  status?: string;
  variables?: string[];
  metadata?: Record<string, unknown>;
  updatedAt?: string;
  marks?: ReactNode;
  note?: string;
}

export interface CampaignContactFailure {
  description: string;
  code: number | null;
}

const STAGE_BY_STATUS = Object.fromEntries(
  Object.entries(CAMPAIGN_STAGE_STATUS).map(([stage, status]) => [status, stage as CampaignStageKey]),
) as Record<string, CampaignStageKey>;

function StatusMark({ status }: { status?: string }) {
  const t = useTranslations("campaignDetail.stage");
  const stage = STAGE_BY_STATUS[status ?? "PENDING"] ?? "pending";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground">
      <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: CAMPAIGN_STAGE_COLOR[stage] }} />
      {t(stage)}
    </span>
  );
}

function filledMetadata(metadata: CampaignContactRow["metadata"]): [string, string][] {
  return Object.entries(metadata ?? {})
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== "object" && String(value).trim() !== "")
    .map(([key, value]) => [key, String(value)]);
}

export function CampaignContactsTable({
  entryType,
  rows,
  loading,
  totalItems,
  page,
  totalPages,
  pageSize,
  onPageChange,
  describeFailure,
  stages,
  entryStages,
  canManageStages,
  canReadStages,
  onAssignStage,
  onRemoveStage,
  exporting,
  onExport,
  toolbar,
}: {
  entryType: EntryType;
  rows: CampaignContactRow[];
  loading: boolean;
  totalItems: number;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  describeFailure: (row: CampaignContactRow) => CampaignContactFailure | null;
  stages: Stage[];
  entryStages: Record<string, EntryStage | null>;
  canManageStages: boolean;
  canReadStages: boolean;
  onAssignStage: (stageId: string, entryId: string, entryType: EntryType) => Promise<void>;
  onRemoveStage: (stageId: string, entryId: string, entryType: EntryType) => Promise<void>;
  exporting: boolean;
  onExport: () => void;
  toolbar: ReactNode;
}) {
  const t = useTranslations("campaignDetail.contacts");
  const format = useFormatter();

  const columns: DashboardTableColumn<CampaignContactRow>[] = [
    {
      key: "contact",
      header: t("contact"),
      render: (row) => (
        <div className="min-w-0">
          {row.group ? (
            <>
              <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                {row.name || <EmptyValue />}
                {row.marks}
              </p>
              {row.group.jid ? <p className="truncate font-mono text-xs text-muted-foreground">{row.group.jid}</p> : null}
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 truncate font-mono text-sm text-foreground">
                {formatPhoneForDisplay(row.number)}
                {row.marks}
              </p>
              <p className="truncate text-xs text-muted-foreground">{row.name || t("noName")}</p>
            </>
          )}
          {row.note ? <p className="truncate text-2xs text-muted-foreground">{row.note}</p> : null}
        </div>
      ),
    },
    {
      key: "status",
      header: t("status"),
      render: (row) => <StatusMark status={row.status} />,
    },
    ...(canReadStages
      ? [
          {
            key: "tag",
            header: t("tag"),
            render: (row: CampaignContactRow) => (
              <EntryStageBadge
                entryId={row.id}
                entryType={entryType}
                currentStage={entryStages[row.id]}
                stages={stages}
                canManage={canManageStages}
                canRead={canReadStages}
                translations={{
                  addStage: t("addTag"),
                  removeStage: t("removeTag"),
                  noStages: t("noTags"),
                  changeStage: t("changeTag"),
                }}
                onAssign={onAssignStage}
                onRemove={onRemoveStage}
              />
            ),
          },
        ]
      : []),
    {
      key: "reason",
      header: t("reason"),
      className: "max-w-[280px]",
      render: (row) => {
        const failure = describeFailure(row);
        if (!failure) return <EmptyValue />;
        return (
          <div className="min-w-0" title={failure.description}>
            <p className="truncate text-sm text-foreground">{failure.description}</p>
            {failure.code !== null ? <p className="text-2xs text-muted-foreground">{t("code", { code: failure.code })}</p> : null}
          </div>
        );
      },
    },
    {
      key: "data",
      header: t("data"),
      render: (row) => {
        const metadata = filledMetadata(row.metadata);
        const variables = row.variables ?? [];
        if (variables.length === 0 && metadata.length === 0) return <EmptyValue />;
        const detail = [...variables.map((value, index) => `{{${index + 1}}} ${value}`), ...metadata.map(([key, value]) => `${key}: ${value}`)].join("\n");
        return (
          <span className="text-xs text-muted-foreground" title={detail}>
            {t("dataSummary", { variables: variables.length, fields: metadata.length })}
          </span>
        );
      },
    },
    {
      key: "updated",
      header: t("updated"),
      render: (row) =>
        row.updatedAt ? (
          <span className="readout whitespace-nowrap text-xs text-muted-foreground">
            {format.dateTime(new Date(row.updatedAt), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : (
          <EmptyValue />
        ),
    },
  ];

  return (
    <div data-tour="wd-contacts">
      <DashboardTable<CampaignContactRow>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        stats={[{ label: t("records"), value: format.number(totalItems), icon: <Users className="h-4 w-4 text-info-ink" weight="fill" /> }]}
        headerRight={
          <Button
            variant="outline-subtle"
            title={exporting ? t("exporting") : t("export")}
            icon={<DownloadSimple weight="bold" className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            onClick={onExport}
            disabled={exporting}
          />
        }
        toolbar={toolbar}
        renderRowActions={(row) =>
          row.conversationId ? (
          <EntryConversationDialog
            entryId={row.conversationId}
            entryType={entryType}
            phoneNumber={row.group?.jid ?? row.number}
            contactName={row.name}
            trigger={
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={t("viewConversation")}
                aria-label={t("viewConversation")}
              >
                <ChatCircle weight="fill" className="h-4 w-4" />
              </button>
            }
          />
          ) : null
        }
        emptyState={{ icon: <UserCircle className="h-6 w-6" weight="fill" />, title: t("empty") }}
        pagination={totalPages > 1 ? { currentPage: page, totalPages, pageSize, totalItems, onPageChange } : undefined}
      />
    </div>
  );
}
