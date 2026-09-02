"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  Clock,
  Prohibit,
  UploadSimple,
  Users,
  WhatsappLogo,
} from "@/components/icons";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import Button from "@/components/elevated-design/button";
import ImportLeadsDialog from "./_components/ImportLeadsDialog";
import LeadSavedViews from "./_components/LeadSavedViews";
import LeadsToolbar, {
  type LeadFilterOptionSets,
} from "./_components/LeadsToolbar";
import { getLeadFacetsAction, listLeadsQueryAction } from "@/app/actions/leads";
import { listLabelsAction } from "@/app/actions/labels";
import { listStagesAction } from "@/app/actions/stages";
import { listWhatsAppCampaignsAction } from "@/app/actions/whatsapp-campaigns";
import { useListQueryState } from "@/hooks/use-list-query-state";
import type { SavedView } from "@/lib/crm/saved-views";
import { emptyLeadFilter, isEmptyLeadFilter } from "@/lib/leads/filters";
import {
  LEAD_PAGE_SIZES,
  LEAD_SORT_KEYS,
  type LeadFacets,
  type LeadListItem,
  type LeadSortKey,
} from "@/lib/leads/types";
import { cn } from "@/lib/utils";
import { EditableLeadName } from "@/components/leads/EditableLeadName";
import { useWorkspace } from "@/contexts/workspace-context";

function formatDate(
  value: string | undefined | null,
  locale: string,
  withTime = true,
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

const DEFAULT_SORTS = [{ key: "createdAt" as LeadSortKey, direction: "desc" as const }];

function LeadsPageContent() {
  const t = useTranslations("leadsPage");
  const locale = useLocale();

  // The URL is the state: a filtered, sorted, paged list is a link someone can
  // send, bookmark and come back to.
  const query = useListQueryState<LeadSortKey>({
    sortKeys: LEAD_SORT_KEYS,
    defaultSorts: DEFAULT_SORTS,
    defaultPageSize: 20,
    pageSizes: LEAD_PAGE_SIZES,
  });

  const { can } = useWorkspace();
  const canRenameLead = can("leads", "update");
  const canImportLeads = can("leads", "create");
  const [importOpen, setImportOpen] = useState(false);

  // Bumped after an import so the list and its facet counts re-read. An import
  // is the one action on this page that changes the SET being listed, so
  // patching rows in place would leave the "Total" tile behind.
  const [reloadKey, setReloadKey] = useState(0);
  const [items, setItems] = useState<LeadListItem[]>([]);
  const [facets, setFacets] = useState<LeadFacets | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [facetsLoading, setFacetsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [options, setOptions] = useState<LeadFilterOptionSets>({
    campaigns: [],
    stages: [],
    labels: [],
    loading: true,
  });

  const { filter, search, sorts, page, pageSize } = query;

  // Serialized so the effect re-runs on VALUE changes, not on the new object
  // identity a URL read produces on every render.
  const filterKey = JSON.stringify(filter);
  const sortKey = sorts.map((s) => `${s.key}:${s.direction}`).join(",");

  // The rows: re-read whenever anything about the request changes.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const list = await listLeadsQueryAction({
        filter,
        q: search,
        sorts,
        page,
        pageSize,
      });
      if (cancelled) return;

      if (list.error) {
        setError(list.error);
        setItems([]);
        setTotalItems(0);
        setTotalPages(1);
      } else {
        setError(null);
        setItems(list.items);
        setTotalItems(list.meta.totalItems);
        setTotalPages(list.meta.totalPages);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, search, sortKey, page, pageSize, reloadKey]);

  // The counts: a separate effect on purpose, keyed to the FILTER alone.
  //
  // Facets describe the whole filtered set, so turning to page 2 or re-sorting
  // cannot change a single one of them. Asking for them in the same effect as
  // the rows meant every page turn re-ran four unbounded queries, one of which
  // evaluates a correlated EXISTS per lead in the workspace, to receive the
  // numbers already on screen.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setFacetsLoading(true);
      const result = await getLeadFacetsAction({ filter, q: search });
      if (cancelled) return;
      setFacets(result.error ? null : result.facets);
      setFacetsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, search, reloadKey]);

  // Option sets for the id-based filters. Loaded once: they change far more
  // slowly than the list, and re-fetching them per keystroke would triple the
  // traffic of typing a name.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [campaigns, stages, labels] = await Promise.all([
        listWhatsAppCampaignsAction(1, 100),
        listStagesAction(),
        listLabelsAction(),
      ]);
      if (cancelled) return;

      setOptions({
        campaigns: campaigns.campaigns.map((c) => ({ value: c.id, label: c.name })),
        stages: stages.stages.map((s) => ({
          value: s.id,
          label: s.name,
          color: s.color,
        })),
        labels: labels.labels.map((l) => ({
          value: l.id,
          label: l.name,
          color: l.color,
        })),
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const applySavedView = useCallback(
    (view: SavedView) => {
      query.setFilter(view.filter ?? emptyLeadFilter);
      if (view.sortField) {
        query.setSorts([
          {
            key: view.sortField as LeadSortKey,
            direction: view.sortDir === "asc" ? "asc" : "desc",
          },
        ]);
      }
    },
    [query],
  );

  const columns = useMemo<DashboardTableColumn<LeadListItem>[]>(
    () => [
      {
        key: "number",
        header: t("table.number"),
        sortKey: "number",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/leads/${row.id}`}
              className="font-mono text-sm text-foreground hover:underline"
            >
              {row.number}
            </Link>
            {row.blocked ? (
              <span
                title={t("table.blocked")}
                className="inline-flex items-center rounded-[--radius] bg-destructive px-1.5 py-0.5 text-2xs font-semibold text-destructive-foreground"
              >
                <Prohibit weight="bold" className="h-3 w-3" />
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: "name",
        header: t("table.name"),
        sortKey: "name",
        render: (row) => (
          // Editable in place, the same component the CRM context rail uses, so
          // renaming works identically wherever an operator meets the name.
          // The em dash is the fallback here rather than the number: this table
          // already has a number column beside it, and repeating it would read
          // as two contacts on one row.
          <EditableLeadName
            leadId={row.id}
            name={row.name}
            fallback="—"
            canEdit={canRenameLead}
            onRenamed={(next) =>
              setItems((prev) =>
                prev.map((item) =>
                  item.id === row.id ? { ...item, name: next } : item,
                ),
              )
            }
            className="text-sm text-foreground"
          />
        ),
      },
      {
        key: "campaigns",
        header: t("table.campaigns"),
        sortKey: "campaigns",
        render: (row) => (
          <span className="inline-flex items-center gap-1 text-sm tabular-nums text-foreground">
            <WhatsappLogo weight="fill" className="text-healthy-ink" size={12} />
            {row.whatsappCampaigns}
          </span>
        ),
      },
      {
        key: "memories",
        header: t("table.memories"),
        sortKey: "memories",
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-sm tabular-nums",
              row.memories > 0 ? "text-foreground" : "text-muted-foreground",
            )}
            title={
              row.lastMemoryAt
                ? formatDate(row.lastMemoryAt, locale)
                : undefined
            }
          >
            <Brain weight="fill" className="h-3 w-3 text-info-ink" />
            {row.memories}
          </span>
        ),
      },
      {
        key: "window",
        header: t("table.window"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold",
              row.whatsappWindowOpen
                ? "bg-healthy text-healthy-foreground"
                : "bg-muted text-muted-foreground",
            )}
            title={
              row.whatsappWindowOpen && row.windowExpiresAt
                ? formatDate(row.windowExpiresAt, locale)
                : undefined
            }
          >
            {row.whatsappWindowOpen ? t("window.open") : t("window.closed")}
          </span>
        ),
      },
      {
        key: "lastActivity",
        header: t("table.lastActivity"),
        sortKey: "lastActivityAt",
        render: (row) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.lastActivityAt, locale)}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: t("table.createdAt"),
        sortKey: "createdAt",
        render: (row) => (
          <span className="text-sm text-foreground">
            {formatDate(row.createdAt, locale, false)}
          </span>
        ),
      },
    ],
    [t, locale, canRenameLead],
  );

  const isFiltered = !isEmptyLeadFilter(filter) || search.trim() !== "";

  // Stats read from the facet pass, so they describe the whole filtered set,
  // not the twenty rows that happen to be on screen. They also hold their
  // values while the ROWS reload: paging cannot change them, so blanking them
  // to an ellipsis on every page turn would be reporting a recalculation that
  // is not happening.
  const stats = [
    {
      label: t("summary.total"),
      value: facetsLoading ? "…" : String(facets?.total ?? totalItems),
      icon: <Users className="h-4 w-4 text-info-ink" weight="fill" />,
    },
    {
      label: t("summary.windowOpen"),
      value: facetsLoading ? "…" : String(facets?.windowOpen ?? 0),
      icon: <Clock className="h-4 w-4 text-healthy-ink" weight="fill" />,
    },
    {
      label: t("summary.withMemory"),
      value: facetsLoading ? "…" : String(facets?.withMemory ?? 0),
      icon: <Brain className="h-4 w-4 text-info-ink" weight="fill" />,
    },
    {
      label: t("summary.blocked"),
      value: facetsLoading ? "…" : String(facets?.blocked ?? 0),
      icon: <Prohibit className="h-4 w-4 text-destructive-ink" weight="fill" />,
    },
  ];

  return (
    <main className="w-full space-y-4">
      <div>
        <DashboardPageHeader
          icon={<Users className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.description")}
          actions={
            canImportLeads ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<UploadSimple weight="bold" />}
                iconVisible
                title={t("import.action")}
                onClick={() => setImportOpen(true)}
              />
            ) : undefined
          }
        />
      </div>

      <ImportLeadsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => setReloadKey((key) => key + 1)}
      />

      <div>
        <DashboardTable<LeadListItem>
          stats={stats}
          data={items}
          columns={columns}
          rowKey={(row) => row.id}
          loading={loading}
          sorting={{
            sorts,
            onToggle: (key, opts) =>
              query.toggleSort(key as LeadSortKey, opts),
          }}
          toolbar={
            <LeadsToolbar
              filter={filter}
              onFilterChange={query.setFilter}
              search={search}
              onSearchChange={query.setSearch}
              facets={facets}
              options={options}
              savedViews={
                <LeadSavedViews
                  filter={filter}
                  sorts={sorts}
                  onApply={applySavedView}
                />
              }
            />
          }
          pagination={{
            currentPage: page,
            totalPages,
            pageSize,
            totalItems,
            onPageChange: query.setPage,
            pageSizeOptions: LEAD_PAGE_SIZES,
            onPageSizeChange: query.setPageSize,
          }}
          paginationText={{
            showing: t("records.showing"),
            of: t("records.of"),
            items: t("records.total"),
            perPage: t("records.perPage"),
          }}
          emptyState={
            error
              ? {
                  icon: (
                    <Users className="h-7 w-7 text-destructive-ink" weight="fill" />
                  ),
                  title: t("error.title"),
                  description: error,
                }
              : {
                  icon: (
                    <Users className="h-7 w-7 text-muted-foreground" weight="fill" />
                  ),
                  title: isFiltered
                    ? t("records.emptyFiltered")
                    : t("records.empty"),
                  action: isFiltered ? (
                    <button
                      type="button"
                      onClick={query.clearFilters}
                      className="rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {t("records.clearFilters")}
                    </button>
                  ) : undefined,
                }
          }
        />
      </div>
    </main>
  );
}

export default function LeadsPage() {
  // useSearchParams needs a Suspense boundary; the list is the fallback's
  // subject, so a bare shell is enough to hold the layout while it resolves.
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-[--radius] bg-muted" />}>
      <LeadsPageContent />
    </Suspense>
  );
}
