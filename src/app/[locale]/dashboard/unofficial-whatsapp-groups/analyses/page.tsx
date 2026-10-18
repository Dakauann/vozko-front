"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter as useNextRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { deleteGroupAnalysisAction, listGroupAnalysesAction, updateGroupAnalysisAction } from "@/app/actions/unofficial-whatsapp-groups";
import { Skeleton } from "@/components/audience/shared";
import { StatusRail } from "@/components/console/page-shapes";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedSelect, { ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, Brain, Pause, Play, Plus, Trash } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Notice } from "@/components/ui/notice";
import { AnalysisFormSheet } from "@/components/unofficial-whatsapp-groups/analyses/analysis-form-sheet";
import {
  ANALYSES_PAGE_SIZES,
  ANALYSIS_SORTS,
  ANALYSIS_STATUSES,
  ANALYSIS_TRIGGERS,
  analysesListSearch,
  countParams,
  DEFAULT_ANALYSIS_SORT,
  hasFilters,
  listParams,
  pageAfterRemoval,
  parseAnalysesListState,
  type AnalysesListState,
} from "@/components/unofficial-whatsapp-groups/analyses/analyses-query";
import { NextCycle, RowAction } from "@/components/unofficial-whatsapp-groups/analyses/analysis-parts";
import { useFollowedGroups } from "@/components/unofficial-whatsapp-groups/analyses/use-followed-groups";
import { useTableEmpty } from "@/components/unofficial-whatsapp-groups/kit/empty";
import { AnalysisStatusMark, TriggerSummary } from "@/components/unofficial-whatsapp-groups/kit/figures";
import { ActiveFilterChips, CountChip, SearchField, WindowToggle, type ActiveFilter } from "@/components/unofficial-whatsapp-groups/kit/filters";
import { RelativeTime } from "@/components/unofficial-whatsapp-groups/kit/relative-time";
import { groupsRoutes } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupName, useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import { useWorkspace } from "@/contexts/workspace-context";
import { Link, useRouter } from "@/i18n/routing";
import type { AnalysisSort, AnalysisStatus, AnalysisTrigger, GroupAnalysisRow, PageMeta } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

const ALL = "all";
const EMPTY_META: PageMeta = { page: 1, pageSize: 0, totalPages: 0, totalItems: 0 };

type StatusCounts = Record<AnalysisStatus, number>;

interface LoadedCounts {
  key: string;
  filtersKey: string;
  counts: StatusCounts;
}

interface LoadedPage {
  key: string;
  query: string;
  rows: GroupAnalysisRow[];
  meta: PageMeta;
  error: string | null;
}

export default function GroupAnalysesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <AnalysesList />
    </Suspense>
  );
}

function AnalysesList() {
  const t = useTranslations("unofficialGroups.analyses");
  const tl = useTranslations("unofficialGroups.analyses.listPage");
  const router = useRouter();
  const navigation = useNextRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = useWorkspace();
  const canConfigure = can("unofficial_whatsapp_groups", "configure");
  const canDelete = can("unofficial_whatsapp_groups", "delete");
  const tableEmpty = useTableEmpty();
  const groupName = useGroupName();
  const fmt = useGroupsFormat();

  const paramsText = searchParams.toString();
  const state = useMemo(() => parseAnalysesListState(new URLSearchParams(paramsText)), [paramsText]);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [counts, setCounts] = useState<LoadedCounts | null>(null);
  const [countsFault, setCountsFault] = useState<{ key: string; error: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(() => searchParams.get("action") === "create");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GroupAnalysisRow | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const handledAction = useRef(false);
  const loadedRef = useRef<LoadedPage | null>(null);
  const countsRef = useRef<LoadedCounts | null>(null);
  const followed = useFollowedGroups(groupSearch);

  const replaceState = useCallback(
    (next: AnalysesListState) => {
      const query = analysesListSearch(next);
      navigation.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [navigation, pathname],
  );
  const patch = useCallback((changes: Partial<AnalysesListState>) => replaceState({ ...state, page: 1, ...changes }), [replaceState, state]);

  const filtersKey = JSON.stringify({ search: state.search, trigger: state.trigger ?? null, groupId: state.groupId ?? null });
  const query = analysesListSearch(state);
  const requestKey = `${query}#${refreshNonce}`;
  const countsKey = `${filtersKey}#${refreshNonce}`;

  useEffect(() => {
    let cancelled = false;
    void listGroupAnalysesAction(listParams(state)).then((result) => {
      if (cancelled) return;
      const previous = loadedRef.current;
      const next =
        result.error && previous && !previous.error && previous.query === query
          ? { ...previous, key: requestKey }
          : { key: requestKey, query, rows: result.items, meta: result.meta, error: result.error ?? null };
      if (next !== previous && result.error && next.error === null) toast.error(tl("reloadFailed"), { description: result.error });
      loadedRef.current = next;
      setLoaded(next);
    });
    return () => {
      cancelled = true;
    };
  }, [state, requestKey, query, tl]);

  const countState = useMemo<AnalysesListState>(
    () => ({ search: state.search, trigger: state.trigger, groupId: state.groupId, sort: DEFAULT_ANALYSIS_SORT, page: 1, pageSize: 1 }),
    [state.search, state.trigger, state.groupId],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all(ANALYSIS_STATUSES.map((status) => listGroupAnalysesAction(countParams(countState, status)))).then((results) => {
      if (cancelled) return;
      const failure = results.find((result) => result.error)?.error;
      if (failure) {
        if (countsRef.current?.filtersKey === filtersKey) toast.error(tl("countsFailed"), { description: failure });
        else setCountsFault({ key: countsKey, error: failure });
        return;
      }
      const next = {} as StatusCounts;
      ANALYSIS_STATUSES.forEach((status, index) => {
        next[status] = results[index].meta.totalItems;
      });
      countsRef.current = { key: countsKey, filtersKey, counts: next };
      setCounts(countsRef.current);
      setCountsFault(null);
    });
    return () => {
      cancelled = true;
    };
  }, [countsKey, countState, filtersKey, tl]);

  useEffect(() => {
    if (handledAction.current || searchParams.get("action") !== "create") return;
    handledAction.current = true;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("action");
    const query = params.toString();
    navigation.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, navigation, pathname]);

  const loading = loaded?.key !== requestKey;
  const rows = useMemo(() => loaded?.rows ?? [], [loaded]);
  const meta = loaded?.meta ?? EMPTY_META;
  const error = loaded?.error ?? null;
  const refresh = useCallback(() => setRefreshNonce((value) => value + 1), []);
  const multiPage = meta.totalPages > 1;
  const filtered = hasFilters(state);
  const noun = useCallback((count: number) => tl("countNoun", { count }), [tl]);

  const toggleStatus = useCallback(
    async (row: GroupAnalysisRow) => {
      const status = row.status === "active" ? "paused" : "active";
      setBusyId(row.id);
      const result = await updateGroupAnalysisAction(row.id, { status });
      setBusyId(null);
      if (result.error) {
        toast.error(t("toggleFailed"), { description: result.error });
        return;
      }
      toast(status === "active" ? t("resumed") : t("paused"), { description: row.name });
      refresh();
    },
    [refresh, t],
  );

  const confirmDelete = useCallback(async () => {
    const row = pendingDelete;
    if (!row) return false;
    const result = await deleteGroupAnalysisAction(row.id);
    if (result.error) {
      toast.error(tl("deleteFailed"), { description: result.error });
      return false;
    }
    toast(tl("deleted"), { description: row.name });
    const page = pageAfterRemoval(state.page, rows.length);
    if (page !== state.page) replaceState({ ...state, page });
    refresh();
    return true;
  }, [pendingDelete, refresh, replaceState, rows.length, state, tl]);

  const open = useCallback((row: GroupAnalysisRow) => router.push(groupsRoutes.analysis(row.id)), [router]);

  const columns = useMemo<DashboardTableColumn<GroupAnalysisRow>[]>(
    () => [
      {
        key: "name",
        header: tl("columns.analysis"),
        render: (row) => (
          <div className="min-w-0 max-w-[28rem] py-0.5">
            <Link
              href={groupsRoutes.analysis(row.id)}
              aria-label={tl("openAria", { name: row.name })}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => {
                if (event.key === " ") {
                  event.preventDefault();
                  open(row);
                }
              }}
              className="block truncate rounded-sm text-xs font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {row.name}
            </Link>
            {row.prompt ? <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{row.prompt}</p> : null}
            <p className="readout mt-0.5 text-[11px] text-muted-foreground">{tl("createdOn", { date: fmt.date(row.createdAt) })}</p>
          </div>
        ),
      },
      {
        key: "group",
        header: tl("columns.group"),
        render: (row) => (
          <Link
            href={groupsRoutes.group(row.groupId, { tab: "analysis" })}
            onClick={(event) => event.stopPropagation()}
            className="block max-w-[14rem] truncate rounded-sm text-xs text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={groupName(row.groupSubject)}
          >
            {groupName(row.groupSubject)}
          </Link>
        ),
      },
      { key: "status", header: tl("columns.status"), render: (row) => <AnalysisStatusMark analysis={row} /> },
      {
        key: "trigger",
        header: tl("columns.trigger"),
        render: (row) => (
          <span className="text-xs text-foreground">
            <TriggerSummary analysis={row} withBatch />
          </span>
        ),
      },
      { key: "nextCycle", header: tl("columns.nextCycle"), render: (row) => <NextCycle analysis={row} /> },
      {
        key: "cycles",
        header: tl("columns.cycles"),
        className: "text-right",
        render: (row) => <span className="readout text-xs tabular-nums text-foreground">{fmt.num(row.runs)}</span>,
      },
      { key: "lastCycle", header: tl("columns.lastCycle"), render: (row) => <RelativeTime at={row.lastRunAt} className="readout whitespace-nowrap text-xs tabular-nums" /> },
    ],
    [fmt, groupName, open, tl],
  );

  const renderRowActions = useCallback(
    (row: GroupAnalysisRow) =>
      canConfigure || canDelete ? (
        <div className="flex items-center gap-1">
          {canConfigure ? (
            <RowAction
              label={row.status === "active" ? tl("rowPause") : tl("rowResume")}
              icon={row.status === "active" ? <Pause className="h-3.5 w-3.5" weight="bold" /> : <Play className="h-3.5 w-3.5" weight="bold" />}
              disabled={busyId === row.id}
              onClick={() => void toggleStatus(row)}
            />
          ) : null}
          {canDelete ? (
            <RowAction
              label={tl("rowDelete")}
              ariaLabel={tl("deleteAria", { name: row.name })}
              icon={<Trash className="h-3.5 w-3.5" weight="bold" />}
              iconOnly
              onClick={() => setPendingDelete(row)}
            />
          ) : null}
        </div>
      ) : null,
    [busyId, canConfigure, canDelete, tl, toggleStatus],
  );

  const groupOptions = useMemo(() => {
    const options = followed.groups.map((group) => ({ value: group.id, label: groupName(group.subject) }));
    if (state.groupId && !options.some((option) => option.value === state.groupId)) {
      const subject = rows.find((row) => row.groupId === state.groupId)?.groupSubject;
      options.unshift({ value: state.groupId, label: subject ? groupName(subject) : tl("selectedGroup") });
    }
    return [{ value: ALL, label: tl("allGroups") }, ...options];
  }, [followed.groups, groupName, rows, state.groupId, tl]);

  const selectedGroupLabel = groupOptions.find((option) => option.value === state.groupId)?.label ?? tl("selectedGroup");
  const sortLabel = (sort: AnalysisSort) => tl(`sorts.${sort}`);

  const activeFilters: ActiveFilter[] = [
    ...(state.search ? [{ key: "search", label: tl("chips.search", { value: state.search }), onClear: () => patch({ search: "" }) }] : []),
    ...(state.status ? [{ key: "status", label: tl("chips.status", { label: tl(`rail.${state.status}`) }), onClear: () => patch({ status: undefined }) }] : []),
    ...(state.trigger ? [{ key: "trigger", label: tl("chips.trigger", { label: tl(`triggers.${state.trigger}`) }), onClear: () => patch({ trigger: undefined }) }] : []),
    ...(state.groupId ? [{ key: "group", label: tl("chips.group", { label: selectedGroupLabel }), onClear: () => patch({ groupId: undefined }) }] : []),
    ...(state.sort !== DEFAULT_ANALYSIS_SORT ? [{ key: "sort", label: tl("chips.sort", { label: sortLabel(state.sort) }), onClear: () => patch({ sort: DEFAULT_ANALYSIS_SORT }) }] : []),
  ];
  const clearFilters = () => replaceState({ search: "", sort: DEFAULT_ANALYSIS_SORT, page: 1, pageSize: state.pageSize });

  const pausedByFailures = rows.filter((row) => row.pausedReason === "repeated_failures").length;
  const pendingTotal = rows.reduce((sum, row) => sum + Math.max(0, row.pendingMessages), 0);
  const pageScoped = (label: string) => (multiPage ? tl("onPage", { label }) : label);
  const statusCounts = counts?.filtersKey === filtersKey ? counts.counts : null;
  const countsFailure = !statusCounts && countsFault?.key === countsKey ? countsFault.error : null;
  const tableLoading = loading && (!loaded || loaded.query !== query || Boolean(loaded.error));
  const noFollowedGroups = !followed.loading && !followed.error && !groupSearch.trim() && followed.totalItems === 0;

  const createButton = canConfigure ? (
    <Button variant="primary" title={t("create")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => setSheetOpen(true)} />
  ) : null;

  return (
    <div className="w-full space-y-4">
      <DashboardPageHeader
        icon={<Brain className="h-6 w-6" />}
        badge={tl("title")}
        description={t("list.description")}
        meta={<CountChip count={meta.totalItems} noun={noun} filtered={Boolean(state.status)} loading={tableLoading || Boolean(error)} />}
        actions={
          <>
            <Button
              variant="outline-subtle"
              size="icon"
              icon={<ArrowClockwise className={cn("h-4 w-4", loading && "animate-spin")} weight="bold" />}
              iconVisible
              aria-label={tl("refresh")}
              disabled={loading}
              onClick={refresh}
            />
            {createButton}
          </>
        }
      />

      {statusCounts ? (
        <StatusRail
          allLabel={tl("rail.all")}
          activeKey={state.status ?? null}
          onSelect={(key) => patch({ status: (key as AnalysisStatus | null) ?? undefined })}
          segments={ANALYSIS_STATUSES.map((status) => ({ key: status, label: tl(`rail.${status}`), count: statusCounts[status] }))}
        />
      ) : countsFailure ? (
        <Notice tone="fault" title={tl("countsFault")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">{countsFailure}</p>
            <Button variant="secondary" size="sm" title={t("retry")} onClick={refresh} />
          </div>
        </Notice>
      ) : (
        <Skeleton className="h-[54px]" />
      )}

      <DashboardTable<GroupAnalysisRow>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={tableLoading}
        onRowClick={open}
        renderRowActions={canConfigure || canDelete ? renderRowActions : undefined}
        stats={[
          { label: pageScoped(tl("stats.pausedByFailures")), value: fmt.num(pausedByFailures) },
          { label: pageScoped(tl("stats.pending")), value: fmt.num(pendingTotal) },
        ]}
        headerLeft={
          <SearchField
            value={state.search}
            onChange={(value) => patch({ search: value })}
            placeholder={tl("searchPlaceholder")}
            ariaLabel={tl("searchPlaceholder")}
            className="w-full sm:w-72"
          />
        }
        toolbar={
          <div className="flex w-full flex-col gap-2.5">
            <div className="flex w-full flex-wrap items-center gap-3">
              <WindowToggle<string>
                ariaLabel={tl("triggerFilter")}
                value={state.trigger ?? ALL}
                options={[
                  { value: ALL, label: tl("triggers.all") },
                  ...ANALYSIS_TRIGGERS.map((trigger) => ({ value: trigger, label: tl(`triggers.${trigger}`) })),
                ]}
                onChange={(value) => patch({ trigger: value === ALL ? undefined : (value as AnalysisTrigger) })}
              />
              <div className="w-full sm:w-60">
                <ElevatedCommandSelect
                  label={tl("groupFilter")}
                  options={groupOptions}
                  value={state.groupId ?? ALL}
                  onValueChange={(value) => patch({ groupId: value === ALL ? undefined : value })}
                  onSearch={setGroupSearch}
                  onOpenChange={(isOpen) => {
                    if (!isOpen) setGroupSearch("");
                  }}
                  isLoading={followed.loading}
                  searchPlaceholder={tl("groupSearch")}
                  emptyMessage={tl("groupEmpty")}
                />
              </div>
              <div className="w-full sm:ml-auto sm:w-48">
                <ElevatedSelect label={tl("sort")} value={state.sort} onValueChange={(value) => patch({ sort: value as AnalysisSort })}>
                  {ANALYSIS_SORTS.map((sort) => (
                    <ElevatedSelectItem key={sort} value={sort}>
                      {sortLabel(sort)}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
              </div>
            </div>
            <ActiveFilterChips filters={activeFilters} onClearAll={clearFilters} resultLabel={loading || error ? undefined : noun(meta.totalItems)} />
          </div>
        }
        pagination={
          meta.totalItems > 0
            ? {
                currentPage: state.page,
                totalPages: Math.max(1, meta.totalPages),
                pageSize: state.pageSize,
                totalItems: meta.totalItems,
                onPageChange: (page) => replaceState({ ...state, page }),
                pageSizeOptions: ANALYSES_PAGE_SIZES,
                onPageSizeChange: (pageSize) => replaceState({ ...state, page: 1, pageSize }),
              }
            : undefined
        }
        emptyState={
          error
            ? tableEmpty.error(t("list.errorTitle"), refresh)
            : filtered
              ? tableEmpty.noMatches(tl("noun"), clearFilters)
              : tableEmpty.firstUse({
                  icon: <Brain className="h-7 w-7 text-muted-foreground" />,
                  title: tl("emptyTitle"),
                  description: t("list.emptyDescription"),
                  action: noFollowedGroups ? (
                    <Link
                      href={groupsRoutes.all({ followed: false })}
                      className="rounded-sm text-xs font-semibold text-foreground underline underline-offset-2 hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {tl("followFirst")}
                    </Link>
                  ) : (
                    (createButton ?? undefined)
                  ),
                })
        }
      />

      {canConfigure ? <AnalysisFormSheet open={sheetOpen} onOpenChange={setSheetOpen} presetGroupId={state.groupId} onSaved={(analysis) => router.push(groupsRoutes.analysis(analysis.id))} /> : null}
      {canDelete ? (
        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) setPendingDelete(null);
          }}
          tone="danger"
          title={tl("deleteTitle")}
          description={tl("deleteBody")}
          confirmLabel={tl("rowDelete")}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
