"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  archiveAdObjectAction,
  deleteAdObjectAction,
  disconnectAdAccountAction,
  downloadAdsReportCsvAction,
  getAdLiveInsightsAction,
  getAdsReportAction,
  isAdsError,
  listAdPublishJobsAction,
  setAdObjectOnAction,
  syncAdAccountAction,
  updateAdBudgetAction,
  updateAdObjectAction,
  type AdsResult,
} from "@/app/actions/advertising";
import { bulkSetAdObjectsOnAction } from "@/app/actions/advertising-bulk";
import { getAdsOptionsAction } from "@/app/actions/advertising-create";
import { deleteAdDraftAction, discardAdDraftsAction, duplicateAdDraftAction, updateAdDraftAction } from "@/app/actions/advertising-drafts";
import { DashboardTable } from "@/components/elevated-design/table/dashboard-table";
import { Megaphone, Plus, Warning } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMetaAdsConnect } from "@/hooks/use-meta-ads-connect";
import { useToast } from "@/hooks/use-toast";
import { bulkFieldsFor, bulkOutcomes, bulkTally, type BulkOutcome } from "@/lib/advertising/manager-bulk";
import {
  needsLiveData,
  nextSort,
  parseVisibleColumns,
  presetColumns,
  sortRows,
  toggleColumn,
  DEFAULT_COLUMNS,
  type ColumnPreset,
  type MetricColumn,
  type RowSort,
  type SortableColumn,
} from "@/lib/advertising/columns";
import { ADVERTISING_PATH, COLUMNS_STORAGE_KEY, draftEditorHref, objectEditorHref, objectsEditorHref, readStored, writeStored } from "@/lib/advertising/connect";
import { DEFAULT_PRESET, civilToday, relativeSince, resolveRange } from "@/lib/advertising/date-range";
import { manageBlockerKey, spendBlockerKey } from "@/lib/advertising/delivery";
import { issuesUnder, withBudgetMinimum } from "@/lib/advertising/issues";
import { liveById, mergeLiveRows, withLiveResults, type LiveFetch } from "@/lib/advertising/live";
import {
  asTableRow,
  draftIdsOf,
  draftRemovals,
  draftTableRows,
  isRenamable,
  parseDraftKey,
  publishedScope,
  renameDraftNode,
  type DraftScope,
  type TableRow,
} from "@/lib/advertising/manager-drafts";
import {
  EMPTY_SELECTION,
  abTestState,
  addChildState,
  archiveState,
  bulkEditState,
  createParentFor,
  createState,
  deleteState,
  duplicateState,
  editState,
  forRow,
  insightsState,
  publishState,
  selectAt,
  switchState,
  type LevelSelection,
  type ToolbarContext,
} from "@/lib/advertising/manager-toolbar";
import { viewFromParams, viewToParams, type ManagerView } from "@/lib/advertising/manager-url";
import { filterRows, type QuickView } from "@/lib/advertising/manager-views";
import { needsStructureRefresh } from "@/lib/advertising/publish";
import type { AdBudgetMinimum, AdLevel, AdPublishJob, AdReport, AdRow, AdTestLevel, MetaAdsConnectResult } from "@/lib/advertising/types";
import { screenPaths } from "@/lib/navigation/routes";

import { AbTestDialog } from "./ab-test-dialog";
import { AbTestsSheet } from "./ab-tests-sheet";
import { AdsColumnsMenu } from "./ads-columns-menu";
import { AdsDateRangePicker, type RangeChoice } from "./ads-date-range-picker";
import { AdsTable } from "./ads-table";
import { BreakdownSheet, type BreakdownRequest } from "./breakdown-sheet";
import { CreateCampaignDialog, type CreateParent } from "./create/create-campaign-dialog";
import { DuplicateDialog } from "./duplicate-dialog";
import { useIssueText } from "./field-issue";
import { useLoadErrorState } from "./load-error-state";
import { BulkEditDialog, type BulkEditRequest } from "./manager/bulk-edit-dialog";
import { InsightsPanel } from "./manager/insights-panel";
import { LevelTabs } from "./manager/level-tabs";
import { ManagerTopBar } from "./manager/manager-top-bar";
import { NameCell } from "./manager/name-cell";
import { PublishReviewDialog } from "./manager/publish-review-dialog";
import { RowHoverActions } from "./manager/row-hover-actions";
import { SelectionToolbar } from "./manager/selection-toolbar";
import { useAdDrafts } from "./manager/use-ad-drafts";
import { useBlockerText } from "./manager/use-blocker-text";
import { ViewsRow } from "./manager/views-row";
import { PublishJobsSheet } from "./publish-jobs-sheet";
import { PublishedNotice } from "./published-notice";
import { ManagerReadinessBanner, useManagerReadinessEmptyState } from "./readiness";
import { DEFAULT_WINDOW, LiveHint, ReportControls, knownWindows, type WindowChoice } from "./report-controls";
import { RowActionsMenu, type RowAction } from "./row-actions-menu";
import { useAdReadiness } from "./use-ad-readiness";
import { useAdsErrorText } from "./use-ads-error";
import { useConnectResultMessage } from "./use-connect-result";
import { useAdsFormat } from "./use-ads-format";
import { useAdsResource } from "./wizard/use-ads-resource";

const SEARCH_DELAY_MS = 350;
const CLOCK_TICK_MS = 30_000;

type LevelReports = Record<AdLevel, AdsResult<AdReport> | null>;

interface LoadedData {
  key: string;
  reports: LevelReports;
}

interface ReviewRequest {
  preselected: string[] | null;
}

function initialColumns(): MetricColumn[] {
  if (typeof window === "undefined") return [...DEFAULT_COLUMNS];
  return parseVisibleColumns(readStored(COLUMNS_STORAGE_KEY));
}

function budgetError(result: { status?: number; code?: string; error: string }, tooSoon: string): string {
  if (result.status === 429 || /too_soon|budget_change/i.test(result.code ?? "")) return tooSoon;
  return result.error;
}

function requestedParent(params: URLSearchParams): CreateParent | undefined {
  const campaignId = params.get("campaignId") || undefined;
  const adSetId = params.get("adSetId") || undefined;
  return campaignId || adSetId ? { campaignId, adSetId } : undefined;
}

export function AdsManager() {
  const t = useTranslations("adsManager");
  const { can, permissionsLoading } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const fmt = useAdsFormat();
  const errorText = useAdsErrorText();
  const issueText = useIssueText("adsManager");
  const loadError = useLoadErrorState();

  const canRead = !permissionsLoading && can("ads", "read");
  const canCreate = !permissionsLoading && can("ads", "create");
  const canUpdate = !permissionsLoading && can("ads", "update");
  const canDelete = !permissionsLoading && can("ads", "delete");
  const canStart = !permissionsLoading && can("ads", "start");
  const canStop = !permissionsLoading && can("ads", "stop");
  const permissions = useMemo(() => ({ canStart, canStop, canUpdate }), [canStart, canStop, canUpdate]);

  const requestedAccount = searchParams.get("account");
  const accounts = useAdAccounts({ enabled: canRead, requested: requestedAccount });
  const account = accounts.selected;
  const accountId = account?.id ?? null;
  const justPublished = searchParams.get("published") === "1";
  const publishedJobId = searchParams.get("job");
  const createRequested = searchParams.get("create") === "1";

  const [now, setNow] = useState(() => new Date());
  const [rangeChoice, setRangeChoice] = useState<RangeChoice>({ preset: DEFAULT_PRESET, custom: { since: "", until: "" }, comparing: false });
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, SEARCH_DELAY_MS);
  const [view, setView] = useState<QuickView>("all");
  const managerView = useMemo(() => viewFromParams(searchParams, accountId), [searchParams, accountId]);
  const { level, selection } = managerView;
  const focusCampaign = selection.campaign.size === 1 ? [...selection.campaign][0] : null;
  const [sort, setSort] = useState<RowSort | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<MetricColumn[]>(initialColumns);
  const [attribution, setAttribution] = useState<WindowChoice>(DEFAULT_WINDOW);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<LoadedData | null>(null);
  const [overrides, setOverrides] = useState<Map<string, Partial<AdRow>>>(new Map());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [duplicating, setDuplicating] = useState<TableRow | null>(null);
  const [deleting, setDeleting] = useState<TableRow[] | null>(null);
  const [bulkRequest, setBulkRequest] = useState<BulkEditRequest | null>(null);
  const [testObjects, setTestObjects] = useState<{ level: AdTestLevel; rows: AdRow[] } | null>(null);
  const [testsOpen, setTestsOpen] = useState(false);
  const [testsRefresh, setTestsRefresh] = useState(0);
  const [breakdown, setBreakdown] = useState<BreakdownRequest | null>(null);
  const [jobsOpen, setJobsOpen] = useState(() => searchParams.get("jobs") === "1");
  const [jobs, setJobs] = useState<AdPublishJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(() => searchParams.get("jobs") === "1");
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [publishedOpen, setPublishedOpen] = useState(justPublished);
  const [creating, setCreating] = useState<{ parent?: CreateParent } | null>(null);
  const [createHandled, setCreateHandled] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewRequest | null>(null);
  const refreshedAfterPublish = useRef(false);

  const showView = useCallback(
    (next: ManagerView, history: "push" | "replace") => {
      const query = viewToParams(new URLSearchParams(window.location.search), next, accountId).toString();
      const url = query ? `${pathname}?${query}` : pathname;
      if (history === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [accountId, pathname],
  );
  const setLevel = (next: AdLevel) => showView({ ...managerView, level: next, panel: null }, "push");
  const setSelection = (next: LevelSelection) => showView({ ...managerView, selection: next }, "replace");

  useEffect(() => {
    if (accountId && requestedAccount !== accountId) showView(managerView, "replace");
  }, [accountId, requestedAccount, managerView, showView]);

  const createKey = createRequested && account && canCreate ? searchParams.toString() : null;
  if (createKey && createHandled !== createKey) {
    setCreateHandled(createKey);
    setCreating({ parent: requestedParent(searchParams) });
  }
  if (!createRequested && createHandled !== null) setCreateHandled(null);

  useEffect(() => {
    if (!createKey || createHandled !== createKey) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("create");
    params.delete("campaignId");
    params.delete("adSetId");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [createKey, createHandled, searchParams, pathname, router]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const drafts = useAdDrafts(accountId, canRead, reload);
  const reloadDrafts = drafts.reload;

  const options = useAdsResource(canRead ? "ads-options" : null, getAdsOptionsAction);
  const windowOptions = options.status === "ready" ? knownWindows(options.data.attributionWindows) : [];
  const breakdownGroups = options.status === "ready" ? (options.data.breakdownGroups ?? []) : [];

  const loadJobs = useCallback(
    () =>
      listAdPublishJobsAction().then((result) => {
        setJobsLoading(false);
        if (isAdsError(result)) {
          setJobsError(result.error);
          return;
        }
        setJobsError(null);
        setJobs(result.data);
      }),
    [],
  );

  useEffect(() => {
    if (!canRead || searchParams.get("jobs") !== "1") return;
    void loadJobs();
  }, [canRead, searchParams, loadJobs]);

  const today = account ? civilToday(account.timezone, now) : null;
  const range = resolveRange(rangeChoice.preset, rangeChoice.custom, today);
  const since = range?.since ?? "";
  const until = range?.until ?? "";
  const comparing = rangeChoice.comparing;
  const scope = publishedScope(selection.campaign, selection.adset);
  const campaignKey = scope.campaignIds.join(",");
  const adSetKey = scope.adSetIds.join(",");
  const { adSetsOutOfScope, adsOutOfScope } = scope;

  const queryKey = JSON.stringify({ accountId, since, until, search, campaignKey, adSetKey, adSetsOutOfScope, adsOutOfScope, comparing, reloadToken });

  useEffect(() => {
    if (!canRead || !accountId || !since || !until) return;
    let cancelled = false;
    const period = { since, until };
    const term = search.trim() || undefined;
    const campaignIds = campaignKey ? campaignKey.split(",") : [];
    const adSetIds = adSetKey ? adSetKey.split(",") : [];
    Promise.all([
      getAdsReportAction(accountId, { level: "campaign", range: period, search: term, compare: comparing }),
      adSetsOutOfScope ? null : getAdsReportAction(accountId, { level: "adset", range: period, search: term, campaignIds, compare: comparing }),
      adsOutOfScope ? null : getAdsReportAction(accountId, { level: "ad", range: period, search: term, campaignIds, adSetIds, compare: comparing }),
    ]).then(([campaign, adset, ad]) => {
      if (cancelled) return;
      setData({ key: queryKey, reports: { campaign, adset, ad } });
      setOverrides(new Map());
    });
    return () => {
      cancelled = true;
    };
  }, [canRead, accountId, since, until, search, campaignKey, adSetKey, adSetsOutOfScope, adsOutOfScope, comparing, queryKey]);

  const fresh = data !== null && data.key === queryKey;
  const loading = !!range && !fresh;
  const current = fresh ? data.reports[level] : null;
  const report = current && !isAdsError(current) ? current.data : null;
  const reportError = current && isAdsError(current) ? errorText(current) : null;
  const previous = comparing ? (report?.previous ?? null) : null;

  const reportRows = useMemo(() => report?.rows ?? [], [report]);
  const levelRows = useCallback(
    (target: AdLevel): AdRow[] => {
      if (!fresh) return [];
      const result = data.reports[target];
      return !result || isAdsError(result) ? [] : (result.data.rows ?? []);
    },
    [fresh, data],
  );

  const windowActive = attribution !== DEFAULT_WINDOW;
  const wantsLive = needsLiveData(visibleColumns) || windowActive;
  const liveIds = reportRows.map((row) => row.metaId).join(",");
  const liveKey =
    wantsLive && accountId && range && fresh && report
      ? JSON.stringify({ accountId, level, since, until, attribution, liveIds, reloadToken })
      : null;
  const live = useAdsResource(liveKey, () =>
    getAdLiveInsightsAction(accountId ?? "", {
      level,
      range: { since, until },
      objectIds: liveIds ? liveIds.split(",") : [],
      windows: windowActive ? [attribution as Exclude<WindowChoice, typeof DEFAULT_WINDOW>] : undefined,
    }),
  );
  const liveStatus: LiveFetch = !wantsLive ? "idle" : live.status === "ready" ? "ready" : live.status === "error" ? "failed" : "loading";
  const liveMap = useMemo(() => (live.status === "ready" ? liveById(live.data.rows) : null), [live]);

  const publishedRows = useMemo<TableRow[]>(() => {
    const base = reportRows.map((row) => {
      const patch = overrides.get(row.metaId);
      return patch ? { ...row, ...patch } : row;
    });
    const merged = mergeLiveRows(base, liveMap);
    return sortRows(windowActive ? merged.map(withLiveResults) : merged, sort).map(asTableRow);
  }, [reportRows, overrides, liveMap, windowActive, sort]);

  const draftScope = useMemo<DraftScope>(
    () => ({
      campaigns: selection.campaign,
      adSets: selection.adset,
      adSetCampaigns: new Map(
        levelRows("adset").flatMap((row) => (row.campaignId ? [[row.metaId, row.campaignId] as [string, string]] : [])),
      ),
    }),
    [selection, levelRows],
  );
  const draftList = drafts.drafts;
  const currency = account?.currency ?? "";
  const draftRowsAt = useCallback(
    (target: AdLevel) => (draftList ? draftTableRows(draftList, target, draftScope, currency) : []),
    [draftList, draftScope, currency],
  );

  const rows = useMemo(() => filterRows([...draftRowsAt(level), ...publishedRows], view, search), [draftRowsAt, level, publishedRows, view, search]);

  const levelCount = (target: AdLevel): number | null => {
    if (!fresh) return null;
    const result = data.reports[target];
    if (result && isAdsError(result)) return null;
    return (result ? (result.data.rows ?? []).length : 0) + draftRowsAt(target).length;
  };

  const changeColumns = (column: MetricColumn) => {
    setVisibleColumns((visible) => {
      const next = toggleColumn(visible, column);
      writeStored(COLUMNS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const choosePreset = (preset: ColumnPreset) => {
    const next = presetColumns(preset);
    writeStored(COLUMNS_STORAGE_KEY, JSON.stringify(next));
    setVisibleColumns(next);
  };

  const replaceAccount = accounts.replace;
  const readiness = useAdReadiness(account, replaceAccount);
  const refreshReadiness = readiness.refresh;
  const readinessEmptyState = useManagerReadinessEmptyState(account, readiness);
  const syncAccount = useCallback(() => {
    if (!accountId) return;
    setSyncing(true);
    void syncAdAccountAction(accountId).then((result) => {
      setSyncing(false);
      if (isAdsError(result)) {
        toast({ title: t("sync.failed"), description: errorText(result), variant: "destructive" });
        return;
      }
      replaceAccount(result.data);
      refreshReadiness();
      reloadDrafts();
      setReloadToken((token) => token + 1);
    });
  }, [accountId, replaceAccount, refreshReadiness, reloadDrafts, toast, t, errorText]);

  const campaignReport = fresh ? data.reports.campaign : null;
  const publishedMissing =
    justPublished &&
    !!campaignReport &&
    !isAdsError(campaignReport) &&
    needsStructureRefresh((campaignReport.data.rows ?? []).map((row) => row.metaId), focusCampaign);

  useEffect(() => {
    if (!publishedMissing || refreshedAfterPublish.current) return;
    refreshedAfterPublish.current = true;
    syncAccount();
  }, [publishedMissing, syncAccount]);

  const patchRow = useCallback((metaId: string, patch: Partial<AdRow> | null) => {
    setOverrides((map) => {
      const next = new Map(map);
      if (patch) next.set(metaId, { ...map.get(metaId), ...patch });
      else next.delete(metaId);
      return next;
    });
  }, []);

  const markPending = useCallback((metaId: string, busy: boolean) => {
    setPending((set) => {
      const next = new Set(set);
      if (busy) next.add(metaId);
      else next.delete(metaId);
      return next;
    });
  }, []);

  const applyRow = useCallback(
    (updated: AdRow) =>
      patchRow(updated.metaId, {
        name: updated.name,
        isOn: updated.isOn,
        status: updated.status,
        effectiveStatus: updated.effectiveStatus,
        delivery: updated.delivery,
        canToggle: updated.canToggle,
        dailyBudget: updated.dailyBudget,
        lifetimeBudget: updated.lifetimeBudget,
        endTime: updated.endTime,
      }),
    [patchRow],
  );

  const toggleRow = useCallback(
    (row: AdRow, on: boolean) => {
      markPending(row.metaId, true);
      patchRow(row.metaId, { isOn: on });
      void setAdObjectOnAction(row.metaId, on).then((result) => {
        markPending(row.metaId, false);
        if (isAdsError(result)) {
          patchRow(row.metaId, null);
          toast({ title: t(on ? "toggle.onFailed" : "toggle.offFailed", { name: row.name }), description: errorText(result), variant: "destructive" });
          return;
        }
        applyRow(result.data);
      });
    },
    [markPending, patchRow, applyRow, toast, t, errorText],
  );

  const saveBudget = useCallback(
    async (row: AdRow, amount: number, minimum: AdBudgetMinimum | null) => {
      const result = await updateAdBudgetAction(row.metaId, amount);
      if (isAdsError(result)) {
        const issues = withBudgetMinimum(issuesUnder(result.expected, "budget"), minimum);
        return issues.length > 0 ? issues.map(issueText).join(" ") : budgetError(result, t("budget.tooSoon"));
      }
      patchRow(row.metaId, { dailyBudget: result.data.dailyBudget, lifetimeBudget: result.data.lifetimeBudget });
      toast({ title: t("budget.saved", { name: row.name }) });
      return null;
    },
    [patchRow, toast, t, issueText],
  );

  const draftsById = useMemo(() => new Map((draftList ?? []).map((draft) => [draft.id, draft])), [draftList]);

  const manageBlocker = account ? manageBlockerKey(account) : "unknown";
  const manageReason = manageBlocker === null ? null : t(`manageBlocker.${manageBlocker}`);
  const blockerText = useBlockerText(manageReason);
  const synced = relativeSince(account?.lastSyncedAt, now, fmt.tag);

  const selectedKeys = selection[level];
  const insightsId = managerView.panel === "insights" && selectedKeys.size === 1 ? [...selectedKeys][0] : null;
  const insightsRow = insightsId ? (publishedRows.find((row) => row.metaId === insightsId) ?? null) : null;
  const insightsChain = {
    campaign: insightsRow && insightsRow.level !== "campaign" ? levelRows("campaign").find((row) => row.metaId === insightsRow.campaignId) : undefined,
    adSet: insightsRow?.level === "ad" ? levelRows("adset").find((row) => row.metaId === insightsRow.adSetId) : undefined,
  };
  const selectedRows = rows.filter((row) => selectedKeys.has(row.metaId));
  const context: ToolbarContext = {
    level,
    selected: selectedRows,
    permissions: { canCreate, canUpdate, canDelete, canStart, canStop },
    manageBlocked: manageBlocker !== null,
    spendBlocked: account ? spendBlockerKey(account) !== null : true,
  };
  const single = (row: TableRow): ToolbarContext => forRow(context, row);

  const openEditor = useCallback(
    (row: TableRow) => {
      if (!account) return;
      if (row.draft) router.push(draftEditorHref(row.draft.draftId));
      else router.push(objectEditorHref(account.id, row.metaId));
    },
    [account, router],
  );

  const openCreate = (parent?: CreateParent) => setCreating({ parent });

  const openReview = (preselected: string[] | null) => setReview({ preselected });

  const openJobs = () => {
    setJobsOpen(true);
    setJobsLoading(true);
    void loadJobs();
  };

  const refreshJobs = () => {
    setJobsLoading(true);
    void loadJobs();
  };

  const archiveRow = (row: TableRow) => {
    markPending(row.metaId, true);
    void archiveAdObjectAction(row.metaId).then((result) => {
      markPending(row.metaId, false);
      if (isAdsError(result)) {
        toast({ title: t("rowActions.archiveFailed", { name: row.name }), description: errorText(result), variant: "destructive" });
        return;
      }
      applyRow(result.data);
      toast({ title: t("rowActions.archived", { name: row.name }) });
    });
  };

  const duplicate = (row: TableRow) => {
    if (!row.draft) {
      setDuplicating(row);
      return;
    }
    markPending(row.metaId, true);
    void duplicateAdDraftAction(row.draft.draftId, `${row.name}${t("duplicate.defaultSuffix")}`).then((result) => {
      markPending(row.metaId, false);
      if (isAdsError(result)) {
        toast({ title: t("duplicate.draftFailed", { name: row.name }), description: errorText(result), variant: "destructive" });
        return;
      }
      toast({ title: t("duplicate.done", { name: row.name }) });
      reloadDrafts();
    });
  };

  const openInsights = (target: AdLevel, nextSelection: LevelSelection) =>
    showView({ level: target, selection: nextSelection, panel: "insights" }, "push");

  const runRowAction = (action: RowAction, row: TableRow) => {
    switch (action) {
      case "insights":
        if (insightsState(single(row)).enabled) openInsights(row.level, selectAt(selection, row.level, new Set([row.metaId])));
        return;
      case "edit":
        if (editState(single(row)).enabled) openEditor(row);
        return;
      case "duplicate":
        if (duplicateState(single(row)).enabled) duplicate(row);
        return;
      case "delete":
        if (deleteState(single(row)).enabled) setDeleting([row]);
        return;
      case "archive":
        if (archiveState(single(row)).enabled) archiveRow(row);
        return;
      case "addChild":
        if (addChildState(single(row)).enabled) openCreate(row.level === "campaign" ? { campaignId: row.metaId } : { adSetId: row.metaId });
        return;
      case "publish":
        if (row.draft && publishState(single(row)).enabled) openReview([row.draft.draftId]);
        return;
      case "jobs":
        openJobs();
        return;
    }
  };

  const openRow = (row: TableRow) => {
    if (row.draft || row.level === "ad") {
      if (editState(single(row)).enabled) openEditor(row);
      return;
    }
    if (row.level === "campaign") {
      showView({ level: "adset", selection: selectAt(EMPTY_SELECTION, "campaign", new Set([row.metaId])), panel: null }, "push");
      return;
    }
    showView({ level: "ad", selection: selectAt(selection, "adset", new Set([row.metaId])), panel: null }, "push");
  };

  const canRenameRow = (row: TableRow): boolean => {
    if (!editState(single(row)).enabled) return false;
    if (!row.draft) return true;
    const parsed = parseDraftKey(row.metaId);
    const draft = draftsById.get(row.draft.draftId);
    return !!parsed && !!draft && isRenamable(draft.draft, parsed.node);
  };

  const renameRow = async (row: TableRow, name: string): Promise<string | null> => {
    if (row.draft) {
      const parsed = parseDraftKey(row.metaId);
      const draft = draftsById.get(row.draft.draftId);
      const content = parsed && draft ? renameDraftNode(draft.draft, parsed.node, name) : null;
      if (!draft || !content) return t("rename.notAllowed");
      const result = await updateAdDraftAction(draft.id, content, draft.version);
      reloadDrafts();
      return isAdsError(result) ? errorText(result) : null;
    }
    const result = await updateAdObjectAction(row.metaId, { name });
    if (isAdsError(result)) return errorText(result);
    applyRow(result.data);
    return null;
  };

  const outcomeToast = (outcomes: BulkOutcome[], names: Map<string, string>, doneKey: "switched" | "deleted") => {
    const tally = bulkTally(outcomes);
    const failures = outcomes
      .filter((outcome) => !outcome.ok)
      .map((outcome) => `${names.get(outcome.metaId) ?? outcome.metaId}: ${outcome.message ?? t("bulk.noAnswer")}`);
    toast({
      title: t(`bulk.${doneKey}`, tally),
      description: failures.length > 0 ? failures.join("; ") : undefined,
      variant: tally.failed > 0 ? "destructive" : undefined,
    });
  };

  const applyOutcomes = (outcomes: BulkOutcome[]) => {
    for (const outcome of outcomes) if (outcome.ok && outcome.object) applyRow(outcome.object);
  };

  const switchSelected = (on: boolean) => {
    if (!switchState(context, on).enabled) return;
    const targets = selectedRows;
    const ids = targets.map((row) => row.metaId);
    ids.forEach((id) => markPending(id, true));
    void bulkSetAdObjectsOnAction(ids, on).then((result) => {
      ids.forEach((id) => markPending(id, false));
      const names = new Map(targets.map((row) => [row.metaId, row.name]));
      if (isAdsError(result)) {
        toast({ title: t(on ? "bulk.activateFailed" : "bulk.pauseFailed"), description: errorText(result), variant: "destructive" });
        return;
      }
      const outcomes = bulkOutcomes(ids, result.data.results ?? []);
      applyOutcomes(outcomes);
      outcomeToast(outcomes, names, "switched");
    });
  };

  const confirmDelete = async () => {
    const targets = deleting ?? [];
    const names = new Map(targets.map((row) => [row.metaId, row.name]));
    const outcomes: BulkOutcome[] = [];
    for (const row of targets.filter((target) => !target.draft)) {
      const result = await deleteAdObjectAction(row.metaId);
      outcomes.push({ metaId: row.metaId, ok: !isAdsError(result), object: undefined, message: isAdsError(result) ? errorText(result) : null });
    }
    const draftKeys = targets.filter((target) => target.draft).map((target) => target.metaId);
    for (const removal of draftRemovals(draftList ?? [], draftKeys)) {
      const result =
        removal.kind === "draft"
          ? await deleteAdDraftAction(removal.draftId)
          : await updateAdDraftAction(removal.draftId, removal.content, removal.version);
      const label = draftKeys.find((key) => parseDraftKey(key)?.draftId === removal.draftId) ?? removal.draftId;
      outcomes.push({ metaId: label, ok: !isAdsError(result), object: undefined, message: isAdsError(result) ? errorText(result) : null });
    }
    const tally = bulkTally(outcomes);
    if (tally.ok === 0 && tally.failed > 0) {
      outcomeToast(outcomes, names, "deleted");
      throw new Error(outcomes[0]?.message ?? "");
    }
    setDeleting(null);
    setSelection(selectAt(selection, level, new Set()));
    outcomeToast(outcomes, names, "deleted");
    reload();
    reloadDrafts();
  };

  const confirmDiscard = async () => {
    if (!accountId) return;
    const result = await discardAdDraftsAction(accountId);
    if (isAdsError(result)) {
      toast({ title: t("drafts.discardFailed"), description: errorText(result), variant: "destructive" });
      throw new Error(result.error);
    }
    setDiscarding(false);
    setSelection(EMPTY_SELECTION);
    toast({ title: t("drafts.discarded", { count: result.data.discarded }) });
    reloadDrafts();
  };

  const finishDuplicate = (row: AdRow) => {
    setDuplicating(null);
    toast({ title: t("duplicate.done", { name: row.name }) });
    reload();
  };

  const exportCsv = () => {
    if (!account || !range) return;
    setExporting(true);
    void downloadAdsReportCsvAction(account.id, {
      level,
      range,
      campaignIds: level === "campaign" ? undefined : scope.campaignIds,
      adSetIds: level === "ad" ? scope.adSetIds : undefined,
      search: search.trim() || undefined,
    }).then((result) => {
      setExporting(false);
      if (isAdsError(result)) toast({ title: t("report.exportFailed"), description: errorText(result), variant: "destructive" });
    });
  };

  const openBreakdown = (group: string[]) => {
    if (!range) return;
    const published = rows.filter((row) => !row.draft);
    const chosen = published.filter((row) => selectedKeys.has(row.metaId)).map((row) => row.metaId);
    setBreakdown({
      group,
      level,
      range,
      objectIds: chosen.length > 0 ? chosen : published.map((row) => row.metaId),
      windows: windowActive ? [attribution as Exclude<WindowChoice, typeof DEFAULT_WINDOW>] : [],
      scope: chosen.length > 0 ? "selection" : "all",
    });
  };

  const connectMessage = useConnectResultMessage();
  const reportConnect = useCallback(
    (result: MetaAdsConnectResult) => {
      void accounts.reload(accountId);
      const message = connectMessage(result);
      if (message) toast({ title: message.title, description: message.description, variant: message.failed ? "destructive" : undefined });
    },
    [toast, connectMessage, accounts, accountId],
  );

  const { connect, isConnecting } = useMetaAdsConnect(reportConnect);

  const confirmDisconnect = async () => {
    if (!account) return;
    const result = await disconnectAdAccountAction(account.id);
    if (isAdsError(result)) {
      toast({ title: t("disconnect.failed"), description: errorText(result), variant: "destructive" });
      throw new Error(result.error);
    }
    setDisconnecting(false);
    toast({ title: t("disconnect.done", { name: account.name }) });
    void accounts.reload();
  };

  const draftsBlocker = !canCreate ? blockerText({ enabled: false, reason: "permission" }) : null;
  const topBar = (
    <ManagerTopBar
      level={level}
      accounts={accounts.accounts}
      account={account}
      onSelectAccount={accounts.select}
      synced={synced}
      syncing={syncing}
      onSync={account ? syncAccount : null}
      drafts={
        account
          ? {
              count: drafts.objectCount,
              blocker: draftsBlocker,
              onDiscard: () => setDiscarding(true),
              onReview: () => openReview(null),
            }
          : null
      }
      menu={{
        canConnect: canCreate,
        connecting: isConnecting,
        onConnect: () => connect(ADVERTISING_PATH),
        canDisconnect: canDelete,
        onDisconnect: () => setDisconnecting(true),
        onJobs: openJobs,
        onTests: account ? () => setTestsOpen(true) : null,
      }}
    />
  );

  const jobsSheet = (
    <PublishJobsSheet
      open={jobsOpen}
      onOpenChange={setJobsOpen}
      jobs={jobs}
      loading={jobsLoading}
      error={jobsError}
      accounts={accounts.accounts}
      onRefresh={refreshJobs}
    />
  );

  const connectButton = canCreate ? (
    <Button variant="secondary" title={t("header.connect")} onClick={() => connect(ADVERTISING_PATH)} disabled={isConnecting} />
  ) : null;

  if (permissionsLoading || (canRead && accounts.loading)) {
    return (
      <div className="w-full space-y-4">
        {topBar}
        <DashboardTable data={[]} columns={[]} rowKey={() => ""} loading />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="w-full space-y-4">
        {topBar}
        <p className="text-sm text-muted-foreground">{t("noAccess")}</p>
      </div>
    );
  }

  if (accounts.error) {
    return (
      <div className="w-full space-y-4">
        {topBar}
        <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" />
          {accounts.error}
          <button type="button" onClick={() => void accounts.reload()} className="ml-auto font-semibold text-primary-ink hover:underline">
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="w-full space-y-4">
        {topBar}
        <DashboardTable
          data={[]}
          columns={[]}
          rowKey={() => ""}
          emptyState={{
            icon: <Megaphone className="h-7 w-7 text-muted-foreground" />,
            title: t("empty.noAccountTitle"),
            description: canCreate ? t("empty.noAccountBody") : t("empty.noAccountBodyNoPermission"),
            action: connectButton ? <div className="mt-2">{connectButton}</div> : undefined,
          }}
        />
        {jobsSheet}
      </div>
    );
  }

  const createAction = createState(context);
  const createButton = createAction.enabled ? (
    <Button variant="primary" title={t("toolbar.create")} icon={<Plus weight="bold" className="h-4 w-4" />} iconVisible iconSide="left" onClick={() => openCreate()} />
  ) : null;

  const firstCampaign = level === "campaign" && !search.trim() && view === "all" && !!report && rows.length === 0;
  const tableEmptyState = reportError
    ? loadError(reportError, reload)
    : firstCampaign
      ? (readinessEmptyState ?? {
          icon: <Megaphone className="h-7 w-7 text-muted-foreground" />,
          title: t("empty.firstTitle"),
          description: canCreate ? t("empty.firstBody") : t("empty.firstBodyReadOnly"),
          action: createButton ? <div className="mt-2">{createButton}</div> : undefined,
        })
      : {
          icon: <Megaphone className="h-7 w-7 text-muted-foreground" />,
          title: t(`empty.${level}Title`),
          description: view === "all" ? t("empty.rangeBody") : t("empty.viewBody"),
        };

  const duplicateParents = duplicating?.level === "adset" ? levelRows("campaign") : duplicating?.level === "ad" ? levelRows("adset") : [];
  const campaignNames = new Map(levelRows("campaign").map((row) => [row.metaId, row.name]));
  const selectedDrafts = selectedRows.some((row) => row.draft);
  const totalsShown = view === "all";

  return (
    <div className="w-full space-y-4">
      {topBar}

      {publishedOpen ? (
        <PublishedNotice
          account={account}
          canCreate={canCreate}
          jobId={publishedJobId}
          onSwitchedOn={() => {
            setPublishedOpen(false);
            toast({ title: t("published.switchedOn") });
            reload();
          }}
          onDismiss={() => setPublishedOpen(false)}
        />
      ) : null}

      {report && !firstCampaign ? <ManagerReadinessBanner account={account} state={readiness} /> : null}

      {!today ? (
        <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" />
          {t("errors.timezone")}
        </div>
      ) : null}

      {drafts.error ? (
        <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-warning-ink" role="status">
          <Warning className="h-4 w-4" />
          {t("drafts.loadFailed", { message: drafts.error })}
          <button type="button" onClick={reloadDrafts} className="ml-auto font-semibold text-primary-ink hover:underline">
            {t("retry")}
          </button>
        </div>
      ) : null}

      <ViewsRow view={view} onView={setView} search={searchInput} onSearch={setSearchInput} />

      <div className="overflow-hidden rounded-[--radius] border border-border bg-card shadow-sm">
        <LevelTabs
          level={level}
          onLevel={setLevel}
          selected={{ campaign: selection.campaign.size, adset: selection.adset.size, ad: selection.ad.size }}
          counts={{ campaign: levelCount("campaign"), adset: levelCount("adset"), ad: levelCount("ad") }}
          onClear={(target) => setSelection(selectAt(selection, target, new Set()))}
          aside={<AdsDateRangePicker value={rangeChoice} today={today} timezone={account.timezone} onApply={setRangeChoice} />}
        />

        <SelectionToolbar
          states={{
            create: createAction,
            publish: publishState(context),
            duplicate: duplicateState(context),
            edit: editState(context),
            bulkEdit: bulkEditState(context),
            activate: switchState(context, true),
            pause: switchState(context, false),
            remove: deleteState(context),
            abTest: level === "ad" ? null : abTestState(context),
          }}
          handlers={{
            onCreate: () => openCreate(createParentFor(level, selection)),
            onPublish: () => {
              if (publishState(context).enabled) openReview(draftIdsOf(selectedKeys));
            },
            onDuplicate: () => {
              if (duplicateState(context).enabled) duplicate(selectedRows[0]);
            },
            onEdit: () => {
              if (!account || !editState(context).enabled) return;
              if (selectedRows.length > 1) router.push(objectsEditorHref(account.id, selectedRows.map((row) => row.metaId)));
              else openEditor(selectedRows[0]);
            },
            onBulkEdit: (field, mode) => {
              if (bulkEditState(context).enabled) setBulkRequest({ field, mode, rows: selectedRows });
            },
            onSwitch: switchSelected,
            onDelete: () => {
              if (deleteState(context).enabled) setDeleting(selectedRows);
            },
            onAbTest: () => {
              if (level !== "ad" && abTestState(context).enabled) setTestObjects({ level, rows: selectedRows });
            },
            onExport: exportCsv,
          }}
          hasSelection={selectedRows.length > 0}
          showPublish={selectedDrafts}
          bulkFields={bulkFieldsFor(level)}
          rulesHref={screenPaths.ads_rules}
          exportDisabled={exporting || !range}
          blockerText={blockerText}
          aside={
            <>
              <LiveHint status={liveStatus} />
              <AdsColumnsMenu visible={visibleColumns} onToggle={changeColumns} onPreset={choosePreset} />
              <ReportControls
                windowOptions={windowOptions}
                attribution={attribution}
                onAttribution={setAttribution}
                groups={breakdownGroups}
                onBreakdown={openBreakdown}
                exporting={exporting}
                onExport={exportCsv}
                optionsReady={options.status === "ready"}
                disabled={!range}
              />
            </>
          }
        />
        {windowActive ? <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{t("report.windowNote")}</p> : null}

        <AdsTable
          account={account}
          level={level}
          rows={rows}
          totals={totalsShown ? (report?.totals ?? null) : null}
          outcome={totalsShown ? (report?.outcome ?? null) : null}
          previous={previous}
          visibleColumns={visibleColumns}
          sort={sort}
          onSort={(key: SortableColumn) => setSort((currentSort) => nextSort(currentSort, key))}
          selection={{ selected: new Set(selectedKeys), onChange: (keys) => setSelection(selectAt(selection, level, keys)) }}
          permissions={permissions}
          pending={pending}
          loading={loading}
          emptyState={tableEmptyState}
          onToggle={toggleRow}
          onBudget={saveBudget}
          renderName={(row) => (
            <NameCell
              row={row}
              openable={row.draft || row.level === "ad" ? editState(single(row)).enabled : true}
              onOpen={() => openRow(row)}
              canRename={canRenameRow(row)}
              onRename={(name) => renameRow(row, name)}
              actions={
                <RowHoverActions
                  row={row}
                  context={context}
                  blockerText={blockerText}
                  onAction={runRowAction}
                  menu={
                    <RowActionsMenu
                      row={row}
                      accountId={account.id}
                      context={context}
                      busy={pending.has(row.metaId)}
                      blockerText={blockerText}
                      onAction={runRowAction}
                    />
                  }
                />
              }
            />
          )}
        />
      </div>

      {jobsSheet}

      <InsightsPanel
        account={account}
        row={insightsRow}
        chain={insightsChain}
        range={range}
        permissions={permissions}
        busy={!!insightsRow && pending.has(insightsRow.metaId)}
        onToggle={toggleRow}
        onBudget={saveBudget}
        onOpen={(target, metaId) =>
          openInsights(
            target,
            target === "campaign"
              ? selectAt(EMPTY_SELECTION, "campaign", new Set([metaId]))
              : selectAt(selectAt(EMPTY_SELECTION, "campaign", selection.campaign), "adset", new Set([metaId])),
          )
        }
        onShowAdSets={(campaignId) => showView({ level: "adset", selection: selectAt(EMPTY_SELECTION, "campaign", new Set([campaignId])), panel: null }, "push")}
        onClose={() => showView({ ...managerView, panel: null }, "push")}
      />

      <AbTestsSheet open={testsOpen} accountId={account.id} refreshKey={testsRefresh} onOpenChange={setTestsOpen} />

      <AbTestDialog
        open={!!testObjects}
        level={testObjects?.level ?? "campaign"}
        objects={testObjects?.rows ?? []}
        account={account}
        onClose={() => setTestObjects(null)}
        onCreated={(name) => {
          setTestObjects(null);
          setTestsRefresh((value) => value + 1);
          toast({ title: t("abTest.created", { name }) });
        }}
      />

      <BreakdownSheet request={breakdown} accountId={account.id} onClose={() => setBreakdown(null)} />

      <DuplicateDialog row={duplicating} parents={duplicateParents} onClose={() => setDuplicating(null)} onDone={finishDuplicate} />

      <BulkEditDialog
        request={bulkRequest}
        level={level}
        onClose={() => setBulkRequest(null)}
        onApplied={(outcomes) => {
          applyOutcomes(outcomes);
          if (outcomes.some((outcome) => outcome.ok && !outcome.object)) reload();
        }}
      />

      <PublishReviewDialog
        open={!!review}
        drafts={draftList ?? []}
        preselected={review?.preselected ?? null}
        account={account}
        readiness={readiness}
        canCreate={canCreate}
        canPublish={canCreate && manageBlocker === null}
        campaignNames={campaignNames}
        onClose={() => setReview(null)}
        onPublished={() => {
          reloadDrafts();
          reload();
        }}
      />

      <CreateCampaignDialog
        open={!!creating}
        onOpenChange={(open) => {
          if (open) return;
          setCreating(null);
          reloadDrafts();
        }}
        accounts={accounts.accounts}
        accountId={account.id}
        initialParent={creating?.parent}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting && deleting.length === 1 ? t(`rowActions.deleteTitle.${deleting[0].level}`) : t("rowActions.deleteManyTitle", { count: deleting?.length ?? 0 })}
        description={
          deleting && deleting.length === 1
            ? deleting[0].draft
              ? t("rowActions.deleteDraftBody", { name: deleting[0].name })
              : t("rowActions.deleteBody", { name: deleting[0].name })
            : t("rowActions.deleteManyBody", { count: deleting?.length ?? 0 })
        }
        confirmLabel={t("rowActions.delete")}
        cancelLabel={t("rowActions.cancel")}
        tone="danger"
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t("drafts.discardTitle")}
        description={t("drafts.discardBody", { count: drafts.objectCount ?? 0 })}
        confirmLabel={t("topBar.discard")}
        cancelLabel={t("rowActions.cancel")}
        tone="danger"
        onConfirm={confirmDiscard}
      />

      <ConfirmDialog
        open={disconnecting}
        onOpenChange={setDisconnecting}
        title={t("disconnect.title")}
        description={t("disconnect.body", { name: account.name })}
        confirmLabel={t("disconnect.action")}
        cancelLabel={t("rowActions.cancel")}
        tone="danger"
        onConfirm={confirmDisconnect}
      />
    </div>
  );
}
