"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { isActionError, type ActionResult } from "@/app/actions/action-result";
import {
  adminListEmailAccountsAction,
  adminPauseEmailAccountAction,
  adminPromoteEmailAccountAction,
  adminReinstateEmailAccountAction,
} from "@/app/actions/email-marketing";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { SesQuotaPanel } from "@/components/email-marketing/ses-quota-panel";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowsClockwise, EnvelopeSimple, Pause, Play, ArrowUp } from "@/components/icons";
import { AccessDenied } from "@/components/ui/access-denied";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";
import { SectionError, sectionRetryDelay, shouldRetrySection } from "@/lib/analytics/section-query";
import { isSystemAdmin } from "@/lib/auth/roles";
import { accountStatusTone, isDormantAccount, isPausedAccount } from "@/lib/email-marketing/ladder";
import type { EmailAccount, EmailAdminAccount } from "@/lib/email-marketing/types";

const PAGE_SIZE = 20;

const KNOWN_SENDING = new Set(["enabled", "disabled", "reinstated"]);

type PendingAction = { kind: "pause" | "reinstate" | "promote"; row: EmailAdminAccount } | null;

function AdminEmailAccounts() {
  const t = useTranslations("emailMarketing.admin");
  const tm = useTranslations("emailMarketing");
  const describe = useEmailError();
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction>(null);
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: ["admin-email-accounts", page],
    queryFn: async ({ signal }) => {
      const result = await adminListEmailAccountsAction(page, PAGE_SIZE, signal);
      if (isActionError(result)) throw new SectionError(result.error, result.status, result.code);
      return result.data;
    },
    retry: shouldRetrySection,
    retryDelay: sectionRetryDelay,
    refetchOnWindowFocus: false,
  });

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  const run = async () => {
    if (!pending) return true;
    const workspaceId = pending.row.account.workspace_id;
    let result: ActionResult<EmailAccount>;
    if (pending.kind === "pause") result = await adminPauseEmailAccountAction(workspaceId, reason.trim());
    else if (pending.kind === "reinstate") result = await adminReinstateEmailAccountAction(workspaceId);
    else result = await adminPromoteEmailAccountAction(workspaceId);
    if (isActionError(result)) {
      toast.error(describe(result));
      return false;
    }
    toast.success(t(`done.${pending.kind}`, { tenant: pending.row.account.tenant_name }));
    setReason("");
    void query.refetch();
    return true;
  };

  const columns: DashboardTableColumn<EmailAdminAccount>[] = [
    {
      header: t("columns.workspace"),
      key: "workspace",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{row.workspace_name || row.account.tenant_name}</p>
          <p className="truncate font-mono text-2xs text-muted-foreground">{row.account.tenant_name}</p>
          <p className="truncate font-mono text-2xs text-muted-foreground">{row.account.workspace_id}</p>
        </div>
      ),
    },
    { header: t("columns.mode"), key: "mode", render: (row) => <StatusChip tone="outline" label={tm(`ladder.steps.${row.account.mode}.name`)} /> },
    {
      header: t("columns.status"),
      key: "status",
      render: (row) => (
        <div className="space-y-1">
          <StatusChip tone={accountStatusTone(row.account.status)} label={tm(`accountStatus.${row.account.status}`)} />
          {row.account.status_reason ? <p className="max-w-[28ch] text-xs text-muted-foreground">{row.account.status_reason}</p> : null}
        </div>
      ),
    },
    {
      header: t("columns.provider"),
      key: "provider",
      render: (row) =>
        isDormantAccount(row.account.status) ? (
          <span className="text-xs text-muted-foreground">{t("sending.dormant")}</span>
        ) : (
          <div className="space-y-1">
            {row.health_error ? (
              <p className="max-w-[28ch] text-xs text-destructive-ink">{t("healthError", { error: row.health_error })}</p>
            ) : KNOWN_SENDING.has(row.sending) ? (
              <StatusChip tone={row.sending === "enabled" || row.sending === "reinstated" ? "healthy" : "fault"} label={t(`sending.${row.sending}`)} />
            ) : (
              <span className="text-xs text-muted-foreground">{t("sending.unknown")}</span>
            )}
            {row.health_checked_at ? (
              <p className="text-2xs text-muted-foreground">{t("healthCheckedAt", { time: format.dateTime(new Date(row.health_checked_at), { dateStyle: "short", timeStyle: "short" }) })}</p>
            ) : null}
          </div>
        ),
    },
    {
      header: t("columns.findings"),
      key: "findings",
      render: (row) =>
        row.findings.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("noFindings")}</span>
        ) : (
          <details>
            <summary className="w-fit cursor-pointer rounded-sm text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t("findingsCount", { count: row.findings.length })}
            </summary>
            <ul className="mt-2 space-y-1.5">
              {row.findings.map((finding, index) => (
                <li key={`${finding.type}-${index}`} className="text-xs leading-snug">
                  <StatusChip tone={finding.impact === "high" ? "fault" : "warning"} label={t(`impact.${finding.impact === "high" ? "high" : "low"}`)} className="mr-1.5" />
                  <span className="text-foreground">{finding.description || finding.type}</span>
                </li>
              ))}
            </ul>
          </details>
        ),
    },
    {
      header: t("columns.actions"),
      key: "actions",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.account.mode === "probation" ? (
            <Button size="sm" variant="outline" icon={<ArrowUp className="h-3.5 w-3.5" weight="bold" />} iconVisible title={t("actions.promote")} onClick={() => setPending({ kind: "promote", row })} />
          ) : null}
          {isPausedAccount(row.account.status) ? (
            <Button size="sm" variant="outline" icon={<Play className="h-3.5 w-3.5" weight="fill" />} iconVisible title={t("actions.reinstate")} onClick={() => setPending({ kind: "reinstate", row })} />
          ) : (
            <Button size="sm" variant="outline" icon={<Pause className="h-3.5 w-3.5" weight="fill" />} iconVisible title={t("actions.pause")} onClick={() => setPending({ kind: "pause", row })} />
          )}
        </div>
      ),
    },
  ];

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader icon={<EnvelopeSimple weight="fill" />} badge={t("title")} description={t("description")} />
      <SesQuotaPanel />
      <DashboardTable<EmailAdminAccount>
        data={query.isError ? [] : rows}
        columns={columns}
        rowKey={(row) => row.account.id}
        loading={query.isPending}
        headerRight={
          <Button variant="outline" icon={<ArrowsClockwise className="h-4 w-4" weight="bold" />} iconVisible title={t("refresh")} disabled={query.isFetching} onClick={() => void query.refetch()} />
        }
        emptyState={
          query.isError
            ? { icon: <EnvelopeSimple className="h-7 w-7 text-destructive-ink" weight="fill" />, title: t("loadFailed"), description: describe(query.error) }
            : { icon: <EnvelopeSimple className="h-7 w-7 text-muted-foreground" weight="fill" />, title: t("emptyTitle"), description: t("emptyText") }
        }
        pagination={
          meta && meta.totalPages > 1
            ? { currentPage: meta.page, totalPages: meta.totalPages, pageSize: meta.pageSize, totalItems: meta.totalItems, onPageChange: setPage }
            : undefined
        }
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
            setReason("");
          }
        }}
        tone={pending?.kind === "pause" ? "danger" : "default"}
        title={pending ? t(`confirm.${pending.kind}.title`, { tenant: pending.row.account.tenant_name }) : ""}
        description={pending ? t(`confirm.${pending.kind}.text`) : undefined}
        confirmLabel={pending ? t(`actions.${pending.kind}`) : undefined}
        cancelLabel={tm("common.cancel")}
        onConfirm={run}
      >
        {pending?.kind === "pause" ? (
          <ElevatedTextarea label={t("reasonLabel")} placeholder=" " value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        ) : null}
      </ConfirmDialog>
    </main>
  );
}

export default function AdminEmailPage() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <ScreenLoader fit="screen" />;
  if (!isSystemAdmin(user?.role)) return <AccessDenied backHref="/dashboard" />;
  return <AdminEmailAccounts />;
}
