"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Clock, Prohibit, Users, WhatsappLogo } from "@/components/icons";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
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

  const [items, setItems] = useState<LeadListItem[]>([]);
  const [facets, setFacets] = useState<LeadFacets | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const params = { filter, q: search, sorts, page, pageSize };

      // The rows and their counts describe the same set, so they are asked at
      // the same moment with the same question.
      const [list, facetResult] = await Promise.all([
        listLeadsQueryAction(params),
        getLeadFacetsAction(params),
      ]);
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

      setFacets(facetResult.error ? null : facetResult.facets);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, search, sortKey, page, pageSize]);

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
                className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-2xs font-semibold text-destructive-ink"
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
          <span className="text-sm text-foreground">{row.name || "—"}</span>
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
    [t, locale],
  );

  const isFiltered = !isEmptyLeadFilter(filter) || search.trim() !== "";

  // Stats read from the facet pass, so they describe the whole filtered set —
  // not the twenty rows that happen to be on screen.
  const stats = [
    {
      label: t("summary.total"),
      value: loading ? "…" : String(facets?.total ?? totalItems),
      icon: <Users className="h-4 w-4 text-info-ink" weight="fill" />,
    },
    {
      label: t("summary.windowOpen"),
      value: loading ? "…" : String(facets?.windowOpen ?? 0),
      icon: <Clock className="h-4 w-4 text-healthy-ink" weight="fill" />,
    },
    {
      label: t("summary.withMemory"),
      value: loading ? "…" : String(facets?.withMemory ?? 0),
      icon: <Brain className="h-4 w-4 text-info-ink" weight="fill" />,
    },
    {
      label: t("summary.blocked"),
      value: loading ? "…" : String(facets?.blocked ?? 0),
      icon: <Prohibit className="h-4 w-4 text-destructive-ink" weight="fill" />,
    },
  ];

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full space-y-4"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <DashboardPageHeader
          icon={<Users className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.description")}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
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
      </motion.div>
    </motion.main>
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
