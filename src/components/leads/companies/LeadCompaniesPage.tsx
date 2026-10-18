"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateLeadCompanyAction } from "@/app/actions/lead-companies";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, Buildings, MagnifyingGlass, Plus, XCircle } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLeadCompaniesPage, useRefreshLeadCompanies } from "@/hooks/use-lead-companies";
import { useRouter } from "@/i18n/routing";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { companyMembersHref, type LeadCompany } from "@/lib/leads/companies";
import { pathForScreen } from "@/lib/navigation/routes";
import { cn } from "@/lib/utils";

import { CompanyAvatar } from "./CompanyAvatar";
import { LeadCompanyActionsMenu } from "./LeadCompanyActionsMenu";
import { LeadCompanyDialog } from "./LeadCompanyDialog";
import { useCompanyError } from "./use-company-error";

const PAGE_SIZES = [20, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 300;

type Editing = { mode: "closed" } | { mode: "create" } | { mode: "edit"; company: LeadCompany };

function AcceptsToggle({ company, canEdit }: { company: LeadCompany; canEdit: boolean }) {
  const t = useTranslations("leadCompanies");
  const errorText = useCompanyError();
  const refresh = useRefreshLeadCompanies();
  const [busy, setBusy] = useState(false);

  if (!canEdit) {
    return <StatusChip tone={company.acceptsLeads ? "healthy" : "muted"} label={company.acceptsLeads ? t("accepts.on") : t("accepts.off")} />;
  }

  const toggle = async (acceptsLeads: boolean) => {
    setBusy(true);
    const answer = await updateLeadCompanyAction(company.id, { acceptsLeads });
    setBusy(false);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return;
    }
    await refresh();
    toast.success(acceptsLeads ? t("actions.opened", { name: company.name }) : t("actions.closed", { name: company.name }));
  };

  return (
    <span className="contents" onClick={(event) => event.stopPropagation()}>
      <ElevatedSwitch aria-label={t("accepts.toggle", { name: company.name })} checked={company.acceptsLeads} disabled={busy} onCheckedChange={(checked) => void toggle(checked)} />
    </span>
  );
}

export function LeadCompaniesPage() {
  const t = useTranslations("leadCompanies");
  const format = useFormatter();
  const router = useRouter();
  const errorText = useCompanyError();
  const { can } = useWorkspace();
  const canCreate = can("lead_companies", "create");
  const canEdit = can("lead_companies", "update");
  const canDelete = can("lead_companies", "delete");
  const leadsPath = pathForScreen("leads") ?? "/dashboard/leads";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [editing, setEditing] = useState<Editing>({ mode: "closed" });
  const term = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const query = useLeadCompaniesPage({ page, pageSize, search: term });
  const current = query.data;
  const companies = current?.items ?? [];

  const openMembers = (company: LeadCompany) => router.push(companyMembersHref(leadsPath, company.id));

  const columns = useMemo<DashboardTableColumn<LeadCompany>[]>(
    () => [
      {
        key: "name",
        header: t("table.name"),
        render: (company) => (
          <span className="flex min-w-0 items-center gap-3">
            <CompanyAvatar company={company} />
            <span className="truncate text-sm font-semibold text-foreground">{company.name}</span>
          </span>
        ),
      },
      {
        key: "members",
        header: t("table.members"),
        render: (company) => <span className="whitespace-nowrap text-sm text-foreground">{t("members", { count: company.membersCount })}</span>,
      },
      {
        key: "accepts",
        header: t("table.accepts"),
        render: (company) => <AcceptsToggle company={company} canEdit={canEdit} />,
      },
      {
        key: "updatedAt",
        header: t("table.updatedAt"),
        render: (company) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">{format.dateTime(new Date(company.updatedAt), { dateStyle: "short" })}</span>
        ),
      },
    ],
    [t, format, canEdit],
  );

  const failure = query.isError && !current ? query.error : null;
  const totalPages = current ? Math.max(1, current.totalPages) : 1;

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader badge={t("page.title")} description={t("page.description")} icon={<Buildings className="h-6 w-6" />} />

      <DashboardTable<LeadCompany>
        data={companies}
        columns={columns}
        rowKey={(company) => company.id}
        loading={query.isFetching && !current}
        onRowClick={openMembers}
        renderRowActions={(company) => (
          <LeadCompanyActionsMenu
            company={company}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={() => setEditing({ mode: "edit", company })}
            onMembers={() => openMembers(company)}
          />
        )}
        toolbar={
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
        }
        stats={[{ label: t("stats.companies"), value: current ? current.totalItems : "…", icon: <Buildings className="h-4 w-4 text-info-ink" /> }]}
        headerRight={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              title=""
              aria-label={t("page.refresh")}
              icon={<ArrowClockwise weight="bold" className={cn("h-4 w-4", query.isFetching && "animate-spin")} />}
              iconVisible
              iconSide="left"
              onClick={() => void query.refetch()}
            />
            {canCreate ? (
              <Button
                variant="primary"
                title={t("page.create")}
                icon={<Plus weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                onClick={() => setEditing({ mode: "create" })}
              />
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
            : {
                icon: <Buildings className="h-7 w-7 text-muted-foreground" />,
                title: t("page.emptyTitle"),
                description: term ? t("page.emptyFiltered") : t("page.emptyDescription"),
                action:
                  !term && canCreate ? <Button variant="secondary" title={t("page.create")} onClick={() => setEditing({ mode: "create" })} /> : undefined,
              }
        }
      />

      {editing.mode !== "closed" ? (
        <LeadCompanyDialog company={editing.mode === "edit" ? editing.company : null} onClose={() => setEditing({ mode: "closed" })} />
      ) : null}
    </div>
  );
}
