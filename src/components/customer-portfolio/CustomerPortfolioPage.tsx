"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { ArrowClockwise, MagnifyingGlass, Plus, UserCheck, WarningCircle, XCircle } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { usePortfolioAccess, usePortfolioPage } from "@/hooks/use-customer-portfolio";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRouter } from "@/i18n/routing";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import type { PortfolioHolderScope, PortfolioRow } from "@/lib/customer-portfolio/portfolio";
import { leadDetailHref } from "@/lib/leads/detail";
import { cn } from "@/lib/utils";

import { AddLeadToPortfolioDialog } from "./AddLeadToPortfolioDialog";
import { MovePortfolioDialog } from "./MovePortfolioDialog";
import { PortfolioCustomerCell, PortfolioReachCell } from "./PortfolioCustomerCell";
import { PortfolioEntryActions } from "./PortfolioEntryActions";
import { PortfolioScopeSelect } from "./PortfolioScopeSelect";
import { usePortfolioError } from "./use-portfolio-commands";

const PAGE_SIZES = [20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 300;

function HolderCell({ row, unknown }: { row: PortfolioRow; unknown: string }) {
  const t = useTranslations("customerPortfolio.dormant");
  return (
    <span className="flex min-w-0 flex-col items-start gap-1">
      <span className="truncate text-sm text-foreground">{row.holderName || unknown}</span>
      {row.holderReceives ? null : (
        <span title={t("hint")}>
          <StatusChip tone="warning" label={t("label")} icon={<WarningCircle weight="fill" className="h-3 w-3" />} />
        </span>
      )}
    </span>
  );
}

export function CustomerPortfolioPage() {
  const t = useTranslations("customerPortfolio");
  const format = useFormatter();
  const router = useRouter();
  const errorText = usePortfolioError();
  const { can } = useWorkspace();
  const { userId, uses, manages } = usePortfolioAccess();
  const opensLeads = can("leads", "read");

  const [scope, setScope] = useState<PortfolioHolderScope>({ kind: "mine" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [moving, setMoving] = useState<PortfolioRow | null>(null);
  const [adding, setAdding] = useState(false);
  const term = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const query = usePortfolioPage({ scope, page, pageSize, search: term });
  const current = query.data;
  const rows = current?.items ?? [];
  const showsHolder = scope.kind !== "mine";
  const unknown = t("page.unknownMember");
  const addsForOthers = manages && scope.kind !== "mine";
  const addHolder = scope.kind === "member" ? scope.userId : userId;

  const openLead = (row: PortfolioRow) => {
    if (row.subject.kind === "lead") router.push(leadDetailHref(row.subject.leadId));
  };

  const columns = useMemo<DashboardTableColumn<PortfolioRow>[]>(() => {
    const list: DashboardTableColumn<PortfolioRow>[] = [
      { key: "customer", header: t("table.customer"), render: (row) => <PortfolioCustomerCell row={row} /> },
      { key: "reach", header: t("table.reach"), render: (row) => <PortfolioReachCell row={row} /> },
    ];
    if (showsHolder) list.push({ key: "holder", header: t("table.holder"), render: (row) => <HolderCell row={row} unknown={unknown} /> });
    list.push(
      {
        key: "since",
        header: t("table.since"),
        render: (row) => <span className="whitespace-nowrap text-sm text-muted-foreground">{format.dateTime(new Date(row.addedAt), { dateStyle: "short" })}</span>,
      },
      {
        key: "addedBy",
        header: t("table.addedBy"),
        render: (row) => <span className="truncate text-sm text-muted-foreground">{row.addedByName || unknown}</span>,
      },
    );
    return list;
  }, [t, format, showsHolder, unknown]);

  const changeScope = (next: PortfolioHolderScope) => {
    setScope(next);
    setPage(1);
  };

  const failure = query.isError && !current ? query.error : null;
  const totalPages = current ? Math.max(1, current.totalPages) : 1;
  const emptyTitle = scope.kind === "mine" ? t("page.emptyMineTitle") : t("page.emptyTeamTitle");
  const emptyDescription = term ? t("page.emptyFiltered") : scope.kind === "mine" ? t("page.emptyMineDescription") : t("page.emptyTeamDescription");

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader badge={t("page.title")} description={t("page.description")} icon={<UserCheck className="h-6 w-6" />} />

      <DashboardTable<PortfolioRow>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={query.isFetching && !current}
        onRowClick={opensLeads ? openLead : undefined}
        renderRowActions={(row) => (
          <PortfolioEntryActions
            row={row}
            canMove={manages}
            canRemove={manages || (uses && row.holderId === userId)}
            onOpenLead={opensLeads && row.subject.kind === "lead" ? () => openLead(row) : undefined}
            onMove={() => setMoving(row)}
          />
        )}
        toolbar={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
            {manages ? (
              <div className="w-full sm:max-w-xs">
                <PortfolioScopeSelect scope={scope} userId={userId} onChange={changeScope} />
              </div>
            ) : null}
            <div className="w-full sm:max-w-sm">
              <ElevatedInput
                label={t("search.label")}
                placeholder={t("search.placeholder")}
                icon={<MagnifyingGlass className="h-4 w-4" />}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        }
        stats={[{ label: t("stats.customers"), value: current ? current.totalItems : "…", icon: <UserCheck className="h-4 w-4 text-info-ink" /> }]}
        headerRight={
          <div className="flex items-center gap-2">
            <ExplainerHint id="crm.customerPortfolio" align="end" />
            <Button
              variant="ghost"
              title=""
              aria-label={t("page.refresh")}
              icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", query.isFetching && "animate-spin")} />}
              iconVisible
              iconSide="left"
              onClick={() => void query.refetch()}
            />
            {uses && opensLeads ? (
              <Button variant="primary" title={t("page.add")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => setAdding(true)} />
            ) : null}
          </div>
        }
        pagination={
          current && current.totalItems > 0
            ? {
                currentPage: current.page,
                totalPages,
                pageSize: current.pageSize,
                totalItems: current.totalItems,
                onPageChange: setPage,
                pageSizeOptions: PAGE_SIZES,
                onPageSizeChange: (size) => {
                  setPageSize(size);
                  setPage(1);
                },
              }
            : undefined
        }
        emptyState={
          failure
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("page.errorTitle"),
                description: errorText({ code: sectionErrorCode(failure) }),
                action: <Button variant="secondary" title={t("page.retry")} onClick={() => void query.refetch()} />,
              }
            : { icon: <UserCheck className="h-7 w-7 text-muted-foreground" />, title: emptyTitle, description: emptyDescription }
        }
      />

      {moving ? <MovePortfolioDialog row={moving} onClose={() => setMoving(null)} /> : null}
      {adding ? <AddLeadToPortfolioDialog holderId={addHolder} choosesHolder={addsForOthers} onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
