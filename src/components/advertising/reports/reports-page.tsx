"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { isAdsError } from "@/app/actions/advertising";
import { deleteAdSavedReportAction, listAdSavedReportsAction } from "@/app/actions/advertising-reports";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowSquareOut, ChartBar, ClockCounterClockwise, FileCsv, FileText, MagnifyingGlass, PencilSimple, Plus, Trash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { useKeyedLoad } from "@/hooks/use-keyed-load";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "@/i18n/routing";
import { reportHref } from "@/lib/advertising/connect";
import { filterReports, newReportHref, reportsListHref, reportsSection, reportStamp, type ReportsSection } from "@/lib/advertising/reports";
import type { AdAccount, AdSavedReport } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import { AccountGate } from "../account-gate";
import { AccountPicker } from "../account-picker";
import { IconAction } from "../icon-action";
import { useLoadErrorState } from "../load-error-state";
import { useAdsFormat } from "../use-ads-format";
import { MutedCell } from "./muted-cell";
import { ReportExports } from "./report-exports";
import { ReportRenameDialog } from "./report-rename-dialog";
import { ReportTemplates } from "./report-templates";
import { useReportPermissions, type ReportPermissions } from "./use-report-permissions";

const SECTION_ICONS: Record<ReportsSection, typeof FileText> = { reports: FileText, exports: FileCsv };
const SECTIONS: ReportsSection[] = ["reports", "exports"];

function SectionSwitcher({ value, onChange }: { value: ReportsSection; onChange: (section: ReportsSection) => void }) {
  const t = useTranslations("adsReports.sections");
  return (
    <nav aria-label={t("label")} className="lg:w-44">
      <ul className="flex gap-1 lg:flex-col">
        {SECTIONS.map((section) => {
          const Icon = SECTION_ICONS[section];
          const current = section === value;
          return (
            <li key={section}>
              <button
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => onChange(section)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[--radius] px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current ? "bg-muted font-semibold text-foreground" : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" weight="bold" aria-hidden />
                {t(section)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ReportsList({ account, permissions, onShowExports }: { account: AdAccount; permissions: ReportPermissions; onShowExports: () => void }) {
  const t = useTranslations("adsReports");
  const fmt = useAdsFormat();
  const router = useRouter();
  const { toast } = useToast();
  const loadError = useLoadErrorState();
  const list = useKeyedLoad("ad-reports", listAdSavedReportsAction);
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<AdSavedReport | null>(null);
  const [deleting, setDeleting] = useState<AdSavedReport | null>(null);

  const response = list.latest;
  const error = response && isAdsError(response) ? response.error : null;
  const reports = filterReports(response && !isAdsError(response) ? response.data : [], account.id, search);
  const stamp = (iso: string | undefined) => reportStamp(iso, fmt.tag) ?? t("list.never");

  const replace = (updated: AdSavedReport) =>
    list.update((current) => (isAdsError(current) ? current : { data: current.data.map((report) => (report.id === updated.id ? updated : report)) }));

  const confirmDelete = async () => {
    const target = deleting;
    if (!target) return;
    const outcome = await deleteAdSavedReportAction(target.id);
    setDeleting(null);
    if (isAdsError(outcome)) {
      toast({ title: t("delete.failed"), description: outcome.error, variant: "destructive" });
      return;
    }
    toast({ title: t("delete.done") });
    list.update((current) => (isAdsError(current) ? current : { data: current.data.filter((report) => report.id !== target.id) }));
  };

  const columns: DashboardTableColumn<AdSavedReport>[] = [
    {
      key: "name",
      header: t("list.columns.name"),
      render: (report) => <span className="block max-w-xs truncate text-sm font-medium text-foreground sm:max-w-md">{report.name}</span>,
    },
    { key: "lastOpened", header: t("list.columns.lastOpened"), render: (report) => <MutedCell value={stamp(report.lastOpenedAt)} /> },
    { key: "updated", header: t("list.columns.updated"), render: (report) => <MutedCell value={stamp(report.updatedAt)} /> },
    { key: "created", header: t("list.columns.created"), render: (report) => <MutedCell value={stamp(report.createdAt)} /> },
  ];

  const createButton = permissions.canCreate ? (
    <Button
      variant="primary"
      title={t("list.create")}
      icon={<Plus weight="bold" className="h-4 w-4" />}
      iconVisible
      iconSide="left"
      link={newReportHref(account.id)}
    />
  ) : null;

  const filtering = search.trim() !== "";

  return (
    <>
      <DashboardTable
        data={reports}
        columns={columns}
        rowKey={(report) => report.id}
        loading={list.loading && !response}
        onRowClick={(report) => router.push(reportHref(report.id))}
        headerLeft={
          <div className="w-full max-w-xs">
            <ElevatedInput
              type="search"
              placeholder={t("list.search")}
              aria-label={t("list.search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
            />
          </div>
        }
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              title={t("list.exportsHistory")}
              icon={<ClockCounterClockwise className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={onShowExports}
            />
            {createButton}
          </div>
        }
        renderRowActions={(report) => (
          <>
            <IconAction label={t("list.open")} onClick={() => router.push(reportHref(report.id))}>
              <ArrowSquareOut className="h-4 w-4" />
            </IconAction>
            {permissions.canUpdate ? (
              <IconAction label={t("list.rename")} onClick={() => setRenaming(report)}>
                <PencilSimple className="h-4 w-4" />
              </IconAction>
            ) : null}
            {permissions.canDelete ? (
              <IconAction label={t("list.delete")} onClick={() => setDeleting(report)} danger>
                <Trash className="h-4 w-4" />
              </IconAction>
            ) : null}
          </>
        )}
        emptyState={
          error
            ? loadError(error, list.reload)
            : filtering
              ? { icon: <MagnifyingGlass className="h-7 w-7 text-muted-foreground" />, title: t("list.noMatchTitle"), description: t("list.noMatchBody") }
              : {
                  icon: <ChartBar className="h-7 w-7 text-muted-foreground" />,
                  title: t("list.emptyTitle"),
                  description: t("list.emptyBody"),
                  action: createButton ? <div className="mt-2">{createButton}</div> : undefined,
                }
        }
      />
      {renaming ? (
        <ReportRenameDialog
          report={renaming}
          onClose={() => setRenaming(null)}
          onRenamed={(report) => {
            setRenaming(null);
            replace(report);
          }}
        />
      ) : null}
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

export function ReportsPage() {
  const t = useTranslations("adsReports");
  const searchParams = useSearchParams();
  const router = useRouter();
  const section = reportsSection(searchParams);
  const openSection = (accountId: string, next: ReportsSection) => router.replace(reportsListHref(accountId, next));
  const permissions = useReportPermissions();
  const accounts = useAdAccounts({ enabled: permissions.canRead, requested: searchParams.get("account") });

  const header = (
    <DashboardPageHeader
      badge={t("header.title")}
      description={t("header.description")}
      icon={<ChartBar className="h-6 w-6" />}
      actions={accounts.selected ? <AccountPicker accounts={accounts.accounts} value={accounts.selected.id} onChange={accounts.select} /> : null}
    />
  );

  return (
    <AccountGate header={header} accounts={accounts} permissionsLoading={permissions.loading} canRead={permissions.canRead} canConnect={permissions.canCreate}>
      {(account) => (
        <div className="w-full space-y-4">
          {header}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <SectionSwitcher value={section} onChange={(next) => openSection(account.id, next)} />
            <div className="min-w-0 flex-1">
              {section === "exports" ? (
                <ReportExports account={account} permissions={permissions} />
              ) : (
                <ReportsList account={account} permissions={permissions} onShowExports={() => openSection(account.id, "exports")} />
              )}
            </div>
            {section === "reports" ? (
              <aside className="lg:w-80 lg:flex-shrink-0">
                <ReportTemplates accountId={account.id} />
              </aside>
            ) : null}
          </div>
        </div>
      )}
    </AccountGate>
  );
}
