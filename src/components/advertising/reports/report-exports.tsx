"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { isAdsError } from "@/app/actions/advertising";
import { deleteAdReportExportAction, downloadAdReportExportAction, listAdReportExportsAction } from "@/app/actions/advertising-reports";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { DownloadSimple, FileCsv, Trash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { toast } from "sonner";
import { formatDay } from "@/lib/advertising/date-range";
import { exportsForAccount, reportStamp } from "@/lib/advertising/reports";
import type { AdAccount, AdReportExport } from "@/lib/advertising/types";
import { formatBytes } from "@/lib/format/bytes";

import { IconAction } from "../icon-action";
import { useLoadErrorState } from "../load-error-state";
import { useAdsFormat } from "../use-ads-format";
import { MutedCell } from "./muted-cell";
import type { ReportPermissions } from "./use-report-permissions";

export function ReportExports({ account, permissions }: { account: AdAccount; permissions: ReportPermissions }) {
  const t = useTranslations("adsReports.exports");
  const fmt = useAdsFormat();
  const loadError = useLoadErrorState();
  const list = useKeyedLoad("ad-report-exports", listAdReportExportsAction);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdReportExport | null>(null);

  const response = list.latest;
  const error = response && isAdsError(response) ? response.error : null;
  const exports = exportsForAccount(response && !isAdsError(response) ? response.data : [], account.id);

  const download = async (entry: AdReportExport) => {
    setDownloading(entry.id);
    const outcome = await downloadAdReportExportAction(entry);
    setDownloading(null);
    if (isAdsError(outcome)) toast.error(t("downloadFailed"), { description: outcome.error });
  };

  const confirmDelete = async () => {
    const target = deleting;
    if (!target) return;
    const outcome = await deleteAdReportExportAction(target.id);
    setDeleting(null);
    if (isAdsError(outcome)) {
      toast.error(t("delete.failed"), { description: outcome.error });
      return;
    }
    toast(t("delete.done"));
    list.update((current) => (isAdsError(current) ? current : { data: current.data.filter((entry) => entry.id !== target.id) }));
  };

  const columns: DashboardTableColumn<AdReportExport>[] = [
    {
      key: "name",
      header: t("columns.name"),
      render: (entry) => <span className="block max-w-xs truncate text-sm font-medium text-foreground sm:max-w-md">{entry.name}</span>,
    },
    {
      key: "period",
      header: t("columns.period"),
      render: (entry) => <MutedCell value={t("period", { since: formatDay(entry.since, fmt.tag), until: formatDay(entry.until, fmt.tag) })} />,
    },
    { key: "rows", header: t("columns.rows"), render: (entry) => <MutedCell value={fmt.count(entry.rows)} /> },
    { key: "size", header: t("columns.size"), render: (entry) => <MutedCell value={formatBytes(entry.sizeBytes, fmt.tag)} /> },
    { key: "created", header: t("columns.created"), render: (entry) => <MutedCell value={reportStamp(entry.createdAt, fmt.tag) ?? entry.createdAt} /> },
  ];

  return (
    <>
      <DashboardTable
        data={exports}
        columns={columns}
        rowKey={(entry) => entry.id}
        loading={list.loading && !response}
        renderRowActions={(entry) => (
          <>
            <IconAction label={t("download")} onClick={() => void download(entry)} disabled={downloading === entry.id}>
              <DownloadSimple className="h-4 w-4" />
            </IconAction>
            {permissions.canDelete ? (
              <IconAction label={t("delete.action")} onClick={() => setDeleting(entry)} danger>
                <Trash className="h-4 w-4" />
              </IconAction>
            ) : null}
          </>
        )}
        emptyState={
          error
            ? loadError(error, list.reload)
            : { icon: <FileCsv className="h-7 w-7 text-muted-foreground" />, title: t("emptyTitle"), description: t("emptyBody") }
        }
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("delete.title")}
        description={t("delete.body", { name: deleting?.name ?? "" })}
        confirmLabel={t("delete.confirm")}
        cancelLabel={t("delete.cancel")}
        tone="danger"
        onConfirm={confirmDelete}
      />
    </>
  );
}
