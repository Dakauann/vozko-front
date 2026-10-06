"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { listFormLeadsAction, syncLeadFormAction } from "@/app/actions/advertising-forms";
import { isAdsError } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, ArrowLeft, ArrowSquareOut, ClipboardText, Warning } from "@/components/icons";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/routing";
import { formBuilderFromForm, humanizeKey, leadContact, type FormLead, type LeadForm } from "@/lib/advertising/forms";
import type { AdAccount, AdPage } from "@/lib/advertising/types";
import { formatWhen } from "@/lib/advertising/when";
import { cn } from "@/lib/utils";

import { useAdsFormat } from "../use-ads-format";
import { FormPreview } from "./form-preview";

const PAGE_SIZE = 20;

export function FormLeadsView({ account, page: adPage, form, onBack }: { account: AdAccount; page: AdPage; form: LeadForm; onBack: () => void }) {
  const t = useTranslations("adsForms.leads");
  const fmt = useAdsFormat();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const load = useCallback(() => listFormLeadsAction(form.metaId, PAGE_SIZE, (page - 1) * PAGE_SIZE), [form.metaId, page]);
  const leads = useKeyedLoad(`${form.metaId}:${page}`, load);
  const shape = useMemo(() => formBuilderFromForm(form), [form]);

  const response = leads.latest;
  const data = response && !isAdsError(response) ? response.data : null;
  const error = response && isAdsError(response) ? response.error : null;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const sync = async () => {
    setSyncing(true);
    const outcome = await syncLeadFormAction(form.metaId, account.id);
    setSyncing(false);
    if (isAdsError(outcome)) {
      toast({ title: t("syncFailed"), description: outcome.error, variant: "destructive" });
      return;
    }
    toast({ title: t("synced", { count: outcome.data.imported }) });
    leads.reload();
  };

  const columns: DashboardTableColumn<FormLead>[] = [
    {
      key: "date",
      header: t("columns.date"),
      render: (lead) => <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{formatWhen(lead.createdTime, fmt.tag)}</span>,
    },
    {
      key: "name",
      header: t("columns.name"),
      render: (lead) => <span className="text-sm font-medium text-foreground">{lead.leadName || leadContact(lead.answers).name || fmt.empty}</span>,
    },
    {
      key: "phone",
      header: t("columns.phone"),
      render: (lead) => <span className="whitespace-nowrap text-sm tabular-nums">{leadContact(lead.answers).phone ?? fmt.empty}</span>,
    },
    {
      key: "email",
      header: t("columns.email"),
      render: (lead) => <span className="text-sm">{leadContact(lead.answers).email ?? fmt.empty}</span>,
    },
    {
      key: "answers",
      header: t("columns.answers"),
      render: (lead) => {
        const others = leadContact(lead.answers).others;
        if (others.length === 0) return <EmptyValue className="text-sm" />;
        return (
          <dl className="space-y-0.5 text-xs">
            {others.map((answer) => (
              <div key={answer.key} className="flex gap-1">
                <dt className="text-muted-foreground">{humanizeKey(answer.key)}:</dt>
                <dd className="text-foreground">{answer.value}</dd>
              </div>
            ))}
          </dl>
        );
      },
    },
    {
      key: "crm",
      header: t("columns.crm"),
      render: (lead) =>
        lead.leadId ? (
          <Link
            href={`/dashboard/leads/${encodeURIComponent(lead.leadId)}`}
            className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-primary-ink hover:underline"
          >
            {t("openCrm")}
            <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{t("notInCrm")}</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" title={t("back")} icon={<ArrowLeft className="h-4 w-4" />} iconVisible iconSide="left" onClick={onBack} />
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold text-foreground">{form.name}</h2>
            <p className="text-xs text-muted-foreground">{t("total", { count: total })}</p>
          </div>
        </div>
        <Button
          variant="secondary"
          title={syncing ? t("syncing") : t("sync")}
          icon={<ArrowClockwise className={cn("h-4 w-4", syncing && "animate-spin")} />}
          iconVisible
          iconSide="left"
          disabled={syncing}
          onClick={sync}
        />
      </div>
      {error ? (
        <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" aria-hidden />
          {error}
          <button type="button" onClick={leads.reload} className="ml-auto font-semibold text-primary-ink hover:underline">
            {t("retry")}
          </button>
        </div>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DashboardTable
          data={items}
          columns={columns}
          rowKey={(lead) => lead.metaId}
          loading={leads.loading}
          pagination={
            total > PAGE_SIZE
              ? {
                  currentPage: page,
                  totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
                  pageSize: PAGE_SIZE,
                  totalItems: total,
                  onPageChange: setPage,
                }
              : undefined
          }
          emptyState={{
            icon: <ClipboardText className="h-7 w-7 text-muted-foreground" />,
            title: t("emptyTitle"),
            description: t("emptyBody"),
          }}
        />
        <FormPreview state={shape} page={adPage} />
      </div>
    </div>
  );
}
