"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  ArrowClockwise,
  CheckCircle,
  Clock,
  DownloadSimple,
  FileText,
  Warning,
  XCircle,
} from "@/components/icons";
import type { Icon } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import { ElevatedDatePicker } from "@/components/elevated-design/elevated-date-picker";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { listReportsAction, type ReportListFilters } from "@/app/actions/reports";
import { useReportJob } from "@/hooks/use-report-job";
import { useToast } from "@/hooks/use-toast";
import {
  isTerminalReportStatus,
  type ReportJob,
  type ReportKind,
  type ReportStatus,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;
const LIVE_REFRESH_MS = 4000;

const KINDS: ReportKind[] = [
  "attendance_overview",
  "conversation_entries",
  "balance_transactions",
  "opportunities",
];

const STATUSES: ReportStatus[] = ["queued", "running", "done", "failed", "expired"];

const STATUS_STYLE: Record<ReportStatus, { className: string; icon: Icon }> = {
  queued: { className: "bg-muted text-muted-foreground", icon: Clock },
  running: { className: "bg-warning text-warning-foreground", icon: ArrowClockwise },
  done: { className: "bg-healthy text-healthy-foreground", icon: CheckCircle },
  failed: { className: "bg-destructive text-destructive-foreground", icon: XCircle },
  expired: { className: "bg-muted text-muted-foreground", icon: Warning },
};

function formatBytes(bytes: number | undefined, locale: string): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${units[unit]}`;
}

export default function ReportsPage() {
  const t = useTranslations("reports");
  const tk = useTranslations("reports.kind");
  const ts = useTranslations("reports.status");
  const tf = useTranslations("metricsOps.export.failure");
  const tc = useTranslations("metricsOps.common");
  const locale = useLocale();

  const { toast } = useToast();
  const { download } = useReportJob({ autoDownload: false });

  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const [kind, setKind] = useState<ReportKind | "all">("all");
  const [status, setStatus] = useState<ReportStatus | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = useMemo<ReportListFilters>(
    () => ({
      kinds: kind === "all" ? undefined : [kind],
      statuses: status === "all" ? undefined : [status],
      from: from || undefined,
      to: to || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [kind, status, from, to, page],
  );

  const [reloadToken, setReloadToken] = useState(0);

  const fetchPage = useCallback(async (): Promise<boolean> => {
    const { data, error: listError } = await listReportsAction(filters);
    if (listError || !data) {
      setError(listError ?? t("loadFailed"));
      setLoading(false);
      return false;
    }
    setJobs(data.reports);
    setTotal(data.total);
    setError(null);
    setLoading(false);
    return data.reports.some((job) => !isTerminalReportStatus(job.status));
  }, [filters, t]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      const hasLiveJob = await fetchPage();
      if (!active || !hasLiveJob) return;
      timer = setTimeout(() => void run(), LIVE_REFRESH_MS);
    };

    void run();

    return () => {
      active = false;
      if (timer !== null) clearTimeout(timer);
    };
  }, [fetchPage, reloadToken]);

  const refresh = useCallback(() => {
    setLoading(true);
    setReloadToken((token) => token + 1);
  }, []);

  const handleDownload = useCallback(
    async (job: ReportJob) => {
      setDownloading(job.id);
      const failure = await download(job.id);
      setDownloading(null);
      if (failure) {
        toast({
          title: t("downloadFailed"),
          description: failure,
          variant: "destructive",
        });
      }
    },
    [download, t, toast],
  );

  const columns = useMemo<DashboardTableColumn<ReportJob>[]>(
    () => [
      {
        key: "kind",
        header: t("table.report"),
        render: (job) => (
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {tk(job.kind)}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {job.filename || job.format.toUpperCase()}
            </span>
          </div>
        ),
      },
      {
        key: "status",
        header: t("table.status"),
        render: (job) => {
          const style = STATUS_STYLE[job.status];
          const StatusIcon = style.icon;
          return (
            <div className="flex flex-col gap-1">
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                  style.className,
                )}
              >
                <StatusIcon className="h-3 w-3" weight="bold" />
                {ts(job.status)}
              </span>
              {job.status === "running" ? (
                <span className="text-xs text-muted-foreground">{job.progress}%</span>
              ) : null}
              {job.status === "failed" && job.failureCode ? (
                <span className="max-w-xs text-xs text-muted-foreground">
                  {tf(job.failureCode)}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "rows",
        header: t("table.size"),
        render: (job) =>
          job.status === "done" ? (
            <span className="text-sm text-muted-foreground">
              {t("rows", { count: job.rowCount ?? 0 })}
              {job.sizeBytes ? ` · ${formatBytes(job.sizeBytes, locale)}` : ""}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        key: "createdAt",
        header: t("table.requestedAt"),
        render: (job) => (
          <span className="text-sm text-muted-foreground">
            {new Date(job.createdAt).toLocaleString()}
          </span>
        ),
      },
      {
        key: "expiresAt",
        header: t("table.expiresAt"),
        render: (job) => (
          <span className="text-sm text-muted-foreground">
            {job.expiresAt ? new Date(job.expiresAt).toLocaleDateString() : "—"}
          </span>
        ),
      },
    ],
    [locale, t, tf, tk, ts],
  );

  return (
    <div className="space-y-3">
      <DashboardPageHeader
        icon={<FileText className="h-6 w-6" weight="fill" />}
        badge={t("badge")}
        title={t("title")}
        description={t("description")}
        actions={
          <Button
            icon={<ArrowClockwise className="h-4 w-4" weight="bold" />}
            iconVisible
            title={tc("refresh")}
            variant="command"
            onClick={refresh}
            disabled={loading}
          />
        }
      />

      <DashboardTable<ReportJob>
        data={jobs}
        columns={columns}
        rowKey={(job) => job.id}
        toolbar={
          <div className="grid w-full grid-cols-1 items-end gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <ElevatedSelect
              value={kind}
              onValueChange={(value) => {
                setPage(1);
                setKind(value as ReportKind | "all");
              }}
              label={t("filters.kind")}
            >
              <ElevatedSelectItem value="all">{tc("all")}</ElevatedSelectItem>
              {KINDS.map((option) => (
                <ElevatedSelectItem key={option} value={option}>
                  {tk(option)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>

            <ElevatedSelect
              value={status}
              onValueChange={(value) => {
                setPage(1);
                setStatus(value as ReportStatus | "all");
              }}
              label={t("filters.status")}
            >
              <ElevatedSelectItem value="all">{tc("all")}</ElevatedSelectItem>
              {STATUSES.map((option) => (
                <ElevatedSelectItem key={option} value={option}>
                  {ts(option)}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>

            <ElevatedDatePicker
              id="reports-from"
              value={from}
              onChange={(value) => {
                setPage(1);
                setFrom(value);
              }}
              label={t("filters.from")}
            />
            <ElevatedDatePicker
              id="reports-to"
              value={to}
              onChange={(value) => {
                setPage(1);
                setTo(value);
              }}
              label={t("filters.to")}
            />
          </div>
        }
        emptyState={{
          title: error ? t("loadFailed") : t("empty.title"),
          description: error ?? t("empty.description"),
        }}
        renderRowActions={(job) => (
          <Button
            icon={<DownloadSimple className="h-4 w-4" weight="bold" />}
            iconVisible
            title={t("download")}
            variant="command"
            onClick={() => void handleDownload(job)}
            disabled={job.status !== "done" || downloading === job.id}
          />
        )}
        pagination={{
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
          pageSize: PAGE_SIZE,
          totalItems: total,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}
