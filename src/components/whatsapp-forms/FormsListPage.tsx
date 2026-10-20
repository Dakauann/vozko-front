"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { archiveFormAction, duplicateFormAction } from "@/app/actions/whatsapp-forms";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { Archive, ArrowClockwise, ChatText, Copy, DotsThreeVertical, Files, MagnifyingGlass, PaperPlaneTilt, PencilSimple, Plus, XCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFormAccess, useFormsList, useRefreshForms } from "@/hooks/use-whatsapp-forms";
import { useRouter } from "@/i18n/routing";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { formBuilderHref, formDetailHref, newFormHref, responseRate } from "@/lib/whatsapp-forms/links";
import type { FormSummary } from "@/lib/whatsapp-forms/types";
import { cn } from "@/lib/utils";

import { PublicationMarks } from "./PublicationMarks";
import { useFormError } from "./use-form-text";

const SEARCH_DEBOUNCE_MS = 300;

function RowActions({ row, onArchive }: { row: FormSummary; onArchive: (row: FormSummary) => void }) {
  const t = useTranslations("whatsappForms.list");
  const router = useRouter();
  const access = useFormAccess();
  const errorText = useFormError();
  const refresh = useRefreshForms();
  const [busy, setBusy] = useState(false);

  const duplicate = async () => {
    setBusy(true);
    const answer = await duplicateFormAction(row.form.id);
    setBusy(false);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return;
    }
    toast.success(t("toast.duplicated"));
    void refresh();
    router.push(formBuilderHref(answer.data.form.id));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("actions.menu", { name: row.form.name })}
          disabled={busy}
          onClick={(event) => event.stopPropagation()}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <DotsThreeVertical className="h-4 w-4" weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {access.edit && !row.form.archivedAt ? (
          <DropdownMenuItem onSelect={() => router.push(formBuilderHref(row.form.id))}>
            <PencilSimple className="mr-2 h-4 w-4" />
            {t("actions.edit")}
          </DropdownMenuItem>
        ) : null}
        {access.create ? (
          <DropdownMenuItem onSelect={() => void duplicate()}>
            <Copy className="mr-2 h-4 w-4" />
            {t("actions.duplicate")}
          </DropdownMenuItem>
        ) : null}
        {access.responses ? (
          <DropdownMenuItem onSelect={() => router.push(formDetailHref(row.form.id))}>
            <ChatText className="mr-2 h-4 w-4" />
            {t("actions.responses")}
          </DropdownMenuItem>
        ) : null}
        {access.archive && !row.form.archivedAt ? (
          <DropdownMenuItem onSelect={() => onArchive(row)}>
            <Archive className="mr-2 h-4 w-4" />
            {t("actions.archive")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FormsListPage() {
  const t = useTranslations("whatsappForms");
  const format = useFormatter();
  const router = useRouter();
  const access = useFormAccess();
  const errorText = useFormError();
  const refresh = useRefreshForms();
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [archiving, setArchiving] = useState<FormSummary | null>(null);
  const term = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const query = useFormsList({ search: term, archived });
  const rows = useMemo(() => query.data ?? [], [query.data]);

  const totals = useMemo(() => rows.reduce((sum, row) => ({ sent: sum.sent + row.sent, responses: sum.responses + row.responses }), { sent: 0, responses: 0 }), [rows]);
  const columns = useMemo<DashboardTableColumn<FormSummary>[]>(() => {
    const date = (value?: string) => (value ? format.dateTime(new Date(value), { dateStyle: "short", timeStyle: "short" }) : <EmptyValue />);
    return [
      {
        key: "name",
        header: t("list.table.name"),
        render: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{row.form.name}</span>
            {row.form.description ? <span className="truncate text-xs text-muted-foreground">{row.form.description}</span> : null}
          </span>
        ),
      },
      { key: "status", header: t("list.table.status"), render: (row) => <PublicationMarks publications={row.publications} /> },
      { key: "sent", header: t("list.table.sent"), className: "text-right", render: (row) => <span className="tabular-nums">{format.number(row.sent)}</span> },
      { key: "responses", header: t("list.table.responses"), className: "text-right", render: (row) => <span className="tabular-nums">{format.number(row.responses)}</span> },
      {
        key: "rate",
        header: t("list.table.rate"),
        className: "text-right",
        render: (row) => {
          const rate = responseRate(row);
          return rate === null ? <EmptyValue /> : <span className="tabular-nums">{format.number(rate / 100, { style: "percent", maximumFractionDigits: 1 })}</span>;
        },
      },
      { key: "lastResponse", header: t("list.table.lastResponse"), render: (row) => <span className="whitespace-nowrap text-sm text-muted-foreground">{date(row.lastResponseAt)}</span> },
      { key: "updated", header: t("list.table.updated"), render: (row) => <span className="whitespace-nowrap text-sm text-muted-foreground">{date(row.form.updatedAt)}</span> },
    ];
  }, [t, format]);

  const archive = async () => {
    if (!archiving) return;
    const answer = await archiveFormAction(archiving.form.id);
    setArchiving(null);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return;
    }
    toast.success(t("list.toast.archived"));
    void refresh();
  };

  const failure = query.isError && !query.data ? query.error : null;
  const newHref = newFormHref();

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader icon={<Files className="h-6 w-6" />} badge={t("list.title")} description={t("list.description")} />

      <DashboardTable<FormSummary>
        data={rows}
        columns={columns}
        rowKey={(row) => row.form.id}
        loading={query.isFetching && !query.data}
        onRowClick={(row) => router.push(formDetailHref(row.form.id))}
        renderRowActions={(row) => <RowActions row={row} onArchive={setArchiving} />}
        stats={[
          { label: t("list.stats.forms"), value: query.data ? format.number(rows.length) : "…", icon: <Files className="h-4 w-4 text-info-ink" /> },
          { label: t("list.stats.sent"), value: query.data ? format.number(totals.sent) : "…", icon: <PaperPlaneTilt className="h-4 w-4 text-muted-foreground" /> },
          { label: t("list.stats.responses"), value: query.data ? format.number(totals.responses) : "…", icon: <ChatText className="h-4 w-4 text-healthy-ink" /> },
        ]}
        headerLeft={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <ElevatedInput
              label={t("list.search")}
              value={search}
              controlSize="sm"
              className="w-full max-w-xs"
              icon={<MagnifyingGlass className="h-4 w-4" />}
              onChange={(event) => setSearch(event.target.value)}
            />
            <ElevatedPillToggle
              value={archived ? "archived" : "active"}
              onChange={(value) => setArchived(value === "archived")}
              options={[
                { value: "active", label: t("list.active") },
                { value: "archived", label: t("list.archived") },
              ]}
            />
          </div>
        }
        headerRight={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              title=""
              aria-label={t("common.refresh")}
              icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", query.isFetching && "animate-spin")} />}
              iconVisible
              onClick={() => void query.refetch()}
            />
            {access.create ? <Button variant="primary" title={t("list.create")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" link={newHref} newTab={false} /> : null}
          </div>
        }
        emptyState={
          failure
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("common.errorTitle"),
                description: errorText({ code: sectionErrorCode(failure) }),
                action: <Button variant="secondary" title={t("common.retry")} onClick={() => void query.refetch()} />,
              }
            : term || archived
              ? { icon: <Files className="h-7 w-7 text-muted-foreground" />, title: t("list.emptyFiltered") }
              : {
                  icon: <Files className="h-7 w-7 text-muted-foreground" />,
                  title: t("list.empty.title"),
                  description: t("list.empty.description"),
                  action: access.create ? <Button variant="primary" title={t("list.create")} link={newHref} newTab={false} /> : undefined,
                }
        }
      />

      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={t("list.archiveConfirm.title")}
        description={t("list.archiveConfirm.description", { name: archiving?.form.name ?? "" })}
        confirmLabel={t("list.archiveConfirm.confirm")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        onConfirm={archive}
      />
    </div>
  );
}
