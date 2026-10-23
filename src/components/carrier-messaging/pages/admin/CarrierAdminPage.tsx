"use client";

import { motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { adminListCarrierSendersAction, adminListSmsRoutesAction } from "@/app/actions/carrier-messaging";
import { CarrierChannelGate, ComingSoonChip, ComingSoonPanel } from "@/components/carrier-messaging/shared/ComingSoon";
import { useCarrierChannels } from "@/lib/carrier-messaging/use-carrier-channels";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ChatCircle, CheckCircle, Hash, PauseCircle, SealCheck, ShieldCheck, WarningCircle, XCircle } from "@/components/icons";
import { SenderStatusChip } from "@/components/rcs/senders/SenderStatusTrack";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import { RCS_SENDER_STATUSES, type RcsSender, type RcsSenderStatus } from "@/lib/rcs/types";
import type { SmsRoute } from "@/lib/sms/types";

import { useLoaded } from "@/lib/carrier-messaging/use-loaded";
import { SmsRouteNumber, SmsRouteStatusChip } from "../sms-senders/SmsSendersPage";
import { AdminRouteActions, AdminSenderActions } from "./AdminRowActions";

type AdminTab = "senders" | "routes";

const ALL = "all";

function WorkspaceCell({ id }: { id?: string }) {
  return id ? (
    <span className="readout block max-w-[10rem] truncate text-xs text-muted-foreground" title={id}>
      {id}
    </span>
  ) : (
    <EmptyValue />
  );
}

function SendersTab() {
  const t = useTranslations("carrierMessaging.pages.admin");
  const tStatus = useTranslations("rcs.senders.status");
  const tReasons = useTranslations("rcs.senders.track.now.pauseReasons");
  const format = useFormatter();
  const refusalText = useCarrierRefusalText();
  const [status, setStatus] = useState<RcsSenderStatus | typeof ALL>(ALL);
  const load = useCallback((signal: AbortSignal) => adminListCarrierSendersAction(status === ALL ? undefined : status, signal), [status]);
  const senders = useLoaded(load, status);
  const list = useMemo(() => senders.data?.senders ?? [], [senders.data]);
  const loading = senders.status === "loading";

  const changed = useCallback(
    (next: RcsSender) => {
      senders.update((current) => ({ senders: current.senders.map((item) => (item.id === next.id ? next : item)) }));
      toast.success(t("senders.changed", { name: next.brand_name }));
    },
    [senders, t],
  );

  const columns = useMemo<DashboardTableColumn<RcsSender>[]>(
    () => [
      {
        header: t("senders.table.brand"),
        key: "brand",
        render: (sender) => (
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{sender.brand_name || <EmptyValue />}</p>
            <p className="readout text-xs tabular-nums text-muted-foreground">{sender.cnpj || <EmptyValue />}</p>
          </div>
        ),
      },
      { header: t("table.workspace"), key: "workspace", render: (sender) => <WorkspaceCell id={sender.workspace_id} /> },
      {
        header: t("senders.table.status"),
        key: "status",
        render: (sender) => (
          <span className="flex flex-col items-start gap-1">
            <SenderStatusChip status={sender.status} />
            {sender.pause_reason ? <span className="text-xs text-muted-foreground">{tReasons(sender.pause_reason)}</span> : null}
          </span>
        ),
      },
      {
        header: t("senders.table.contact"),
        key: "contact",
        render: (sender) => (
          <div className="min-w-0 text-sm">
            <p className="truncate text-foreground">{sender.contact_name || <EmptyValue />}</p>
            <p className="truncate text-xs text-muted-foreground">{sender.contact_email || <EmptyValue />}</p>
          </div>
        ),
      },
      {
        header: t("senders.table.submittedAt"),
        key: "submitted",
        render: (sender) =>
          sender.submitted_at ? (
            <span className="text-sm tabular-nums text-muted-foreground">{format.dateTime(new Date(sender.submitted_at), { dateStyle: "medium" })}</span>
          ) : (
            <EmptyValue />
          ),
      },
      {
        header: t("table.actions"),
        key: "actions",
        className: "text-right",
        render: (sender) => <AdminSenderActions sender={sender} onChanged={changed} onRefused={(refusal) => toast.error(refusalText(refusal))} />,
      },
    ],
    [t, tReasons, format, changed, refusalText],
  );

  const count = (statuses: readonly RcsSenderStatus[]) => list.filter((sender) => statuses.includes(sender.status)).length;
  const stat = (value: number) => (loading ? "..." : format.number(value));

  return (
    <DashboardTable<RcsSender>
      stats={[
        { label: t("senders.stats.total"), value: stat(list.length), icon: <SealCheck className="h-4 w-4 text-muted-foreground" weight="fill" /> },
        { label: t("senders.stats.launched"), value: stat(count(["launched"])), icon: <CheckCircle className="h-4 w-4 text-healthy-ink" weight="fill" /> },
        { label: t("senders.stats.review"), value: stat(count(["submitted", "awaiting_confirmation"])), icon: <ShieldCheck className="h-4 w-4 text-info-ink" weight="fill" /> },
        { label: t("senders.stats.paused"), value: stat(count(["paused", "rejected"])), icon: <WarningCircle className="h-4 w-4 text-warning-ink" weight="fill" /> },
      ]}
      headerLeft={
        <div className="w-full max-w-xs">
          <ElevatedSelect label={t("senders.filter")} aria-label={t("senders.filter")} value={status} onValueChange={(next) => setStatus(next as RcsSenderStatus | typeof ALL)}>
            <ElevatedSelectItem value={ALL}>{t("senders.allStatuses")}</ElevatedSelectItem>
            {RCS_SENDER_STATUSES.map((option) => (
              <ElevatedSelectItem key={option} value={option}>
                {tStatus(option)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        </div>
      }
      data={list}
      columns={columns}
      rowKey={(row) => row.id}
      loading={loading}
      emptyState={
        senders.status === "failed"
          ? {
              icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
              title: t("failedTitle"),
              description: refusalText(senders.error),
              action: <Button variant="secondary" title={t("retry")} onClick={senders.reload} />,
            }
          : { icon: <SealCheck className="h-7 w-7 text-muted-foreground" weight="fill" />, title: t("senders.empty.title"), description: t("senders.empty.description") }
      }
    />
  );
}

function RoutesTab() {
  const t = useTranslations("carrierMessaging.pages.admin");
  const format = useFormatter();
  const refusalText = useCarrierRefusalText();
  const load = useCallback((signal: AbortSignal) => adminListSmsRoutesAction(signal), []);
  const routes = useLoaded(load);
  const list = useMemo(() => routes.data?.routes ?? [], [routes.data]);
  const loading = routes.status === "loading";

  const changed = useCallback(
    (next: SmsRoute) => {
      routes.update((current) => ({ routes: current.routes.map((item) => (item.id === next.id ? { ...next, workspace_id: next.workspace_id ?? item.workspace_id } : item)) }));
      toast.success(t("routes.changed", { prefix: next.brand_prefix }));
    },
    [routes, t],
  );

  const columns = useMemo<DashboardTableColumn<SmsRoute>[]>(
    () => [
      { header: t("routes.table.prefix"), key: "prefix", render: (route) => <span className="font-semibold text-foreground">{route.brand_prefix}</span> },
      { header: t("table.workspace"), key: "workspace", render: (route) => <WorkspaceCell id={route.workspace_id} /> },
      { header: t("routes.table.number"), key: "number", render: (route) => <SmsRouteNumber route={route} /> },
      { header: t("routes.table.status"), key: "status", render: (route) => <SmsRouteStatusChip route={route} /> },
      {
        header: t("routes.table.createdAt"),
        key: "createdAt",
        render: (route) => <span className="text-sm tabular-nums text-muted-foreground">{format.dateTime(new Date(route.created_at), { dateStyle: "medium" })}</span>,
      },
      { header: t("table.actions"), key: "actions", className: "text-right", render: (route) => <AdminRouteActions route={route} onChanged={changed} /> },
    ],
    [t, format, changed],
  );

  const stat = (value: number) => (loading ? "..." : format.number(value));

  return (
    <DashboardTable<SmsRoute>
      stats={[
        { label: t("routes.stats.total"), value: stat(list.length), icon: <ChatCircle className="h-4 w-4 text-muted-foreground" weight="fill" /> },
        { label: t("routes.stats.dedicated"), value: stat(list.filter((route) => route.kind === "dedicated").length), icon: <Hash className="h-4 w-4 text-muted-foreground" /> },
        { label: t("routes.stats.paused"), value: stat(list.filter((route) => route.status === "paused").length), icon: <PauseCircle className="h-4 w-4 text-warning-ink" weight="fill" /> },
      ]}
      data={list}
      columns={columns}
      rowKey={(row) => row.id}
      loading={loading}
      emptyState={
        routes.status === "failed"
          ? {
              icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
              title: t("failedTitle"),
              description: refusalText(routes.error),
              action: <Button variant="secondary" title={t("retry")} onClick={routes.reload} />,
            }
          : { icon: <ChatCircle className="h-7 w-7 text-muted-foreground" weight="fill" />, title: t("routes.empty.title"), description: t("routes.empty.description") }
      }
    />
  );
}

export function CarrierAdminPage() {
  const t = useTranslations("carrierMessaging.pages.admin");
  const [tab, setTab] = useState<AdminTab>("routes");
  const carrierChannels = useCarrierChannels();
  const rcsSoon = !carrierChannels.launched("rcs");
  const smsSoon = !carrierChannels.launched("sms");
  return (
    <motion.main className="w-full space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardPageHeader
        icon={<ShieldCheck className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
        actions={
          <ElevatedPillToggle<AdminTab>
            size="md"
            aria-label={t("tabsLabel")}
            value={tab}
            onChange={setTab}
            options={[
              {
                value: "senders",
                label: rcsSoon ? (
                  <span className="inline-flex items-center gap-1.5">
                    {t("tabs.senders")}
                    <ComingSoonChip />
                  </span>
                ) : (
                  t("tabs.senders")
                ),
                title: t("tabs.senders"),
                icon: <SealCheck className="h-3.5 w-3.5" />,
              },
              {
                value: "routes",
                label: smsSoon ? (
                  <span className="inline-flex items-center gap-1.5">
                    {t("tabs.routes")}
                    <ComingSoonChip />
                  </span>
                ) : (
                  t("tabs.routes")
                ),
                title: t("tabs.routes"),
                icon: <ChatCircle className="h-3.5 w-3.5" />,
              },
            ]}
          />
        }
      />
      {tab === "senders" ? (
        <CarrierChannelGate channel="rcs" soon={<ComingSoonPanel variant="rcs" compact />}>
          <SendersTab />
        </CarrierChannelGate>
      ) : (
        <CarrierChannelGate channel="sms" soon={<ComingSoonPanel variant="sms" compact />}>
          <RoutesTab />
        </CarrierChannelGate>
      )}
    </motion.main>
  );
}
