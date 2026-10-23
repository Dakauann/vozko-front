"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ArrowSquareOut, NotePencil, PencilSimple, Plus, Table, Trash } from "@/components/icons";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { AddRowDialog } from "@/components/google-sheets/AddRowDialog";
import { ColumnDialog, type ColumnDialogMode } from "@/components/google-sheets/ColumnDialog";
import { SheetDetailsDialog } from "@/components/google-sheets/SheetDetailsDialog";
import { SheetHealthCard } from "@/components/google-sheets/SheetHealthCard";
import { SheetRowsCard } from "@/components/google-sheets/SheetRowsCard";
import { SHEET_STATUS_TONE } from "@/components/google-sheets/sheet-status";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { codedErrorMessage, type CodedRefusal } from "@/lib/api/coded-error";
import { deleteSheet, fetchSheetCatalog, fetchSheetHealth, reactivateSheet } from "@/lib/google-sheets/client";
import { GOOGLE_SHEETS_PATH } from "@/lib/google-sheets/paths";
import type { GoogleSheet, SheetCatalog, SheetColumn, SheetHealth } from "@/lib/google-sheets/types";

type Dialog = { kind: "column"; mode: ColumnDialogMode } | { kind: "row" } | { kind: "details" } | { kind: "delete" };

export default function GoogleSheetPage() {
  const t = useTranslations("googleSheets");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const canEdit = useSettledPermission("google_sheets", "update");
  const canDelete = useSettledPermission("google_sheets", "delete");

  const [health, setHealth] = useState<SheetHealth | null>(null);
  const [loadError, setLoadError] = useState<CodedRefusal | null>(null);
  const [catalog, setCatalog] = useState<SheetCatalog | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [reactivating, setReactivating] = useState(false);

  const load = useCallback(() => {
    void fetchSheetHealth(id).then((res) => {
      setHealth(res.data);
      setLoadError(res.error ?? null);
    });
  }, [id]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    void fetchSheetCatalog().then((res) => setCatalog(res.data));
  }, []);

  const sheet = health?.sheet ?? null;

  const replaceSheet = (next: GoogleSheet) => {
    setDialog(null);
    setHealth((current) => (current ? { ...current, sheet: next } : current));
    load();
  };

  const reactivate = async (repairHeader: boolean) => {
    setReactivating(true);
    const res = await reactivateSheet(id, repairHeader);
    setReactivating(false);
    if (res.error || !res.data) {
      toast.error(t("attention.failed"), { description: codedErrorMessage(t, res.error ?? {}, "") });
      return;
    }
    toast.success(t("attention.reactivated"));
    replaceSheet(res.data);
  };

  const remove = async () => {
    const res = await deleteSheet(id);
    if (res.error) {
      toast.error(t("confirm.deleteFailed"), { description: codedErrorMessage(t, res.error, "") });
      return false;
    }
    toast(t("confirm.deleted"));
    router.push(GOOGLE_SHEETS_PATH);
  };

  const columns: DashboardTableColumn<SheetColumn>[] = [
    {
      key: "header",
      header: t("columnsTable.header"),
      render: (row) => (
        <div className="min-w-0">
          <p className={row.archived ? "truncate text-sm text-muted-foreground line-through" : "truncate text-sm font-medium text-foreground"}>{row.header}</p>
          {row.instruction ? <p className="truncate text-xs text-muted-foreground">{row.instruction}</p> : null}
        </div>
      ),
    },
    { key: "type", header: t("columnsTable.type"), render: (row) => <span className="text-sm text-muted-foreground">{t(`types.${row.type}`)}</span> },
    { key: "source", header: t("columnsTable.source"), render: (row) => <span className="text-sm text-muted-foreground">{t(`sources.${row.source}`)}</span> },
    {
      key: "flags",
      header: t("columnsTable.flags"),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.required ? <StatusChip tone="neutral" label={t("columnsTable.required")} /> : null}
          {row.archived ? <StatusChip tone="muted" label={t("columnsTable.archived")} /> : null}
        </div>
      ),
    },
  ];

  if (loadError && !sheet) {
    return (
      <motion.main className="w-full space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <DashboardPageHeader
          icon={<Table size={20} weight="duotone" />}
          badge={t("header.badge")}
          description={codedErrorMessage(t, loadError, t("error.description"))}
          back={{ onClick: () => router.push(GOOGLE_SHEETS_PATH), label: t("detail.back") }}
        />
      </motion.main>
    );
  }

  return (
    <motion.main className="w-full space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <DashboardPageHeader
        icon={<Table size={20} weight="duotone" />}
        badge={t("header.badge")}
        title={sheet?.title}
        description={sheet?.description || t("detail.noDescription")}
        meta={sheet ? <StatusChip tone={SHEET_STATUS_TONE[sheet.status]} label={t(`status.${sheet.status}`)} /> : null}
        back={{ onClick: () => router.push(GOOGLE_SHEETS_PATH), label: t("detail.back") }}
        actions={
          sheet ? (
            <div className="flex flex-wrap items-center gap-2">
              <a href={sheet.url} target="_blank" rel="noreferrer">
                <ElevatedButton variant="secondary" size="sm" title={t("detail.openInGoogle")} icon={<ArrowSquareOut size={14} />} iconVisible />
              </a>
              {canEdit ? (
                <ElevatedButton variant="secondary" size="sm" title={t("detail.editDetails")} icon={<PencilSimple size={14} />} iconVisible onClick={() => setDialog({ kind: "details" })} />
              ) : null}
              {canEdit ? (
                <ElevatedButton size="sm" title={t("detail.addRow")} icon={<NotePencil size={14} />} iconVisible onClick={() => setDialog({ kind: "row" })} />
              ) : null}
              {canDelete ? (
                <ElevatedButton variant="ghost" size="sm" title={t("detail.delete")} icon={<Trash size={14} />} iconVisible onClick={() => setDialog({ kind: "delete" })} />
              ) : null}
            </div>
          ) : null
        }
      />

      {sheet?.status === "needs_attention" ? (
        <Notice tone="warning" title={t("attention.title")}>
          <p>{sheet.reason ? t(`reasons.${sheet.reason}`) : null}</p>
          {sheet.reasonDetail ? <p className="text-muted-foreground">{sheet.reasonDetail}</p> : null}
          {canEdit ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <ElevatedButton size="sm" title={t("attention.reactivate")} onClick={() => void reactivate(false)} disabled={reactivating} />
              {sheet.reason === "header_mismatch" ? (
                <ElevatedButton variant="secondary" size="sm" title={t("attention.repairHeader")} onClick={() => void reactivate(true)} disabled={reactivating} />
              ) : null}
            </div>
          ) : null}
        </Notice>
      ) : null}

      {health ? <SheetHealthCard health={health} canEdit={canEdit} onChanged={load} /> : null}
      {sheet ? <SheetRowsCard key={sheet.id} sheet={sheet} /> : null}

      <ElevatedContainer>
        <div className="space-y-3 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{t("detail.columnsTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("detail.columnsHint")}</p>
            </div>
            {canEdit && catalog && sheet ? (
              <ElevatedButton
                variant="secondary"
                size="sm"
                title={t("detail.addColumn")}
                icon={<Plus size={14} />}
                iconVisible
                onClick={() => setDialog({ kind: "column", mode: { kind: "add" } })}
              />
            ) : null}
          </div>
          <DashboardTable<SheetColumn>
            data={sheet?.columns ?? []}
            columns={columns}
            rowKey={(row) => row.key}
            loading={!sheet}
            onRowClick={canEdit && catalog ? (row) => setDialog({ kind: "column", mode: { kind: "edit", column: row } }) : undefined}
          />
        </div>
      </ElevatedContainer>

      {sheet && catalog && dialog?.kind === "column" ? (
        <ColumnDialog sheet={sheet} catalog={catalog} mode={dialog.mode} onClose={() => setDialog(null)} onSaved={replaceSheet} />
      ) : null}
      {sheet && dialog?.kind === "row" ? (
        <AddRowDialog
          sheet={sheet}
          onClose={() => setDialog(null)}
          onQueued={() => {
            setDialog(null);
            load();
          }}
        />
      ) : null}
      {sheet && dialog?.kind === "details" ? <SheetDetailsDialog sheet={sheet} onClose={() => setDialog(null)} onSaved={replaceSheet} /> : null}
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("confirm.deleteTitle", { title: sheet?.title ?? "" })}
        description={t("confirm.deleteBody")}
        confirmLabel={t("confirm.delete")}
        cancelLabel={t("confirm.cancel")}
        tone="danger"
        onConfirm={remove}
      />
    </motion.main>
  );
}
