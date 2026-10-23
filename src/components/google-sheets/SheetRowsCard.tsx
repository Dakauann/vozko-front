"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { Notice } from "@/components/ui/notice";
import { listSheetRows } from "@/lib/google-sheets/client";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { GoogleSheet, SheetDataRow } from "@/lib/google-sheets/types";

export function SheetRowsCard({ sheet }: { sheet: GoogleSheet }) {
  const t = useTranslations("googleSheets");
  const [page, setPage] = useState(1);
  const { currentWorkspace } = useWorkspace();
  const workspaceID = currentWorkspace?.id ?? "";
  const rows = useQuery({
    queryKey: [workspaceID, "google-sheet-rows", sheet.id, page],
    enabled: workspaceID !== "",
    queryFn: async ({ signal }) => {
      const result = await listSheetRows(sheet.id, page, signal);
      if (result.error || !result.data) throw new Error(codedErrorMessage(t, result.error ?? {}, t("rows.failed")));
      return result.data;
    },
    refetchInterval: 10_000,
    retry: false,
  });
  const columns: DashboardTableColumn<SheetDataRow>[] = [
    { key: "status", header: t("health.problemStatus"), render: (row) => <StatusChip tone={row.status === "written" ? "healthy" : row.status === "failed" ? "fault" : "neutral"} label={t(`rowStatus.${row.status}`)} /> },
    ...sheet.columns.filter((column) => !column.archived).map((column) => ({
      key: column.key,
      header: column.header,
      render: (row: SheetDataRow) => <span className="block max-w-md whitespace-pre-wrap break-words text-sm">{row.values[column.key] == null ? "—" : String(row.values[column.key])}</span>,
    })),
    { key: "origin", header: t("health.problemOrigin"), render: (row) => <span className="text-sm">{t(`origins.${row.origin}`)}</span> },
  ];
  return (
    <ElevatedContainer>
      <div className="space-y-3 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-sm font-semibold">{t("rows.title")}</h3><p className="text-xs text-muted-foreground">{t("rows.hint")}</p></div>
          <ElevatedButton variant="secondary" size="sm" title={t("rows.refresh")} onClick={() => void rows.refetch()} disabled={rows.isFetching} />
        </div>
        {rows.isError ? <Notice tone="fault">{rows.error.message}</Notice> : null}
        <DashboardTable<SheetDataRow> data={rows.data?.items ?? []} columns={columns} rowKey={(row) => row.id} loading={rows.isPending} />
        <div className="flex items-center justify-end gap-2">
          <ElevatedButton variant="secondary" size="sm" title={t("rows.previous")} onClick={() => setPage((current) => current - 1)} disabled={page <= 1 || rows.isFetching} />
          <span className="text-xs tabular-nums">{page} / {Math.max(1, rows.data?.total_pages ?? 1)}</span>
          <ElevatedButton variant="secondary" size="sm" title={t("rows.next")} onClick={() => setPage((current) => current + 1)} disabled={!rows.data || page >= rows.data.total_pages || rows.isFetching} />
        </div>
      </div>
    </ElevatedContainer>
  );
}
