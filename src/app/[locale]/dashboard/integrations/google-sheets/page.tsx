"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useFormatter, useTranslations } from "next-intl";

import { Plus, Table } from "@/components/icons";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { GoogleAccountCard } from "@/components/google/GoogleAccountCard";
import { CreateSheetDialog } from "@/components/google-sheets/CreateSheetDialog";
import { SHEET_STATUS_TONE } from "@/components/google-sheets/sheet-status";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { fetchSheetCatalog, listSheets } from "@/lib/google-sheets/client";
import { googleSheetPath } from "@/lib/google-sheets/paths";
import type { GoogleSheet, GoogleSheetList, SheetCatalog } from "@/lib/google-sheets/types";
import type { GoogleProductStatus } from "@/lib/google/types";

const PAGE_SIZE = 20;

interface LoadedList {
  key: string;
  list: GoogleSheetList | null;
  error: string | null;
}

export default function GoogleSheetsPage() {
  const t = useTranslations("googleSheets");
  const format = useFormatter();
  const router = useRouter();
  const canCreate = useSettledPermission("google_sheets", "create");
  const canDisconnect = useSettledPermission("google_sheets", "delete");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<LoadedList | null>(null);
  const [catalog, setCatalog] = useState<SheetCatalog | null>(null);
  const [connected, setConnected] = useState(false);
  const [creating, setCreating] = useState(false);

  const requestKey = `${page}:${query}:${reloadKey}`;
  const loading = loaded?.key !== requestKey;

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    void listSheets({ page, pageSize: PAGE_SIZE, search: query || undefined }).then((res) => {
      if (!active) return;
      setLoaded({ key: requestKey, list: res.data, error: res.error ? codedErrorMessage(t, res.error, t("error.description")) : null });
    });
    return () => {
      active = false;
    };
  }, [page, query, requestKey, t]);

  useEffect(() => {
    void fetchSheetCatalog().then((res) => setCatalog(res.data));
  }, []);

  const onStatus = useCallback((status: GoogleProductStatus | null) => setConnected(status?.connected ?? false), []);
  const reload = () => setReloadKey((current) => current + 1);

  const sheets = loading ? [] : (loaded?.list?.items ?? []);
  const error = loading ? null : (loaded?.error ?? null);

  const columns = useMemo<DashboardTableColumn<GoogleSheet>[]>(
    () => [
      {
        key: "title",
        header: t("table.title"),
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
            <p className="truncate text-xs text-muted-foreground">{row.tabName}</p>
          </div>
        ),
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => <StatusChip tone={SHEET_STATUS_TONE[row.status]} label={t(`status.${row.status}`)} />,
      },
      {
        key: "columns",
        header: t("table.columns"),
        render: (row) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {t("table.columnsCount", { count: row.columns.filter((column) => !column.archived).length })}
          </span>
        ),
      },
      {
        key: "lastWrittenAt",
        header: t("table.lastWritten"),
        render: (row) =>
          row.lastWrittenAt ? (
            <span className="text-sm text-muted-foreground">{format.dateTime(new Date(row.lastWrittenAt), { dateStyle: "short", timeStyle: "short" })}</span>
          ) : (
            <EmptyValue className="text-sm" />
          ),
      },
    ],
    [t, format],
  );

  const newSheetButton =
    canCreate && connected && catalog ? (
      <ElevatedButton onClick={() => setCreating(true)} className="gap-2" icon={<Plus size={16} weight="bold" />} title={t("actions.new")} iconVisible />
    ) : null;

  return (
    <motion.main className="w-full space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardPageHeader
        icon={<Table size={20} weight="duotone" />}
        badge={t("header.badge")}
        description={t("header.description")}
        back={{ onClick: () => router.push("/dashboard/integrations"), label: t("header.back") }}
      />

      <GoogleAccountCard product="sheets" canConnect={canCreate} canDisconnect={canDisconnect} returnPath="/dashboard/integrations/google-sheets" onChange={onStatus} />

      <DashboardTable<GoogleSheet>
        data={sheets}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) => router.push(googleSheetPath(row.id))}
        headerLeft={
          <div className="w-full max-w-xs">
            <ElevatedInput placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} controlSize="sm" />
          </div>
        }
        headerRight={newSheetButton}
        pagination={
          loaded?.list && loaded.list.totalPages > 1
            ? { currentPage: page, totalPages: loaded.list.totalPages, pageSize: PAGE_SIZE, totalItems: loaded.list.totalItems, onPageChange: setPage }
            : undefined
        }
        emptyState={
          error
            ? {
                icon: <Table size={48} weight="duotone" className="text-destructive-ink" />,
                title: t("error.title"),
                description: error,
                action: <ElevatedButton variant="outline" title={t("error.retry")} onClick={reload} />,
              }
            : {
                icon: <Table size={48} weight="duotone" className="text-muted-foreground" />,
                title: t("empty.title"),
                description: connected ? t("empty.description") : t("empty.notConnected"),
                action: newSheetButton ? <div className="mt-4">{newSheetButton}</div> : undefined,
              }
        }
      />

      {creating && catalog ? (
        <CreateSheetDialog
          catalog={catalog}
          onClose={() => setCreating(false)}
          onCreated={(sheet) => {
            setCreating(false);
            router.push(googleSheetPath(sheet.id));
          }}
        />
      ) : null}
    </motion.main>
  );
}
