"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { createEmailCampaignAction, deleteEmailCampaignAction, getEmailCampaignAction, isEmailActionError } from "@/app/actions/email-campaigns";
import { Meter } from "@/components/charts/vozko";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { Copy, DotsThree, EnvelopeSimple, Eye, MagnifyingGlass, Plus, TestTube, Trash, Files } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/workspace-context";
import { emailCampaignsRoot, useEmailCampaigns } from "@/hooks/use-email-campaigns";
import { duplicateRequest } from "@/lib/email-campaigns/draft";
import { campaignCommands, campaignHref, canRun, isLaunched, wizardHref } from "@/lib/email-campaigns/status";
import { CAMPAIGN_STATUSES, type CampaignListMetrics, type CampaignStatus, type CampaignSummary } from "@/lib/email-campaigns/types";

import { EMAIL_SERIES_COLOR, EmailCampaignStatusChip, useEmailErrorMessage, useEmailFormat, useEmailPermission, type EmailSeries } from "../shared";
import { COMMAND_ICON } from "../command-icons";
import { StartCampaignDialog } from "../StartCampaignDialog";
import { useCampaignCommands } from "../use-campaign-commands";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const ALL = "all";

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

function launchedMetrics(row: CampaignSummary): CampaignListMetrics | undefined {
  return isLaunched(row.status) ? row.metrics : undefined;
}

function RateCell({ bps, series }: { bps: number | undefined; series: EmailSeries }) {
  const { rate } = useEmailFormat();
  if (bps === undefined) return <EmptyValue className="text-sm" />;
  return (
    <div className="flex min-w-[88px] flex-col gap-1">
      <span className="readout text-sm font-semibold text-foreground">{rate(bps)}</span>
      <Meter value={bps / 100} size="sm" color={EMAIL_SERIES_COLOR[series]} className="max-w-[96px]" />
    </div>
  );
}

function WhenCell({ row }: { row: CampaignSummary }) {
  const t = useTranslations("emailCampaigns.list");
  const { dateTime } = useEmailFormat();
  const [label, iso] = row.completed_at
    ? [t("when.completed"), row.completed_at]
    : row.started_at
      ? [t("when.started"), row.started_at]
      : row.scheduled_at
        ? [t("when.scheduled"), row.scheduled_at]
        : [t("when.created"), row.created_at];
  return (
    <div className="min-w-0 whitespace-nowrap">
      <span className="block text-sm text-foreground">{dateTime(iso)}</span>
      <span className="block text-2xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function EmailCampaignsList() {
  const t = useTranslations("emailCampaigns");
  const router = useRouter();
  const allowed = useEmailPermission();
  const errorMessage = useEmailErrorMessage();
  const { number } = useEmailFormat();
  const client = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const [status, setStatus] = useState<CampaignStatus | typeof ALL>(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [stopping, setStopping] = useState<CampaignSummary | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CampaignSummary | null>(null);
  const settledSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);
  const commands = useCampaignCommands();

  const list = useEmailCampaigns({ status: status === ALL ? undefined : status, search: settledSearch, page, pageSize: PAGE_SIZE });
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const canCreate = allowed("create");
  const createButton = canCreate ? (
    <Button variant="primary" title={t("list.create")} icon={<Plus className="h-4 w-4" weight="bold" />} iconVisible iconSide="left" link="/dashboard/email/campaigns/new" newTab={false} />
  ) : null;

  const duplicate = async (row: CampaignSummary) => {
    const source = await getEmailCampaignAction(row.id);
    if (isEmailActionError(source)) {
      toast.error(t("list.duplicate.failed"), { description: errorMessage(source) });
      return;
    }
    const created = await createEmailCampaignAction(duplicateRequest(source.data, t("list.duplicate.name", { name: source.data.name })));
    if (isEmailActionError(created)) {
      toast.error(t("list.duplicate.failed"), { description: errorMessage(created) });
      return;
    }
    toast.success(t("list.duplicate.done"));
    await client.invalidateQueries({ queryKey: emailCampaignsRoot(workspaceId) });
    router.push(wizardHref(created.data.id));
  };

  const remove = async (row: CampaignSummary) => {
    const result = await deleteEmailCampaignAction(row.id);
    if (isEmailActionError(result)) {
      toast.error(t("list.delete.failed"), { description: errorMessage(result) });
      return false;
    }
    toast.success(t("list.delete.done"));
    await client.invalidateQueries({ queryKey: emailCampaignsRoot(workspaceId) });
    return true;
  };

  const columns: DashboardTableColumn<CampaignSummary>[] = [
    {
      key: "name",
      header: t("list.columns.name"),
      className: "min-w-[220px]",
      render: (row) => (
        <div className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
            {row.ab_test ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-[--radius] border border-border px-1.5 py-px text-2xs font-medium text-muted-foreground" title={t("list.abTest")}>
                <TestTube className="h-3 w-3" />
                {t("list.abShort")}
              </span>
            ) : null}
          </span>
          <span className="block truncate text-2xs text-muted-foreground">{row.subject || t("list.noSubject")}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: t("list.columns.status"),
      render: (row) => <EmailCampaignStatusChip status={row.status} holdReason={row.hold_reason} scheduledAt={row.scheduled_at} />,
    },
    {
      key: "sent",
      header: t("list.columns.sent"),
      render: (row) => {
        const data = launchedMetrics(row);
        if (!data) return <EmptyValue className="text-sm" />;
        return (
          <div className="whitespace-nowrap">
            <span className="readout block text-sm font-semibold text-foreground">{number(data.sent)}</span>
            <span className="readout block text-2xs text-muted-foreground">{t("list.deliveredCount", { count: number(data.delivered) })}</span>
          </div>
        );
      },
    },
    { key: "delivery", header: t("list.columns.delivery"), render: (row) => <RateCell series="delivered" bps={launchedMetrics(row)?.delivery_rate} /> },
    { key: "open", header: t("list.columns.open"), render: (row) => <RateCell series="opens" bps={launchedMetrics(row)?.open_rate} /> },
    { key: "click", header: t("list.columns.click"), render: (row) => <RateCell series="clicks" bps={launchedMetrics(row)?.click_rate} /> },
    { key: "when", header: t("list.columns.when"), render: (row) => <WhenCell row={row} /> },
  ];

  const filtered = status !== ALL || settledSearch.trim() !== "";

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        icon={<EnvelopeSimple className="h-6 w-6" weight="fill" />}
        badge={t("list.title")}
        description={t("list.description")}
        actions={
          <>
            {createButton}
            <Button variant="secondary" title={t("list.designs")} icon={<Files className="h-4 w-4" />} iconVisible iconSide="left" link="/dashboard/email/designs" newTab={false} />
          </>
        }
      />

      <DashboardTable<CampaignSummary>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={list.isPending}
        onRowClick={(row) => router.push(campaignHref(row.id, row.status))}
        headerLeft={
          <div className="w-full max-w-xs">
            <ElevatedInput
              type="search"
              label={t("list.search")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
              className="w-full"
            />
          </div>
        }
        toolbar={
          <ElevatedSelect
            value={status}
            onValueChange={(value) => {
              setStatus(value as CampaignStatus | typeof ALL);
              setPage(1);
            }}
            className="w-auto min-w-[160px]"
            aria-label={t("list.statusFilter")}
          >
            <ElevatedSelectItem value={ALL}>{t("list.allStatuses")}</ElevatedSelectItem>
            {CAMPAIGN_STATUSES.map((value) => (
              <ElevatedSelectItem key={value} value={value}>
                {t(`status.${value}`)}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        }
        renderRowActions={(row) => {
          const available = campaignCommands(row.actions, allowed);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  aria-label={t("list.actions", { name: row.name })}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <DotsThree className="h-5 w-5" weight="bold" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                <DropdownMenuItem onSelect={() => router.push(campaignHref(row.id, row.status))}>
                  <Eye className="h-4 w-4" />
                  {t("list.open")}
                </DropdownMenuItem>
                {canCreate ? (
                  <DropdownMenuItem onSelect={() => void duplicate(row)}>
                    <Copy className="h-4 w-4" />
                    {t("list.duplicate.action")}
                  </DropdownMenuItem>
                ) : null}
                {available.length > 0 ? <DropdownMenuSeparator /> : null}
                {available.map((command) => (
                  <DropdownMenuItem
                    key={command}
                    disabled={commands.busy !== null}
                    onSelect={() => (command === "stop" ? setStopping(row) : command === "start" ? setStarting(row.id) : void commands.run(command, row.id))}
                  >
                    {COMMAND_ICON[command]}
                    {t(`commands.${command}.action`)}
                  </DropdownMenuItem>
                ))}
                {canRun(row.actions, "delete", allowed) ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setDeleting(row)} className="text-destructive-ink">
                      <Trash className="h-4 w-4" />
                      {t("list.delete.action")}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
        pagination={
          totalPages > 1
            ? { currentPage: page, totalPages, pageSize: PAGE_SIZE, totalItems: total, onPageChange: setPage }
            : undefined
        }
        emptyState={
          list.isError
            ? { icon: <EnvelopeSimple className="h-7 w-7 text-destructive-ink" weight="fill" />, title: t("list.error"), description: errorMessage({ code: (list.error as { code?: string }).code }) }
            : filtered
              ? { icon: <MagnifyingGlass className="h-7 w-7 text-muted-foreground" />, title: t("list.noMatches"), description: t("list.noMatchesHint") }
              : <EmptyCampaigns action={createButton} />
        }
      />

      <StartCampaignDialog campaignId={starting} onClose={() => setStarting(null)} onStart={(id) => commands.run("start", id)} />
      <ConfirmDialog
        open={stopping !== null}
        onOpenChange={(open) => (open ? undefined : setStopping(null))}
        title={t("commands.stop.confirmTitle")}
        description={t("commands.stop.confirmBody")}
        confirmLabel={t("commands.stop.action")}
        onConfirm={async () => {
          if (stopping) await commands.run("stop", stopping.id);
          setStopping(null);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={t("list.delete.confirmTitle")}
        description={deleting ? t("list.delete.confirmBody", { name: deleting.name }) : undefined}
        confirmLabel={t("list.delete.action")}
        onConfirm={async () => {
          if (deleting) await remove(deleting);
          setDeleting(null);
        }}
      />
    </main>
  );
}

function EmptyCampaigns({ action }: { action: ReactNode }) {
  const t = useTranslations("emailCampaigns.list.empty");
  const steps = ["content", "audience", "review"] as const;
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-6 py-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-control-edge bg-card text-foreground">
        <EnvelopeSimple className="h-6 w-6" />
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-lg font-semibold text-foreground">{t("title")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("description")}</p>
      </div>
      <ol className="grid w-full gap-px overflow-hidden rounded-lg border border-border bg-border text-left sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step} className="bg-card px-3 py-3">
            <span className="readout text-2xs font-semibold text-muted-foreground">{index + 1}</span>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{t(`steps.${step}.title`)}</p>
            <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{t(`steps.${step}.text`)}</p>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {action}
        <Button variant="ghost" title={t("designs")} link="/dashboard/email/designs" newTab={false} />
      </div>
    </div>
  );
}
