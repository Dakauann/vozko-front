"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowClockwise, CheckCircle, PencilSimple, Phone, Plus, Trash, Warning, XCircle } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SipTrunkSheet } from "@/components/sip-trunks/sip-trunk-sheet";
import { deleteSipTrunkAction, listSipTrunksAction } from "@/app/actions/sip-trunks";
import { useWorkspace } from "@/contexts/workspace-context";
import { toast } from "sonner";
import type { SipRegistrationStatus, SipTrunk } from "@/lib/sip-trunks/types";
import { cn } from "@/lib/utils";

const PENDING_REFRESH_MS = 4_000;

const STATUS_TONE: Record<SipRegistrationStatus, string> = {
  REGISTERED: "bg-healthy text-healthy-foreground",
  REGISTERING: "bg-warning text-warning-foreground",
  FAILED: "bg-destructive text-destructive-foreground",
  UNREGISTERED: "bg-muted text-muted-foreground",
};

export default function SipTrunksPage() {
  const t = useTranslations("sipTrunks");
  const { can } = useWorkspace();
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SipTrunk | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState<SipTrunk | null>(null);

  const canCreate = can("sip_trunks", "create");
  const canUpdate = can("sip_trunks", "update");
  const canDelete = can("sip_trunks", "delete");

  const load = useCallback(() => {
    void listSipTrunksAction().then((result) => {
      setError(result.error ?? null);
      setTrunks(result.trunks);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const registering = trunks.some((trunk) => trunk.enabled && trunk.registrationStatus === "REGISTERING");
  useEffect(() => {
    if (!registering) return;
    const timer = setInterval(load, PENDING_REFRESH_MS);
    return () => clearInterval(timer);
  }, [registering, load]);

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = useCallback((trunk: SipTrunk) => {
    setEditing(trunk);
    setSheetOpen(true);
  }, []);

  const confirmDelete = async () => {
    if (!deleting) return;
    const result = await deleteSipTrunkAction(deleting.id);
    if (result.error) {
      toast.error(t("delete.failed"), { description: result.error });
      return;
    }
    toast(t("delete.done"), { description: deleting.name });
    setDeleting(null);
    load();
  };

  const registeredCount = trunks.filter((trunk) => trunk.enabled && trunk.registrationStatus === "REGISTERED").length;
  const attentionCount = trunks.filter((trunk) => trunk.enabled && trunk.registrationStatus === "FAILED").length;

  const columns = useMemo<DashboardTableColumn<SipTrunk>[]>(
    () => [
      {
        key: "trunk",
        header: t("table.trunk"),
        render: (row) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{row.name}</span>
            <span className="readout text-xs text-muted-foreground">
              {row.host}
              {row.port ? `:${row.port}` : ""} · {row.transport}
            </span>
          </div>
        ),
      },
      {
        key: "type",
        header: t("table.type"),
        render: (row) => <span className="text-sm text-muted-foreground">{t(`form.types.${row.trunkType}`)}</span>,
      },
      {
        key: "status",
        header: t("table.status"),
        render: (row) => {
          const status: SipRegistrationStatus = row.enabled ? row.registrationStatus : "UNREGISTERED";
          return (
            <div className="flex flex-col gap-1">
              <span className={cn("inline-flex w-fit items-center rounded-[--radius] px-2.5 py-0.5 text-xs font-medium", STATUS_TONE[status])}>
                {row.enabled ? t(`status.${status}`) : t("status.DISABLED")}
              </span>
              {row.enabled && row.registrationStatus === "FAILED" && row.lastError ? (
                <span className="flex max-w-[320px] items-start gap-1 text-xs text-destructive-ink" title={row.lastError}>
                  <Warning weight="fill" className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="line-clamp-2">{row.lastError}</span>
                </span>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t],
  );

  const renderRowActions = useCallback(
    (row: SipTrunk) => (
      <div className="flex items-center gap-1">
        {canUpdate ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openEdit(row);
            }}
            title={t("actions.edit")}
            aria-label={t("actions.edit")}
            className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PencilSimple className="h-4 w-4" />
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDeleting(row);
            }}
            title={t("actions.delete")}
            aria-label={t("actions.delete")}
            className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink"
          >
            <Trash className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    ),
    [canDelete, canUpdate, openEdit, t],
  );

  const createButton = canCreate ? (
    <Button variant="primary" title={t("page.create")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" onClick={openCreate} />
  ) : undefined;

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader
        badge={t("page.title")}
        description={t("page.description")}
        icon={<Phone className="h-6 w-6" />}
        colorClass="text-info-ink"
      />

      <DashboardTable<SipTrunk>
        data={trunks}
        columns={columns}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={canUpdate ? openEdit : undefined}
        renderRowActions={renderRowActions}
        stats={[
          { label: t("stats.total"), value: loading ? "…" : trunks.length, icon: <Phone className="h-4 w-4 text-info-ink" /> },
          { label: t("stats.registered"), value: loading ? "…" : registeredCount, icon: <CheckCircle className="h-4 w-4 text-healthy-ink" weight="fill" /> },
          { label: t("stats.attention"), value: loading ? "…" : attentionCount, icon: <Warning className="h-4 w-4 text-destructive-ink" weight="fill" /> },
        ]}
        headerRight={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              title=""
              aria-label={t("page.refresh")}
              icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", loading && "animate-spin")} />}
              iconVisible
              iconSide="left"
              onClick={load}
            />
            {createButton}
          </div>
        }
        emptyState={
          error
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("page.errorTitle"),
                description: error,
                action: <Button variant="secondary" title={t("page.retry")} onClick={load} />,
              }
            : {
                icon: <Phone className="h-7 w-7 text-muted-foreground" />,
                title: t("page.emptyTitle"),
                description: t("page.emptyDescription"),
                action: createButton,
              }
        }
      />

      <SipTrunkSheet open={sheetOpen} onOpenChange={setSheetOpen} trunk={editing} onSaved={load} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("delete.title")}
        description={t("delete.body", { name: deleting?.name ?? "" })}
        confirmLabel={t("delete.confirm")}
        cancelLabel={t("delete.cancel")}
        tone="danger"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
