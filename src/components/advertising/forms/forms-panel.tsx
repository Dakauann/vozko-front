"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { archiveLeadFormAction, listLeadFormsAction } from "@/app/actions/advertising-forms";
import { isAdsError } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { Archive, ArrowClockwise, ClipboardText, Eye, Plus } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { toast } from "sonner";
import type { LeadForm } from "@/lib/advertising/forms";
import type { AdAccount, AdPage } from "@/lib/advertising/types";
import { formatWhen } from "@/lib/advertising/when";
import { cn } from "@/lib/utils";

import { useLoadErrorState } from "../load-error-state";
import { IconAction } from "../icon-action";
import { StatusDot } from "../status-dot";
import { useAdsFormat } from "../use-ads-format";
import { FormBuilderDialog } from "./form-builder-dialog";
import type { FormPermissions } from "./forms-page";

export function FormsPanel({
  account,
  page,
  permissions,
  onOpen,
}: {
  account: AdAccount;
  page: AdPage;
  permissions: FormPermissions;
  onOpen: (form: LeadForm) => void;
}) {
  const t = useTranslations("adsForms");
  const fmt = useAdsFormat();
  const loadError = useLoadErrorState();
  const load = useCallback(() => listLeadFormsAction(account.id, page.pageId), [account.id, page.pageId]);
  const list = useKeyedLoad(`${account.id}:${page.pageId}`, load);
  const [building, setBuilding] = useState(false);
  const [archiving, setArchiving] = useState<LeadForm | null>(null);

  const response = list.latest;
  const forms = response && !isAdsError(response) ? response.data : [];
  const error = response && isAdsError(response) ? response.error : null;

  const created = (form: LeadForm) => {
    setBuilding(false);
    toast(t("builder.created", { name: form.name }));
    list.reload();
  };

  const confirmArchive = async () => {
    const target = archiving;
    if (!target) return;
    const outcome = await archiveLeadFormAction(target.metaId, account.id);
    setArchiving(null);
    if (isAdsError(outcome)) {
      toast.error(t("archive.failed"), { description: outcome.error });
      return;
    }
    toast(t("archive.done", { name: target.name }));
    list.update((current) =>
      isAdsError(current)
        ? current
        : { data: current.data.map((form) => (form.metaId === target.metaId ? { ...form, status: "ARCHIVED" } : form)) },
    );
  };

  const columns: DashboardTableColumn<LeadForm>[] = [
    {
      key: "name",
      header: t("columns.name"),
      render: (form) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{form.name}</p>
          <p className="text-2xs text-muted-foreground">{t("questionsCount", { count: form.questions?.length ?? 0 })}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      render: (form) =>
        form.status === "ACTIVE" ? (
          <StatusDot tone="healthy">{t("status.ACTIVE")}</StatusDot>
        ) : form.status === "ARCHIVED" ? (
          <StatusDot tone="neutral">{t("status.ARCHIVED")}</StatusDot>
        ) : (
          <StatusDot tone="neutral">{form.status || fmt.count(null)}</StatusDot>
        ),
    },
    {
      key: "leads",
      header: t("columns.leads"),
      className: "text-right",
      render: (form) => <span className="text-sm tabular-nums text-foreground">{fmt.count(form.leadsCount)}</span>,
    },
    {
      key: "created",
      header: t("columns.created"),
      render: (form) => <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{formatWhen(form.createdTime, fmt.tag)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <DashboardTable
        data={forms}
        columns={columns}
        rowKey={(form) => form.metaId}
        loading={list.loading && !response}
        onRowClick={onOpen}
        headerLeft={<p className="text-sm text-muted-foreground">{t("list.description", { page: page.name })}</p>}
        headerRight={
          <div className="flex items-center gap-2">
            <IconAction label={t("refresh")} onClick={list.reload} disabled={list.loading}>
              <ArrowClockwise className={cn("h-4 w-4", list.loading && "animate-spin")} />
            </IconAction>
            {permissions.canCreate ? (
              <Button
                variant="primary"
                title={t("list.new")}
                icon={<Plus weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                onClick={() => setBuilding(true)}
              />
            ) : null}
          </div>
        }
        renderRowActions={(form) => (
          <div className="flex items-center justify-end gap-1">
            <IconAction label={t("list.viewLeads")} onClick={() => onOpen(form)}>
              <Eye className="h-4 w-4" />
            </IconAction>
            {permissions.canUpdate && form.status === "ACTIVE" ? (
              <IconAction label={t("archive.action")} onClick={() => setArchiving(form)} danger>
                <Archive className="h-4 w-4" />
              </IconAction>
            ) : null}
          </div>
        )}
        emptyState={error ? loadError(error, list.reload) : {
          icon: <ClipboardText className="h-7 w-7 text-muted-foreground" />,
          title: t("list.emptyTitle"),
          description: permissions.canCreate ? t("list.emptyBody") : t("list.emptyBodyReadOnly"),
        }}
      />
      {building ? <FormBuilderDialog account={account} page={page} onClose={() => setBuilding(false)} onCreated={created} /> : null}
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={t("archive.title")}
        description={t("archive.body", { name: archiving?.name ?? "" })}
        confirmLabel={t("archive.action")}
        cancelLabel={t("builder.cancel")}
        tone="danger"
        onConfirm={confirmArchive}
      />
    </div>
  );
}
