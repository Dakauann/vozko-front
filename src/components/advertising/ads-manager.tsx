"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  archiveAdObjectAction,
  deleteAdObjectAction,
  disconnectAdAccountAction,
  downloadAdsReportCsvAction,
  getAdLiveInsightsAction,
  getAdsReportAction,
  getAdsTrendAction,
  isAdsError,
  listAdPublishJobsAction,
  setAdObjectOnAction,
  syncAdAccountAction,
  updateAdBudgetAction,
  type AdsResult,
} from "@/app/actions/advertising";
import { getAdsOptionsAction } from "@/app/actions/advertising-create";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { DashboardTable } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, ClockCounterClockwise, MagnifyingGlass, Megaphone, Plus, Plugs, TestTube, Trash, Warning, X } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMetaAdsConnect } from "@/hooks/use-meta-ads-connect";
import { useToast } from "@/hooks/use-toast";
import { canTest } from "@/lib/advertising/ab-test";
import { needsLiveData, nextSort, parseVisibleColumns, sortRows, toggleColumn, DEFAULT_COLUMNS, type MetricColumn, type RowSort, type SortableColumn } from "@/lib/advertising/columns";
import { ADVERTISING_NEW_PATH, ADVERTISING_PATH, COLUMNS_STORAGE_KEY, readStored, writeStored } from "@/lib/advertising/connect";
import { DEFAULT_PRESET, civilToday, rangeForPreset, relativeSince, validRange, type RangePreset } from "@/lib/advertising/date-range";
import { spendBlockerKey } from "@/lib/advertising/delivery";
import { liveById, mergeLiveRows, withLiveResults, type LiveFetch, type ManagerRow } from "@/lib/advertising/live";
import type { AdLevel, AdPublishJob, AdRange, AdReport, AdRow, AdTestLevel, AdTrend, MetaAdsConnectResult } from "@/lib/advertising/types";
import { cn } from "@/lib/utils";

import { AbTestDialog } from "./ab-test-dialog";
import { AbTestsSheet } from "./ab-tests-sheet";
import { AccountNotices } from "./account-notices";
import { AccountPicker } from "./account-picker";
import { AdsColumnsMenu } from "./ads-columns-menu";
import { AdsDateRangePicker } from "./ads-date-range-picker";
import { AdsKpiStrip } from "./ads-kpi-strip";
import { AdsTable } from "./ads-table";
import { AdsTrendChart } from "./ads-trend-chart";
import { BreakdownSheet, type BreakdownRequest } from "./breakdown-sheet";
import { DuplicateDialog } from "./duplicate-dialog";
import { ObjectEditSheet, type PlacementCatalog } from "./edit/object-edit-sheet";
import { PublishJobsSheet } from "./publish-jobs-sheet";
import { DEFAULT_WINDOW, LiveHint, ReportControls, knownWindows, type WindowChoice } from "./report-controls";
import { RowActionsMenu, type RowAction } from "./row-actions-menu";
import { SpendCapControl } from "./spend-cap-control";
import { useAdsFormat } from "./use-ads-format";
import { useAdsResource } from "./wizard/use-ads-resource";

const LEVELS: AdLevel[] = ["campaign", "adset", "ad"];
const SEARCH_DELAY_MS = 350;
const CLOCK_TICK_MS = 30_000;

interface LoadedData {
  key: string;
  reports: Record<AdLevel, AdsResult<AdReport>>;
  trend: AdsResult<AdTrend>;
}

function initialColumns(): MetricColumn[] {
  if (typeof window === "undefined") return [...DEFAULT_COLUMNS];
  return parseVisibleColumns(readStored(COLUMNS_STORAGE_KEY));
}

function sortedIds(ids: Set<string>): string[] {
  return Array.from(ids).sort();
}

function splitIds(key: string): string[] {
  return key ? key.split(",") : [];
}

function budgetError(result: { status?: number; code?: string; error: string }, tooSoon: string): string {
  if (result.status === 429 || /too_soon|budget_change/i.test(result.code ?? "")) return tooSoon;
  return result.error;
}

export function AdsManager() {
  const t = useTranslations("adsManager");
  const { can, permissionsLoading } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const fmt = useAdsFormat();

  const canRead = !permissionsLoading && can("ads", "read");
  const canCreate = !permissionsLoading && can("ads", "create");
  const canUpdate = !permissionsLoading && can("ads", "update");
  const canDelete = !permissionsLoading && can("ads", "delete");
  const permissions = useMemo(
    () => ({
      canStart: !permissionsLoading && can("ads", "start"),
      canStop: !permissionsLoading && can("ads", "stop"),
      canUpdate: !permissionsLoading && can("ads", "update"),
    }),
    [can, permissionsLoading],
  );
  const rowPermissions = useMemo(() => ({ canUpdate, canCreate, canDelete }), [canUpdate, canCreate, canDelete]);

  const accounts = useAdAccounts({ enabled: canRead, requested: searchParams.get("account") });
  const account = accounts.selected;
  const accountId = account?.id ?? null;

  const [now, setNow] = useState(() => new Date());
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET);
  const [custom, setCustom] = useState<AdRange>({ since: "", until: "" });
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, SEARCH_DELAY_MS);
  const [level, setLevel] = useState<AdLevel>("campaign");
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [selectedAdSets, setSelectedAdSets] = useState<Set<string>>(new Set());
  const [selectionAccount, setSelectionAccount] = useState<string | null>(null);
  const [sort, setSort] = useState<RowSort | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<MetricColumn[]>(initialColumns);
  const [attribution, setAttribution] = useState<WindowChoice>(DEFAULT_WINDOW);
  const [comparing, setComparing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<LoadedData | null>(null);
  const [overrides, setOverrides] = useState<Map<string, Partial<AdRow>>>(new Map());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [editing, setEditing] = useState<AdRow | null>(null);
  const [duplicating, setDuplicating] = useState<AdRow | null>(null);
  const [deleting, setDeleting] = useState<AdRow | null>(null);
  const [testObjects, setTestObjects] = useState<{ level: AdTestLevel; rows: AdRow[] } | null>(null);
  const [testsOpen, setTestsOpen] = useState(false);
  const [testsRefresh, setTestsRefresh] = useState(0);
  const [breakdown, setBreakdown] = useState<BreakdownRequest | null>(null);
  const [jobsOpen, setJobsOpen] = useState(() => searchParams.get("jobs") === "1");
  const [jobs, setJobs] = useState<AdPublishJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(() => searchParams.get("jobs") === "1");
  const [jobsError, setJobsError] = useState<string | null>(null);

  if (selectionAccount !== accountId) {
    setSelectionAccount(accountId);
    setSelectedCampaigns(new Set());
    setSelectedAdSets(new Set());
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const options = useAdsResource(canRead ? "ads-options" : null, getAdsOptionsAction);
  const placementCatalog: PlacementCatalog =
    options.status === "ready"
      ? { status: "ready", catalog: options.data.placements ?? {} }
      : options.status === "error"
        ? { status: "error", message: options.message }
        : { status: "loading" };
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
  const presetRange = preset === "custom" ? null : today ? rangeForPreset(preset, today) : null;
  const range: AdRange | null = preset === "custom" ? (validRange(custom) ? custom : null) : presetRange;
  const since = range?.since ?? "";
  const until = range?.until ?? "";
  const campaignKey = sortedIds(selectedCampaigns).join(",");
  const adSetKey = sortedIds(selectedAdSets).join(",");

  const queryKey = JSON.stringify({ accountId, since, until, search, campaignKey, adSetKey, comparing, reloadToken });

  useEffect(() => {
    if (!canRead || !accountId || !since || !until) return;
    let cancelled = false;
    const period = { since, until };
    const term = search.trim() || undefined;
    const campaignIds = splitIds(campaignKey);
    const adSetIds = splitIds(adSetKey);
    Promise.all([
      getAdsReportAction(accountId, { level: "campaign", range: period, search: term, compare: comparing }),
      getAdsReportAction(accountId, { level: "adset", range: period, search: term, campaignIds, compare: comparing }),
      getAdsReportAction(accountId, { level: "ad", range: period, search: term, campaignIds, adSetIds, compare: comparing }),
      getAdsTrendAction(accountId, { range: period, campaignIds, adSetIds }),
    ]).then(([campaign, adset, ad, trend]) => {
      if (cancelled) return;
      setData({ key: queryKey, reports: { campaign, adset, ad }, trend });
      setOverrides(new Map());
    });
    return () => {
      cancelled = true;
    };
  }, [canRead, accountId, since, until, search, campaignKey, adSetKey, comparing, queryKey]);

  const fresh = data !== null && data.key === queryKey;
  const loading = !!range && !fresh;
  const current = fresh ? data.reports[level] : null;
  const report = current && !isAdsError(current) ? current.data : null;
  const reportError = current && isAdsError(current) ? current.error : null;
  const trend = fresh && !isAdsError(data.trend) ? data.trend.data : null;
  const previous = comparing ? (report?.previous ?? null) : null;

  const reportRows = useMemo(() => report?.rows ?? [], [report]);
  const levelRows = (target: AdLevel): AdRow[] => {
    if (!fresh) return [];
    const result = data.reports[target];
    return isAdsError(result) ? [] : (result.data.rows ?? []);
  };

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
      objectIds: splitIds(liveIds),
      windows: windowActive ? [attribution as Exclude<WindowChoice, typeof DEFAULT_WINDOW>] : undefined,
    }),
  );
  const liveStatus: LiveFetch = !wantsLive ? "idle" : live.status === "ready" ? "ready" : live.status === "error" ? "failed" : "loading";
  const liveMap = useMemo(() => (live.status === "ready" ? liveById(live.data.rows) : null), [live]);

  const rows = useMemo<ManagerRow[]>(() => {
    const base = reportRows.map((row) => {
      const patch = overrides.get(row.metaId);
      return patch ? { ...row, ...patch } : row;
    });
    const merged = mergeLiveRows(base, liveMap);
    return sortRows(windowActive ? merged.map(withLiveResults) : merged, sort);
  }, [reportRows, overrides, liveMap, windowActive, sort]);

  const levelCount = (target: AdLevel): number | null => {
    if (!fresh) return null;
    const result = data.reports[target];
    return isAdsError(result) ? null : (result.data.rows ?? []).length;
  };

  const changeColumns = (column: MetricColumn) => {
    setVisibleColumns((visible) => {
      const next = toggleColumn(visible, column);
      writeStored(COLUMNS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const changePreset = (next: RangePreset) => {
    if (next === "custom" && range) setCustom(range);
    setPreset(next);
  };

  const reload = () => setReloadToken((token) => token + 1);

  const syncAccount = () => {
    if (!account) return;
    setSyncing(true);
    void syncAdAccountAction(account.id).then((result) => {
      setSyncing(false);
      if (isAdsError(result)) {
        toast({ title: t("sync.failed"), description: result.error, variant: "destructive" });
        return;
      }
      accounts.replace(result.data);
      reload();
    });
  };

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
          toast({ title: t(on ? "toggle.onFailed" : "toggle.offFailed", { name: row.name }), description: result.error, variant: "destructive" });
          return;
        }
        applyRow(result.data);
      });
    },
    [markPending, patchRow, applyRow, toast, t],
  );

  const saveBudget = useCallback(
    async (row: AdRow, amount: number) => {
      const result = await updateAdBudgetAction(row.metaId, amount);
      if (isAdsError(result)) return budgetError(result, t("budget.tooSoon"));
      patchRow(row.metaId, { dailyBudget: result.data.dailyBudget, lifetimeBudget: result.data.lifetimeBudget });
      toast({ title: t("budget.saved", { name: row.name }) });
      return null;
    },
    [patchRow, toast, t],
  );

  const archiveRow = useCallback(
    (row: AdRow) => {
      markPending(row.metaId, true);
      void archiveAdObjectAction(row.metaId).then((result) => {
        markPending(row.metaId, false);
        if (isAdsError(result)) {
          toast({ title: t("rowActions.archiveFailed", { name: row.name }), description: result.error, variant: "destructive" });
          return;
        }
        applyRow(result.data);
        toast({ title: t("rowActions.archived", { name: row.name }) });
      });
    },
    [markPending, applyRow, toast, t],
  );

  const runRowAction = useCallback(
    (action: RowAction, row: AdRow) => {
      if (action === "edit") setEditing(row);
      if (action === "duplicate") setDuplicating(row);
      if (action === "delete") setDeleting(row);
      if (action === "archive") archiveRow(row);
    },
    [archiveRow],
  );

  const confirmDelete = async () => {
    const target = deleting;
    if (!target) return;
    const result = await deleteAdObjectAction(target.metaId);
    if (isAdsError(result)) {
      toast({ title: t("rowActions.deleteFailed", { name: target.name }), description: result.error, variant: "destructive" });
      throw new Error(result.error);
    }
    setDeleting(null);
    toast({ title: t("rowActions.deleted", { name: target.name }) });
    reload();
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
      campaignIds: level === "campaign" ? undefined : splitIds(campaignKey),
      adSetIds: level === "ad" ? splitIds(adSetKey) : undefined,
      search: search.trim() || undefined,
    }).then((result) => {
      setExporting(false);
      if (isAdsError(result)) toast({ title: t("report.exportFailed"), description: result.error, variant: "destructive" });
    });
  };

  const openBreakdown = (group: string[]) => {
    if (!range) return;
    const selected = level === "campaign" ? selectedCampaigns : level === "adset" ? selectedAdSets : new Set<string>();
    const chosen = rows.filter((row) => selected.has(row.metaId)).map((row) => row.metaId);
    setBreakdown({
      group,
      level,
      range,
      objectIds: chosen.length > 0 ? chosen : rows.map((row) => row.metaId),
      windows: windowActive ? [attribution as Exclude<WindowChoice, typeof DEFAULT_WINDOW>] : [],
      scope: chosen.length > 0 ? "selection" : "all",
    });
  };

  const reportConnect = useCallback(
    (result: MetaAdsConnectResult) => {
      void accounts.reload(accountId);
      if (result.status === "cancelled") return;
      if (result.status === "error") {
        toast({
          title: t("connect.errorTitle"),
          description: t.has(`connect.errors.${result.reason}`) ? t(`connect.errors.${result.reason}`) : t("connect.errors.connect_failed"),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: result.status === "partial" ? t("connect.partialTitle") : t("connect.successTitle"),
        description: [
          result.count !== undefined ? t("connect.count", { count: result.count }) : null,
          result.status === "partial" ? t("connect.errors.linked_elsewhere") : null,
        ]
          .filter(Boolean)
          .join(" "),
      });
    },
    [toast, t, accounts, accountId],
  );

  const { connect, isConnecting } = useMetaAdsConnect(reportConnect);

  const confirmDisconnect = async () => {
    if (!account) return;
    const result = await disconnectAdAccountAction(account.id);
    if (isAdsError(result)) {
      toast({ title: t("disconnect.failed"), description: result.error, variant: "destructive" });
      throw new Error(result.error);
    }
    setDisconnecting(false);
    toast({ title: t("disconnect.done", { name: account.name }) });
    void accounts.reload();
  };

  const openJobs = () => {
    setJobsOpen(true);
    setJobsLoading(true);
    void loadJobs();
  };

  const refreshJobs = () => {
    setJobsLoading(true);
    void loadJobs();
  };

  const changeLevel = (next: string) => {
    if (next === "campaign" || next === "adset" || next === "ad") setLevel(next);
  };

  const blocker = account ? spendBlockerKey(account) : "unknown";
  const blockerText =
    blocker === null
      ? null
      : blocker === "unknown" && account?.spendBlocker
        ? `${t("spendBlocker.unknown")} (${account.spendBlocker})`
        : t(`spendBlocker.${blocker}`);
  const synced = relativeSince(account?.lastSyncedAt, now, fmt.tag);

  const connectButton = canCreate ? (
    <Button
      variant="secondary"
      title={t("header.connect")}
      icon={<Plugs className="h-4 w-4" />}
      iconVisible
      iconSide="left"
      onClick={() => connect(ADVERTISING_PATH)}
      disabled={isConnecting}
    />
  ) : null;

  const createButton =
    canCreate && account ? (
      <TooltipWrapper content={blockerText ?? ""} enabled={!!blockerText}>
        <Button
          variant="primary"
          title={t("header.create")}
          icon={<Plus weight="bold" className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          disabled={!!blockerText}
          onClick={() => router.push(`${ADVERTISING_NEW_PATH}?accountId=${encodeURIComponent(account.id)}`)}
        />
      </TooltipWrapper>
    ) : null;

  const header = (
    <DashboardPageHeader
      badge={t("header.title")}
      description={t("header.description")}
      icon={<Megaphone className="h-6 w-6" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {createButton}
          {connectButton}
          {canRead && account ? (
            <Button
              variant="ghost"
              title={t("abTests.open")}
              icon={<TestTube className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={() => setTestsOpen(true)}
            />
          ) : null}
          {canRead ? (
            <Button
              variant="ghost"
              title={t("jobs.open")}
              icon={<ClockCounterClockwise className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={openJobs}
            />
          ) : null}
        </div>
      }
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

  if (permissionsLoading || (canRead && accounts.loading)) {
    return (
      <div className="w-full space-y-6">
        {header}
        <div className="h-24 animate-pulse rounded-[--radius] bg-muted" />
        <DashboardTable data={[]} columns={[]} rowKey={() => ""} loading />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="w-full space-y-6">
        {header}
        <p className="text-sm text-muted-foreground">{t("noAccess")}</p>
      </div>
    );
  }

  if (accounts.error) {
    return (
      <div className="w-full space-y-6">
        {header}
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
      <div className="w-full space-y-6">
        {header}
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

  const selectionChip = (count: number, onClear: () => void, labelKey: "campaignsSelected" | "adSetsSelected") => (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-control-edge bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t("filters.clear", { label: t(`filters.${labelKey}`, { count }) })}
    >
      <span className="tabular-nums">{t(`filters.${labelKey}`, { count })}</span>
      <X className="h-3 w-3" weight="bold" aria-hidden />
    </button>
  );

  const testButton = (testLevel: AdTestLevel, selected: ManagerRow[]) =>
    canCreate ? (
      <TooltipWrapper content={t("abTest.countHint")} enabled={!canTest(selected.length)}>
        <Button
          variant="secondary"
          size="sm"
          title={t("abTest.create")}
          icon={<TestTube className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          disabled={!canTest(selected.length)}
          onClick={() => setTestObjects({ level: testLevel, rows: selected })}
        />
      </TooltipWrapper>
    ) : null;

  const selection =
    level === "campaign"
      ? { selected: selectedCampaigns, onChange: setSelectedCampaigns, actions: (selected: ManagerRow[]) => testButton("campaign", selected) }
      : level === "adset"
        ? { selected: selectedAdSets, onChange: setSelectedAdSets, actions: (selected: ManagerRow[]) => testButton("adset", selected) }
        : undefined;

  const duplicateParents = duplicating?.level === "adset" ? levelRows("campaign") : duplicating?.level === "ad" ? levelRows("adset") : [];

  return (
    <div className="w-full space-y-4">
      {header}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <AccountPicker accounts={accounts.accounts} value={account.id} onChange={accounts.select} />
            <Button
              variant="ghost"
              title={t("sync.action")}
              icon={<ArrowClockwise className={cn("h-4 w-4", syncing && "animate-spin")} />}
              iconVisible
              iconSide="left"
              onClick={syncAccount}
              disabled={syncing}
            />
            <span className="text-xs text-muted-foreground">{synced ? t("sync.updated", { when: synced }) : t("sync.never")}</span>
            {canDelete ? (
              <button
                type="button"
                onClick={() => setDisconnecting(true)}
                title={t("disconnect.action")}
                aria-label={t("disconnect.action")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <SpendCapControl account={account} canUpdate={canUpdate} onSaved={accounts.replace} />
        </div>
        <AdsDateRangePicker
          preset={preset}
          range={range}
          custom={custom}
          timezone={account.timezone}
          onPresetChange={changePreset}
          onCustomChange={setCustom}
        />
      </div>

      <AccountNotices account={account} canReconnect={canCreate} reconnecting={isConnecting} onReconnect={() => connect(ADVERTISING_PATH)} />

      {!today ? (
        <div className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
          <Warning className="h-4 w-4" />
          {t("errors.timezone")}
        </div>
      ) : null}

      <ReportControls
        windowOptions={windowOptions}
        attribution={attribution}
        onAttribution={setAttribution}
        groups={breakdownGroups}
        onBreakdown={openBreakdown}
        comparing={comparing}
        onCompare={setComparing}
        exporting={exporting}
        onExport={exportCsv}
        optionsReady={options.status === "ready"}
        disabled={!range}
      />
      {windowActive ? <p className="text-xs text-muted-foreground">{t("report.windowNote")}</p> : null}

      <AdsKpiStrip totals={report?.totals ?? null} outcome={report?.outcome ?? null} previous={previous} loading={loading} />

      <AdsTrendChart trend={trend} loading={loading} />

      <div className="overflow-hidden rounded-[--radius] border border-border bg-card shadow-sm">
        <Tabs value={level} onValueChange={changeLevel}>
          <TabsList className="px-3">
            {LEVELS.map((target) => {
              const count = levelCount(target);
              return (
                <TabsTrigger key={target} value={target}>
                  {t(`tabs.${target}`)}
                  {count !== null ? <span className="text-2xs tabular-nums text-muted-foreground">{count}</span> : null}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="w-full max-w-xs">
            <ElevatedInput
              type="search"
              placeholder={t("filters.search")}
              aria-label={t("filters.search")}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
              controlSize="sm"
            />
          </div>
          {level !== "campaign" && selectedCampaigns.size > 0
            ? selectionChip(selectedCampaigns.size, () => setSelectedCampaigns(new Set()), "campaignsSelected")
            : null}
          {level === "ad" && selectedAdSets.size > 0
            ? selectionChip(selectedAdSets.size, () => setSelectedAdSets(new Set()), "adSetsSelected")
            : null}
          <div className="ml-auto flex items-center gap-3">
            <LiveHint status={liveStatus} />
            <AdsColumnsMenu visible={visibleColumns} onToggle={changeColumns} />
          </div>
        </div>

        {reportError ? (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-destructive-ink">
            <Warning className="h-4 w-4" />
            {reportError}
          </div>
        ) : null}

        <AdsTable
          level={level}
          rows={rows}
          totals={report?.totals ?? null}
          outcome={report?.outcome ?? null}
          previous={previous}
          visibleColumns={visibleColumns}
          sort={sort}
          onSort={(key: SortableColumn) => setSort((currentSort) => nextSort(currentSort, key))}
          selection={selection}
          permissions={permissions}
          pending={pending}
          loading={loading}
          emptyState={{
            icon: <Megaphone className="h-7 w-7 text-muted-foreground" />,
            title: t(`empty.${level}Title`),
            description: t("empty.rangeBody"),
          }}
          onToggle={toggleRow}
          onBudget={saveBudget}
          rowActions={(row) => (
            <RowActionsMenu row={row} accountId={account.id} permissions={rowPermissions} busy={pending.has(row.metaId)} onAction={runRowAction} />
          )}
        />
      </div>

      {jobsSheet}

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

      <BreakdownSheet request={breakdown} accountId={account.id} currency={account.currency} onClose={() => setBreakdown(null)} />

      <ObjectEditSheet
        row={editing}
        account={account}
        catalog={placementCatalog}
        canUpdate={canUpdate}
        onClose={() => setEditing(null)}
        onSaved={applyRow}
      />

      <DuplicateDialog row={duplicating} parents={duplicateParents} onClose={() => setDuplicating(null)} onDone={finishDuplicate} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? t(`rowActions.deleteTitle.${deleting.level}`) : ""}
        description={t("rowActions.deleteBody", { name: deleting?.name ?? "" })}
        confirmLabel={t("rowActions.delete")}
        cancelLabel={t("rowActions.cancel")}
        tone="danger"
        onConfirm={confirmDelete}
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
