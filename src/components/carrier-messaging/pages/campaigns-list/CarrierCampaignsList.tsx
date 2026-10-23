"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { deleteCarrierCampaignAction, listCarrierCampaignsAction, transitionCarrierCampaignAction } from "@/app/actions/carrier-messaging";
import { CarrierCampaignStatusChip, CarrierChannelChip } from "@/components/carrier-messaging/shared/CarrierLabels";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { CalendarBlank, CheckCircle, Copy, Megaphone, PaperPlaneTilt, Plus, Trash, XCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { CAMPAIGN_STATUSES, type CampaignChannel, type CampaignStatus, type CampaignSummary } from "@/lib/carrier-messaging/campaigns";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";

import { ComingSoonChip } from "../../shared/ComingSoon";
import { useCarrierChannels } from "@/lib/carrier-messaging/use-carrier-channels";
import { useScheduleSummary } from "../../shared/schedule-summary";
import { CarrierAreaGate } from "@/components/carrier-messaging/shared/ComingSoon";

const PAGE_SIZE = 20;

type ChannelFilter = "all" | CampaignChannel;
type StatusFilter = "all" | CampaignStatus;

const CHANNEL_FILTERS: readonly ChannelFilter[] = ["all", "rcs", "sms"];
const STATUS_FILTERS: readonly StatusFilter[] = ["all", ...CAMPAIGN_STATUSES];

type Loaded = { key: string; items: CampaignSummary[]; total: number; error: null } | { key: string; items: CampaignSummary[]; total: number; error: CodedRefusal };

function useCampaignPage(channel: ChannelFilter, status: StatusFilter, page: number) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${channel}:${status}:${page}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    void listCarrierCampaignsAction(
      { channel: channel === "all" ? undefined : channel, status: status === "all" ? undefined : status, page, limit: PAGE_SIZE },
      controller.signal,
    ).then((answer) => {
      if (controller.signal.aborted) return;
      setLoaded(answer.data ? { key, items: answer.data.items, total: answer.data.total, error: null } : { key, items: [], total: 0, error: answer.error });
    });
    return () => controller.abort();
  }, [channel, status, page, key]);
  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  return { loading: loaded?.key !== key, loaded, reload };
}

function Count({ value }: { value: number }) {
  const format = useFormatter();
  return <span className="readout text-sm tabular-nums text-foreground">{format.number(value)}</span>;
}

interface CampaignsListProps {
  onOpen: (campaignId: string) => void;
  onCreate: () => void;
  headerActions?: ReactNode;
}

function CarrierCampaignsListBody({ onOpen, onCreate, headerActions }: CampaignsListProps) {
  const t = useTranslations("carrierMessaging.pages.campaigns");
  const tShared = useTranslations("carrierMessaging");
  const format = useFormatter();
  const refusalText = useCarrierRefusalText();
  const scheduleOf = useScheduleSummary();
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const carrierChannels = useCarrierChannels();
  const soon = (value: ChannelFilter) => value !== "all" && !carrierChannels.launched(value);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<CampaignSummary | null>(null);
  const { loading, loaded, reload } = useCampaignPage(channel, status, page);
  const items = loaded?.items ?? [];
  const total = loaded?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const duplicate = async (row: CampaignSummary) => {
    const answer = await transitionCarrierCampaignAction(row.id, "duplicate");
    if (answer.error) {
      toast.error(t("toast.duplicateFailed"), { description: refusalText(answer.error) });
      return;
    }
    toast.success(t("toast.duplicated", { name: row.name }));
    reload();
    onOpen(answer.data.id);
  };

  const remove = async (row: CampaignSummary) => {
    const answer = await deleteCarrierCampaignAction(row.id);
    if (answer.error) {
      toast.error(t("toast.deleteFailed"), { description: refusalText(answer.error) });
      return false;
    }
    toast.success(t("toast.deleted", { name: row.name }));
    reload();
    return true;
  };

  const columns = useMemo<DashboardTableColumn<CampaignSummary>[]>(
    () => [
      {
        header: t("table.campaign"),
        key: "name",
        render: (row) => (
          <div className="min-w-0 space-y-1">
            <p className="truncate font-semibold text-foreground">{row.name || t("untitled")}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <CarrierChannelChip channel={row.channel} />
              <span className="text-xs text-muted-foreground">{tShared(`campaignKinds.${row.kind}`)}</span>
            </div>
          </div>
        ),
      },
      { header: t("table.status"), key: "status", render: (row) => <CarrierCampaignStatusChip status={row.status} /> },
      {
        header: t("table.schedule"),
        key: "schedule",
        render: (row) => {
          const summary = scheduleOf(row);
          return summary ? (
            <span className="inline-flex items-start gap-1.5 text-sm text-foreground">
              <CalendarBlank aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {summary}
            </span>
          ) : (
            <EmptyValue />
          );
        },
      },
      { header: tShared("funnel.sent"), key: "sent", className: "text-right", render: (row) => <Count value={row.stats.sent} /> },
      { header: tShared("funnel.delivered"), key: "delivered", className: "text-right", render: (row) => <Count value={row.stats.delivered} /> },
      { header: tShared("funnel.read"), key: "read", className: "text-right", render: (row) => <Count value={row.stats.read} /> },
      { header: tShared("funnel.clicks"), key: "clicks", className: "text-right", render: (row) => <Count value={row.stats.clicks} /> },
    ],
    [t, tShared, scheduleOf],
  );

  const sent = items.reduce((sum, row) => sum + row.stats.sent, 0);
  const delivered = items.reduce((sum, row) => sum + row.stats.delivered, 0);
  const running = items.filter((row) => row.status === "running").length;
  const shown = (value: number) => (loading ? "..." : format.number(value));

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="space-y-6">
      <DashboardPageHeader
        icon={<Megaphone className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
        actions={headerActions}
      />
      <DashboardTable<CampaignSummary>
        data={items}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) => onOpen(row.id)}
        stats={[
          { label: t("stats.total"), value: shown(total), icon: <Megaphone className="h-4 w-4 text-muted-foreground" weight="fill" /> },
          { label: t("stats.running"), value: shown(running), icon: <PaperPlaneTilt className="h-4 w-4 text-healthy-ink" weight="fill" /> },
          { label: t("stats.sent"), value: shown(sent), icon: <PaperPlaneTilt className="h-4 w-4 text-muted-foreground" /> },
          { label: t("stats.delivered"), value: shown(delivered), icon: <CheckCircle className="h-4 w-4 text-muted-foreground" weight="fill" /> },
        ]}
        headerLeft={
          <div className="flex flex-wrap items-center gap-2">
            <ElevatedPillToggle<ChannelFilter>
              aria-label={t("filters.channel")}
              value={channel}
              onChange={(next) => {
                setChannel(next);
                setPage(1);
              }}
              options={CHANNEL_FILTERS.map((value) => ({
                value,
                label: soon(value) ? (
                  <span className="inline-flex items-center gap-1.5">
                    {tShared(`channels.${value}`)}
                    <ComingSoonChip />
                  </span>
                ) : (
                  tShared(`channels.${value}`)
                ),
                title: tShared(`channels.${value}`),
                disabled: soon(value),
              }))}
            />
            <ElevatedPillToggle<StatusFilter>
              aria-label={t("filters.status")}
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              options={STATUS_FILTERS.map((value) => ({ value, label: value === "all" ? t("filters.allStatuses") : tShared(`campaignStatus.${value}`) }))}
            />
          </div>
        }
        headerRight={<Button title={t("create")} icon={<Plus className="h-4 w-4" weight="bold" />} iconVisible iconSide="left" onClick={onCreate} />}
        renderRowActions={(row) => (
          <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="icon" aria-label={t("actions.duplicate", { name: row.name })} icon={<Copy className="h-4 w-4" />} iconVisible onClick={() => void duplicate(row)} />
            {row.status === "draft" || row.status === "ready" ? (
              <Button variant="ghost" size="icon" aria-label={t("actions.delete", { name: row.name })} icon={<Trash className="h-4 w-4" />} iconVisible onClick={() => setDeleting(row)} />
            ) : null}
          </div>
        )}
        pagination={totalPages > 1 ? { currentPage: page, totalPages, pageSize: PAGE_SIZE, totalItems: total, onPageChange: setPage } : undefined}
        paginationText={{ showing: t("pagination.showing"), of: t("pagination.of"), items: t("pagination.items") }}
        emptyState={
          loaded?.error
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("error.title"),
                description: refusalText(loaded.error),
                action: <Button variant="secondary" title={t("error.retry")} onClick={reload} />,
              }
            : {
                icon: <Megaphone className="h-7 w-7 text-muted-foreground" weight="fill" />,
                title: channel === "all" && status === "all" ? t("empty.title") : t("empty.filteredTitle"),
                description: channel === "all" && status === "all" ? t("empty.description") : t("empty.filteredDescription"),
                action: channel === "all" && status === "all" ? <Button title={t("create")} icon={<Plus className="h-4 w-4" weight="bold" />} iconVisible iconSide="left" onClick={onCreate} /> : undefined,
              }
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("confirmDelete.title")}
        description={deleting ? t("confirmDelete.description", { name: deleting.name || t("untitled") }) : undefined}
        confirmLabel={t("confirmDelete.confirm")}
        cancelLabel={t("confirmDelete.cancel")}
        tone="danger"
        onConfirm={async () => (deleting ? remove(deleting) : true)}
      />
    </motion.main>
  );
}

export function CarrierCampaignsList(props: CampaignsListProps) {
  const t = useTranslations("carrierMessaging.pages.campaigns");
  return (
    <CarrierAreaGate badge={t("header.badge")} description={t("header.description")}>
      <CarrierCampaignsListBody {...props} />
    </CarrierAreaGate>
  );
}
