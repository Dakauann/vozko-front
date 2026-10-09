"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlass, Users } from "@/components/icons";
import { useTranslations } from "next-intl";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardTable } from "@/components/elevated-design/table/dashboard-table";
import { ScreenLoader } from "@/components/brand/screen-loader";
import CustomFieldManager from "@/components/crm/CustomFieldManager";
import { LeadColumnsMenu } from "@/components/leads/LeadColumnsMenu";
import { LeadRowActions } from "@/components/leads/LeadRowActions";
import { LeadSheet } from "@/components/leads/sheet/LeadSheet";
import { useLeadColumns, isLeadOptionalColumn, rowsNeedMemberDirectory, type LeadOptionalColumn } from "@/components/leads/use-lead-columns";
import {
  LEADS_LIVE_AGGREGATES_INTERVAL_MS,
  createQuietReloadGate,
  useLeadsLiveRefetch,
} from "@/components/leads/use-leads-live-refetch";
import ImportLeadsDialog from "./_components/ImportLeadsDialog";
import { LeadImportsStatus } from "@/components/leads/imports/LeadImportsStatus";
import { downloadLeadImportTemplate } from "@/lib/leads/template";
import LeadSavedViews from "./_components/LeadSavedViews";
import { LeadsToolbar } from "@/components/leads/LeadsToolbar";
import { LeadStatsStrip } from "@/components/leads/LeadStatsStrip";
import { LeadsHeaderActions } from "@/components/leads/LeadsHeaderActions";
import { LeadsMapView } from "@/components/leads/map/LeadsMapView";
import { useLeadAreas } from "@/hooks/use-lead-map";
import { useLeadSection } from "@/hooks/use-lead-section";
import { LEAD_MAP_VIEW_PARAMS, LEAD_VIEWS, defaultLeadView, leadMapsKey, leadViewOf, type LeadView } from "@/lib/leads/map-view";
import { useLeadBulk } from "@/components/leads/bulk/use-lead-bulk";
import { usePublishLeadsAssistantContext } from "@/components/leads/use-leads-assistant-context";
import { RetryNotice } from "@/components/elevated-design/retry-notice";
import { effectiveLeadFilter } from "@/lib/leads/bulk-selection";
import { isRefusedFilter, listRefusedFilter } from "@/lib/aichat/leads-context";
import { readableFields } from "@/lib/crm/custom-fields";
import { listLeadsQueryAction } from "@/app/actions/leads";
import { useLeadPresentation } from "@/hooks/use-lead-presentation";
import { useMayPlaceCalls } from "@/hooks/use-call-readiness";
import { useListQueryState } from "@/hooks/use-list-query-state";
import { usePermissionVerdict } from "@/hooks/use-settled-permission";
import type { SavedView } from "@/lib/crm/saved-views";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { isEmptyLeadFilter } from "@/lib/leads/filters";
import { leadSectionsKey } from "@/lib/leads/sections";
import { savedViewState } from "@/lib/leads/saved-view";
import { leadNameLines } from "@/lib/leads/display";
import {
  LEAD_PAGE_SIZES,
  LEAD_SORT_KEYS,
  type LeadListItem,
  type LeadSortKey,
} from "@/lib/leads/types";
import { useWorkspace } from "@/contexts/workspace-context";

const DEFAULT_SORTS = [{ key: "createdAt" as LeadSortKey, direction: "desc" as const }];
const NO_SORTS: typeof DEFAULT_SORTS = [];

type SheetTarget = { mode: "closed" } | { mode: "new" } | { mode: "edit"; leadId: string };

function LeadsPageContent() {
  const t = useTranslations("leadsPage");
  const addressVerdict = usePermissionVerdict("leads", "read_addresses");
  const readsAddresses = addressVerdict === true;

  const query = useListQueryState<LeadSortKey, LeadView>({
    sortKeys: LEAD_SORT_KEYS,
    defaultSorts: DEFAULT_SORTS,
    defaultPageSize: 20,
    pageSizes: LEAD_PAGE_SIZES,
    views: LEAD_VIEWS,
    defaultView: defaultLeadView(addressVerdict),
    viewScopedParams: LEAD_MAP_VIEW_PARAMS,
  });

  const { can, currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const canEditLead = can("leads", "update");
  const mayPlaceCalls = useMayPlaceCalls();
  const canCreateLead = can("leads", "create");
  const canManageFields = can("leads", "configure");
  const leadAreas = useLeadAreas({ enabled: readsAddresses });
  const view = leadViewOf(query.viewChosen ? query.view : undefined, addressVerdict);
  const [importDialog, setImportDialog] = useState<{ open: boolean; jobId: string | null }>({ open: false, jobId: null });
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetTarget>({ mode: "closed" });
  const [optionalColumns, setOptionalColumns] = useState<ReadonlySet<LeadOptionalColumn>>(new Set());

  const [reloadKey, setReloadKey] = useState(0);
  const [items, setItems] = useState<LeadListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refusedFilter, setRefusedFilter] = useState<string | null>(null);

  const { fields: fieldDefinitions, classification, ownerName } = useLeadPresentation(true, {
    directory: rowsNeedMemberDirectory(items),
  });

  const { filter, search, sorts, page, pageSize } = query;
  const listSorts = search !== "" && !query.sortsChosen ? NO_SORTS : sorts;

  const filterKey = JSON.stringify(filter);
  const sortKey = listSorts.map((s) => `${s.key}:${s.direction}`).join(",");
  const listRequest = `${filterKey}|${search}|${sortKey}|${page}|${pageSize}`;
  const [quietReload] = useState(createQuietReloadGate);

  useEffect(() => {
    if (view !== "table") return;
    let cancelled = false;
    const quiet = quietReload.quiet(listRequest);

    (async () => {
      if (!quiet) setLoading(true);
      const requested = effectiveLeadFilter(filter, search);
      const list = await listLeadsQueryAction({
        filter: requested,
        sorts: listSorts,
        page,
        pageSize,
      });
      if (cancelled) return;
      setRefusedFilter(listRefusedFilter(requested, list.errorCode));

      if (list.error) {
        setError(codedErrorMessage(t, { code: list.errorCode ?? undefined }, list.error));
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
  }, [filterKey, search, sortKey, page, pageSize, reloadKey, view]);

  const applySavedView = useCallback(
    (saved: SavedView) => {
      const state = savedViewState(saved, LEAD_SORT_KEYS, isLeadOptionalColumn);
      query.setFilterAndSorts(state.filter, state.sort ? [state.sort] : undefined);
      setOptionalColumns(new Set(state.columns));
    },
    [query],
  );

  const toggleOptionalColumn = useCallback((column: LeadOptionalColumn) => {
    setOptionalColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }, []);

  const columns = useLeadColumns({ optional: optionalColumns, classification, ownerName });

  const workspaceId = currentWorkspace?.id ?? "";
  const refetchAggregates = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: leadSectionsKey(workspaceId) });
    void queryClient.invalidateQueries({ queryKey: leadMapsKey(workspaceId) });
  }, [queryClient, workspaceId]);
  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
    refetchAggregates();
  }, [refetchAggregates]);
  const refetchListQuietly = useCallback(() => {
    quietReload.markLive();
    setReloadKey((key) => key + 1);
  }, [quietReload]);
  useLeadsLiveRefetch(refetchListQuietly, { enabled: view === "table" });
  useLeadsLiveRefetch(refetchAggregates, { intervalMs: LEADS_LIVE_AGGREGATES_INTERVAL_MS });

  const isFiltered = !isEmptyLeadFilter(filter) || search.trim() !== "";
  const mapSummary = useLeadSection("summary", { filter, q: search }, { enabled: view === "map" && search !== "" });
  const resultCount = view === "map" ? mapSummary.data?.total ?? null : view === "table" && !loading && !error ? totalItems : null;
  const pickPlace = useCallback((next: typeof filter) => query.setFilterAndSearch(next, ""), [query]);

  const editableFields = useMemo(() => readableFields(fieldDefinitions.definitions), [fieldDefinitions.definitions]);
  const bulk = useLeadBulk({
    filter,
    search,
    sorts,
    filterInvalid: query.filterInvalid,
    fields: editableFields,
    classificationKey: classification?.key,
    onSettled: reload,
  });
  usePublishLeadsAssistantContext({
    filter,
    search,
    filterInvalid: query.filterInvalid,
    filterRejected: isRefusedFilter(refusedFilter, filter, search),
    selected: bulk.selection.size,
  });
  const pageKeys = useMemo(() => items.map((item) => item.id), [items]);

  const openImport = useCallback(() => setImportDialog({ open: true, jobId: null }), []);

  const headerActions =
    canCreateLead || canManageFields || readsAddresses ? (
      <LeadsHeaderActions
        view={view ?? defaultLeadView(addressVerdict)}
        showViewToggle={readsAddresses}
        onViewChange={query.setView}
        canCreate={canCreateLead}
        canManageFields={canManageFields}
        imports={
          <LeadImportsStatus
            onOpen={(jobId) => setImportDialog({ open: true, jobId })}
            onImported={reload}
            visibleJobId={importDialog.open ? importDialog.jobId : null}
          />
        }
        onCreate={() => setSheet({ mode: "new" })}
        onImport={openImport}
        onDownloadTemplate={downloadLeadImportTemplate}
        onManageFields={() => setFieldsOpen(true)}
      />
    ) : undefined;

  const leadsToolbar = (
    <LeadsToolbar
      filter={filter}
      onFilterChange={query.setFilter}
      search={search}
      onSearchChange={query.setSearch}
      onPickPlace={pickPlace}
      resultCount={resultCount}
      countFacets
      areas={leadAreas.data}
      savedViews={
        <>
          <LeadSavedViews
            filter={filter}
            sorts={sorts}
            columns={[...optionalColumns]}
            onApply={applySavedView}
          />
          {view === "table" ? <LeadColumnsMenu shown={optionalColumns} onToggle={toggleOptionalColumn} /> : null}
        </>
      }
    />
  );

  return (
    <main className="w-full space-y-4">
      <div>
        <DashboardPageHeader
          layout="inline"
          icon={<Users className="h-6 w-6" weight="fill" />}
          badge={t("header.badge")}
          description={t("header.description")}
          actions={headerActions}
        />
      </div>

      <ImportLeadsDialog
        open={importDialog.open}
        onOpenChange={(open) => setImportDialog((current) => ({ ...current, open }))}
        jobId={importDialog.jobId}
        onJobIdChange={(jobId) => setImportDialog((current) => ({ ...current, jobId }))}
      />

      <LeadSheet
        open={sheet.mode !== "closed"}
        onOpenChange={(open) => {
          if (!open) setSheet({ mode: "closed" });
        }}
        leadId={sheet.mode === "edit" ? sheet.leadId : null}
        onSaved={reload}
        onManageFields={canManageFields ? () => setFieldsOpen(true) : undefined}
      />

      {bulk.dialog}

      {canManageFields ? (
        <CustomFieldManager
          objectType="lead"
          open={fieldsOpen}
          onOpenChange={setFieldsOpen}
          onChanged={() => {
            void fieldDefinitions.reload();
            reload();
          }}
        />
      ) : null}

      <div>
        <DashboardTable<LeadListItem>
          body={
            view === null ? (
              <div className="flex min-h-[520px] w-full items-center justify-center">
                <ScreenLoader fit="fill" />
              </div>
            ) : view === "map" ? (
              <LeadsMapView
                filter={filter}
                search={search}
                onFilterChange={query.setFilter}
                onShowTable={(shown) => query.setView("table", shown)}
                areas={leadAreas.data ?? []}
                picks={bulk.mapPicks}
                onPicksChange={bulk.onMapPicksChange}
                selectionBar={bulk.mapBar}
                classification={classification}
                fields={fieldDefinitions.definitions}
                canCreateLead={canCreateLead}
                onImport={openImport}
                onCreateLead={() => setSheet({ mode: "new" })}
              />
            ) : undefined
          }
          headerLeft={
            <LeadStatsStrip
              filter={filter}
              search={search}
              onFilterChange={query.setFilter}
            />
          }
          data={items}
          columns={columns}
          rowKey={(row) => row.id}
          loading={loading}
          selection={view === "table" ? bulk.tableSelection(pageKeys, totalItems) : undefined}
          renderRowActions={
            canEditLead || mayPlaceCalls
              ? (row) => (
                  <LeadRowActions
                    leadId={row.id}
                    revision={row.version}
                    label={leadNameLines(row).title}
                    onEdit={canEditLead ? () => setSheet({ mode: "edit", leadId: row.id }) : undefined}
                  />
                )
              : undefined
          }
          sorting={{
            sorts: listSorts,
            onToggle: (key, opts) =>
              query.toggleSort(key as LeadSortKey, opts),
          }}
          toolbar={
            <>
              {leadsToolbar}
              {query.filterInvalid ? (
                <RetryNotice
                  className="basis-full text-xs text-warning-ink"
                  message={t("selection.invalidFilter")}
                  retryLabel={t("records.clearFilters")}
                  onRetry={query.clearFilters}
                />
              ) : null}
            </>
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
              : search !== ""
                ? {
                    icon: (
                      <MagnifyingGlass className="h-7 w-7 text-muted-foreground" weight="bold" />
                    ),
                    title: t("search.emptyTitle", { query: search }),
                    description: t("search.emptyHint"),
                    action: (
                      <button
                        type="button"
                        onClick={() => query.setSearch("")}
                        className="rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        {t("search.clear")}
                      </button>
                    ),
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
                  ) : canCreateLead ? (
                    <button
                      type="button"
                      onClick={() => setSheet({ mode: "new" })}
                      className="rounded-[--radius] border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {t("header.newLead")}
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
  return (
    <Suspense fallback={<div className="h-64 w-full animate-pulse rounded-[--radius] bg-muted" />}>
      <LeadsPageContent />
    </Suspense>
  );
}
