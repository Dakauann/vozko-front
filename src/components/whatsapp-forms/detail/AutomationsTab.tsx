"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createFormAutomationAction } from "@/app/actions/whatsapp-forms";
import Button from "@/components/elevated-design/button";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { FlowArrow, Plus, XCircle } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useFormAutomations, useRefreshForms } from "@/hooks/use-whatsapp-forms";
import { useRouter } from "@/i18n/routing";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { workflowHref } from "@/lib/whatsapp-forms/links";
import type { FormAutomation, FormDetail } from "@/lib/whatsapp-forms/types";

import { useFormError } from "../use-form-text";

export function AutomationsTab({ detail }: { detail: FormDetail }) {
  const t = useTranslations("whatsappForms");
  const router = useRouter();
  const { can } = useWorkspace();
  const errorText = useFormError();
  const refresh = useRefreshForms();
  const query = useFormAutomations(detail.form.id);
  const [creating, setCreating] = useState(false);
  const canCreate = can("workflows", "create");
  const opens = can("workflows", "read");

  const create = async () => {
    setCreating(true);
    const answer = await createFormAutomationAction(detail.form.id);
    setCreating(false);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return;
    }
    void refresh(detail.form.id);
    const href = workflowHref(answer.data.workflowId);
    if (href) router.push(href);
  };

  const columns: DashboardTableColumn<FormAutomation>[] = [
    { key: "name", header: t("automations.table.name"), render: (row) => <span className="text-sm font-medium text-foreground">{row.name || row.workflowId}</span> },
    { key: "use", header: t("automations.table.use"), render: (row) => <span className="text-sm text-muted-foreground">{t(`automations.uses.${row.use}`)}</span> },
    { key: "active", header: t("automations.table.status"), render: (row) => <StatusChip tone={row.active ? "healthy" : "muted"} label={row.active ? t("automations.active") : t("automations.inactive")} /> },
  ];
  const failure = query.isError && !query.data ? query.error : null;

  return (
    <div className="space-y-3">
      <p className="max-w-2xl text-sm text-muted-foreground">{t("automations.description")}</p>
      <DashboardTable<FormAutomation>
        data={query.data ?? []}
        columns={columns}
        rowKey={(row) => row.workflowId}
        loading={query.isFetching && !query.data}
        onRowClick={
          opens
            ? (row) => {
                const href = workflowHref(row.workflowId);
                if (href) router.push(href);
              }
            : undefined
        }
        headerRight={
          canCreate ? (
            <Button
              variant="primary"
              title={creating ? t("automations.creating") : t("automations.create")}
              icon={<Plus className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              disabled={creating}
              onClick={() => void create()}
            />
          ) : undefined
        }
        emptyState={
          failure
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("common.errorTitle"),
                description: errorText({ code: sectionErrorCode(failure) }),
                action: <Button variant="secondary" title={t("common.retry")} onClick={() => void query.refetch()} />,
              }
            : { icon: <FlowArrow className="h-7 w-7 text-muted-foreground" />, title: t("automations.empty.title"), description: t("automations.empty.description") }
        }
      />
    </div>
  );
}
