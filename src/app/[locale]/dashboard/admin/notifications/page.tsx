"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { BroadcastComposeDialog } from "@/components/admin/notifications/broadcast-compose-dialog";
import { BroadcastRecipientsSheet } from "@/components/admin/notifications/broadcast-recipients-sheet";
import { useReadShareLabel } from "@/components/admin/notifications/use-read-share-label";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowsClockwise, Bell, CheckCircle, Envelope, Hourglass, ListBullets, Plus } from "@/components/icons";
import { PagedListFooter } from "@/components/leads/detail/PagedListFooter";
import { SEVERITY_CHIP } from "@/components/notifications/notification-visuals";
import { AccessDenied } from "@/components/ui/access-denied";
import { useAuth } from "@/contexts/auth-context";
import { useBroadcastArrival, useNotificationBroadcasts } from "@/hooks/use-notifications";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { isSystemAdmin } from "@/lib/auth/roles";
import type { Broadcast } from "@/lib/notifications/broadcast";

const KNOWN_AUDIENCES = new Set(["everyone", "managers", "permission"]);

function AdminNotifications() {
  const t = useTranslations("adminNotifications");
  const tNotifications = useTranslations("notifications");
  const format = useFormatter();
  const broadcasts = useNotificationBroadcasts();
  const arrive = useBroadcastArrival();
  const readShareLabel = useReadShareLabel();
  const [composing, setComposing] = useState(false);
  const [reading, setReading] = useState<Broadcast | null>(null);

  const pages = useMemo(() => broadcasts.data?.pages ?? [], [broadcasts.data]);
  const items = useMemo(() => pages.flatMap((page) => page.items), [pages]);
  const loading = broadcasts.isPending;
  const failed = broadcasts.isError && !broadcasts.data;
  const statValue = (count: number) => (loading ? "..." : format.number(count));

  const columns = useMemo<DashboardTableColumn<Broadcast>[]>(
    () => [
      {
        header: t("table.notification"),
        key: "notification",
        render: (broadcast) => {
          const tone = SEVERITY_CHIP[broadcast.severity];
          return (
            <div className="min-w-[14rem] max-w-md space-y-1">
              <button
                type="button"
                title={t("recipients.open")}
                onClick={(event) => {
                  event.stopPropagation();
                  setReading(broadcast);
                }}
                className="block max-w-full truncate rounded-[--radius] text-left text-sm font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {broadcast.title}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{tNotifications(`categories.${broadcast.category}`)}</span>
                {tone ? <StatusChip tone={tone} label={tNotifications(`severity.${broadcast.severity}`)} className="px-1.5 py-0 text-2xs" /> : null}
              </div>
            </div>
          );
        },
      },
      {
        header: t("table.target"),
        key: "target",
        render: (broadcast) => (
          <span className="text-sm text-foreground">
            {broadcast.target.all ? t("target.all") : t("target.some", { count: broadcast.target.workspaceIds?.length ?? 0 })}
          </span>
        ),
      },
      {
        header: t("table.audience"),
        key: "audience",
        render: (broadcast) => (
          <span className="text-sm text-foreground">
            {broadcast.audience.kind === "users"
              ? t("audience.users", { count: broadcast.audience.userIds?.length ?? 0 })
              : KNOWN_AUDIENCES.has(broadcast.audience.kind)
                ? t(`audience.${broadcast.audience.kind}`)
                : broadcast.audience.kind}
          </span>
        ),
      },
      {
        header: t("table.email"),
        key: "email",
        render: (broadcast) => <span className="text-sm text-muted-foreground">{broadcast.email ? t("email.on") : t("email.off")}</span>,
      },
      {
        header: t("table.status"),
        key: "status",
        render: (broadcast) =>
          broadcast.status === "completed" ? (
            <div className="space-y-1">
              <StatusChip tone="healthy" label={t("status.completed")} className="px-2 py-0.5 text-2xs" />
              {broadcast.workspaceCount !== undefined ? (
                <p className="text-2xs tabular-nums text-muted-foreground">{t("status.reached", { count: broadcast.workspaceCount })}</p>
              ) : null}
            </div>
          ) : (
            <StatusChip tone="outline" label={t("status.queued")} className="px-2 py-0.5 text-2xs" />
          ),
      },
      {
        header: t("table.recipients"),
        key: "recipients",
        render: (broadcast) =>
          broadcast.recipients === undefined ? (
            <EmptyValue className="text-sm" />
          ) : (
            <span className="text-sm tabular-nums text-foreground">{format.number(broadcast.recipients)}</span>
          ),
      },
      {
        header: t("table.read"),
        key: "read",
        render: (broadcast) => {
          if (broadcast.recipients === undefined) return <EmptyValue className="text-sm" />;
          const share = readShareLabel(broadcast);
          return (
            <div className="space-y-0.5 tabular-nums">
              <p className="text-sm text-foreground">{format.number(broadcast.read ?? 0)}</p>
              {share ? <p className="text-2xs text-muted-foreground">{share}</p> : <EmptyValue className="text-2xs" />}
            </div>
          );
        },
      },
      {
        header: t("table.created"),
        key: "created",
        render: (broadcast) => (
          <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
            {format.dateTime(new Date(broadcast.createdAt), { dateStyle: "short", timeStyle: "short" })}
          </span>
        ),
      },
    ],
    [t, tNotifications, format, readShareLabel],
  );

  const created = (broadcast: Broadcast) => {
    arrive(broadcast);
    setComposing(false);
    toast.success(t("compose.sent"));
  };

  return (
    <motion.main className="w-full space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <DashboardPageHeader icon={<Bell className="h-6 w-6" weight="fill" />} badge={t("header.badge")} description={t("header.description")} />
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <DashboardTable<Broadcast>
          stats={[
            { label: t("stats.listed"), value: statValue(items.length), icon: <ListBullets className="h-4 w-4 text-info-ink" weight="fill" /> },
            {
              label: t("stats.queued"),
              value: statValue(items.filter((item) => item.status !== "completed").length),
              icon: <Hourglass className="h-4 w-4 text-warning-ink" weight="fill" />,
            },
            {
              label: t("stats.completed"),
              value: statValue(items.filter((item) => item.status === "completed").length),
              icon: <CheckCircle className="h-4 w-4 text-healthy-ink" weight="fill" />,
            },
            {
              label: t("stats.withEmail"),
              value: statValue(items.filter((item) => item.email).length),
              icon: <Envelope className="h-4 w-4 text-muted-foreground" weight="fill" />,
            },
          ]}
          headerRight={
            <>
              <Button
                icon={<ArrowsClockwise className="h-4 w-4" weight="bold" />}
                iconVisible
                disabled={broadcasts.isFetching}
                onClick={() => void broadcasts.refetch()}
                title={t("actions.refresh")}
                variant="outline"
              />
              <Button icon={<Plus className="h-4 w-4" weight="bold" />} iconVisible onClick={() => setComposing(true)} title={t("actions.compose")} />
            </>
          }
          data={failed ? [] : items}
          columns={columns}
          rowKey={(broadcast) => broadcast.id}
          onRowClick={setReading}
          loading={loading}
          footer={
            items.length > 0 ? (
              <PagedListFooter
                query={broadcasts}
                pageSizes={pages.map((page) => page.items.length)}
                loadMore={t("actions.loadMore")}
                loadingMore={t("actions.loadingMore")}
              />
            ) : undefined
          }
          emptyState={
            failed
              ? {
                  icon: <Bell className="h-7 w-7 text-destructive-ink" weight="fill" />,
                  title: t("loadFailed"),
                  description: codedErrorMessage(tNotifications, { code: sectionErrorCode(broadcasts.error) }, "") || undefined,
                  action: <Button variant="outline" title={t("actions.refresh")} onClick={() => void broadcasts.refetch()} />,
                }
              : {
                  icon: <Bell className="h-7 w-7 text-muted-foreground" weight="fill" />,
                  title: t("empty.title"),
                  description: t("empty.description"),
                }
          }
        />
      </motion.div>

      {composing ? <BroadcastComposeDialog onClose={() => setComposing(false)} onCreated={created} /> : null}
      <BroadcastRecipientsSheet broadcast={reading} onClose={() => setReading(null)} />
    </motion.main>
  );
}

export default function AdminNotificationsPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <ScreenLoader fit="screen" />;

  if (!isSystemAdmin(user?.role)) return <AccessDenied backHref="/dashboard" />;

  return <AdminNotifications />;
}
