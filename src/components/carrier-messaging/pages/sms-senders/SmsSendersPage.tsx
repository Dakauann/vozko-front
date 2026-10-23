"use client";

import { motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { deleteSmsRouteAction, listSmsRoutesAction, transitionSmsRouteAction, type SmsRouteTransition } from "@/app/actions/sms";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ChatCircle, CheckCircle, Hash, PauseCircle, Plus, XCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import type { SmsRoute } from "@/lib/sms/types";

import { useLoaded } from "@/lib/carrier-messaging/use-loaded";
import { SmsRouteSheet } from "./SmsRouteSheet";
import { CarrierAreaGate, CarrierChannelGate, ComingSoonPage } from "@/components/carrier-messaging/shared/ComingSoon";

export function SmsRouteStatusChip({ route }: { route: Pick<SmsRoute, "status"> }) {
  const t = useTranslations("carrierMessaging.pages.smsSenders.status");
  return <StatusChip tone={route.status === "active" ? "healthy" : "warning"} label={t(route.status)} />;
}

export function SmsRouteNumber({ route }: { route: Pick<SmsRoute, "kind" | "number"> }) {
  const t = useTranslations("carrierMessaging.pages.smsSenders");
  return (
    <span className="block">
      <span className="block text-sm font-medium text-foreground">{t(`kinds.${route.kind}`)}</span>
      <span className="readout block text-xs tabular-nums text-muted-foreground">{route.kind === "dedicated" && route.number ? route.number : t("sharedNumber")}</span>
    </span>
  );
}

function SmsSendersBody() {
  const t = useTranslations("carrierMessaging.pages.smsSenders");
  const format = useFormatter();
  const refusalText = useCarrierRefusalText();
  const load = useCallback((signal: AbortSignal) => listSmsRoutesAction(signal), []);
  const routes = useLoaded(load);
  const [sheet, setSheet] = useState<{ open: boolean; route: SmsRoute | null }>({ open: false, route: null });
  const [busyId, setBusyId] = useState<string | null>(null);
  const list = useMemo(() => routes.data?.routes ?? [], [routes.data]);
  const loading = routes.status === "loading";

  const replace = useCallback(
    (saved: SmsRoute) =>
      routes.update((current) => ({
        routes: current.routes.some((item) => item.id === saved.id) ? current.routes.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current.routes],
      })),
    [routes],
  );

  const transition = useCallback(
    async (route: SmsRoute, kind: SmsRouteTransition) => {
      setBusyId(route.id);
      const answer = await transitionSmsRouteAction(route.id, kind);
      setBusyId(null);
      if (answer.error) {
        toast.error(refusalText(answer.error));
        return;
      }
      replace(answer.data);
      toast.success(t(`done.${kind}`, { prefix: answer.data.brand_prefix }));
    },
    [refusalText, replace, t],
  );

  const remove = useCallback(
    async (route: SmsRoute) => {
      const answer = await deleteSmsRouteAction(route.id);
      if (answer.error) {
        toast.error(refusalText(answer.error));
        return false;
      }
      routes.update((current) => ({ routes: current.routes.filter((item) => item.id !== route.id) }));
      toast.success(t("done.delete", { prefix: route.brand_prefix }));
    },
    [refusalText, routes, t],
  );

  const columns = useMemo<DashboardTableColumn<SmsRoute>[]>(
    () => [
      {
        header: t("table.prefix"),
        key: "prefix",
        render: (route) => (
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{route.brand_prefix}</p>
            <p className="truncate text-xs text-muted-foreground">{t("table.sample", { prefix: route.brand_prefix })}</p>
          </div>
        ),
      },
      { header: t("table.number"), key: "number", render: (route) => <SmsRouteNumber route={route} /> },
      {
        header: t("table.status"),
        key: "status",
        render: (route) => (
          <span className="flex flex-col items-start gap-1">
            <SmsRouteStatusChip route={route} />
            {route.pause_reason ? <span className="text-xs text-muted-foreground">{t(`pauseReasons.${route.pause_reason}`)}</span> : null}
          </span>
        ),
      },
      {
        header: t("table.createdAt"),
        key: "createdAt",
        render: (route) => <span className="text-sm tabular-nums text-muted-foreground">{format.dateTime(new Date(route.created_at), { dateStyle: "medium" })}</span>,
      },
      {
        header: t("table.actions"),
        key: "actions",
        className: "text-right",
        render: (route) => (
          <div className="flex flex-wrap items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
            <Button variant="outline" size="sm" title={t("edit")} onClick={() => setSheet({ open: true, route })} disabled={busyId === route.id} />
            <Button
              variant="outline"
              size="sm"
              title={route.status === "active" ? t("pause") : t("resume")}
              onClick={() => void transition(route, route.status === "active" ? "pause" : "resume")}
              disabled={busyId === route.id}
            />
            <ConfirmDialog
              trigger={<Button variant="ghost" size="sm" title={t("delete")} disabled={busyId === route.id} />}
              title={t("deleteTitle", { prefix: route.brand_prefix })}
              description={t("deleteDescription")}
              confirmLabel={t("delete")}
              onConfirm={() => remove(route)}
            />
          </div>
        ),
      },
    ],
    [t, format, busyId, transition, remove],
  );

  const stat = (value: number) => (loading ? "..." : format.number(value));
  const create = () => setSheet({ open: true, route: null });

  return (
    <motion.main className="w-full space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardPageHeader
        icon={<ChatCircle className="h-6 w-6" weight="fill" />}
        badge={t("header.badge")}
        description={t("header.description")}
        actions={<Button title={t("create")} icon={<Plus className="h-4 w-4" />} iconVisible onClick={create} />}
      />
      <Notice tone="info" title={t("howItWorks.title")}>
        <p>{t("howItWorks.body")}</p>
      </Notice>
      <DashboardTable<SmsRoute>
        stats={[
          { label: t("stats.total"), value: stat(list.length), icon: <ChatCircle className="h-4 w-4 text-muted-foreground" weight="fill" /> },
          { label: t("stats.active"), value: stat(list.filter((route) => route.can_send).length), icon: <CheckCircle className="h-4 w-4 text-healthy-ink" weight="fill" /> },
          { label: t("stats.paused"), value: stat(list.filter((route) => route.status === "paused").length), icon: <PauseCircle className="h-4 w-4 text-warning-ink" weight="fill" /> },
          { label: t("stats.dedicated"), value: stat(list.filter((route) => route.kind === "dedicated").length), icon: <Hash className="h-4 w-4 text-muted-foreground" /> },
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
            : {
                icon: <ChatCircle className="h-7 w-7 text-muted-foreground" weight="fill" />,
                title: t("empty.title"),
                description: t("empty.description"),
                action: <Button title={t("create")} icon={<Plus className="h-4 w-4" />} iconVisible onClick={create} />,
              }
        }
      />
      <SmsRouteSheet
        open={sheet.open}
        route={sheet.route}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        onUpdated={replace}
        onSaved={(route) => {
          replace(route);
          setSheet({ open: false, route: null });
          toast.success(t("done.save", { prefix: route.brand_prefix }));
        }}
      />
    </motion.main>
  );
}

export function SmsSendersPage() {
  const t = useTranslations("carrierMessaging.pages.smsSenders");
  return (
    <CarrierAreaGate badge={t("header.badge")} description={t("header.description")}>
      <CarrierChannelGate channel="sms" soon={<ComingSoonPage variant="sms" badge={t("header.badge")} description={t("header.description")} />}>
        <SmsSendersBody />
      </CarrierChannelGate>
    </CarrierAreaGate>
  );
}
