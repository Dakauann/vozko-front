"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  discoverGroupsAction,
  exportGroupMembersAction,
  followGroupAction,
  listGroupCategoriesAction,
  listWorkspaceGroupsAction,
  unfollowGroupAction,
} from "@/app/actions/unofficial-whatsapp-groups";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { DashboardTable, type DashboardTableSorting } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, Bell, BellSlash, CircleNotch, DownloadSimple, MagnifyingGlass, Plus, SignIn, UsersThree } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { AnalysisFormSheet } from "@/components/unofficial-whatsapp-groups/analyses/analysis-form-sheet";
import { CreateGroupSheet } from "@/components/unofficial-whatsapp-groups/create-group-sheet";
import { JoinGroupSheet } from "@/components/unofficial-whatsapp-groups/join-group-sheet";
import { JoinsPanel } from "@/components/unofficial-whatsapp-groups/joins-panel";
import { StartCampaignButton } from "@/components/unofficial-whatsapp-groups/kit/campaign";
import { useTableEmpty } from "@/components/unofficial-whatsapp-groups/kit/empty";
import { CountChip, SearchField } from "@/components/unofficial-whatsapp-groups/kit/filters";
import { MarkDot } from "@/components/unofficial-whatsapp-groups/kit/kpi-band";
import { groupsRoutes, parseAllGroupsQuery, type AllGroupsQuery } from "@/components/unofficial-whatsapp-groups/kit/routes";
import { useGroupsFormat } from "@/components/unofficial-whatsapp-groups/kit/use-groups-format";
import { useGroupColumns } from "@/components/unofficial-whatsapp-groups/list/group-columns";
import { GroupRowMenu } from "@/components/unofficial-whatsapp-groups/list/group-row-menu";
import { GroupsToolbar } from "@/components/unofficial-whatsapp-groups/list/groups-toolbar";
import { clearedQuery, isNarrowed, isSearchedOrNarrowed, listParams } from "@/components/unofficial-whatsapp-groups/list/list-query";
import { numberLabel, useWorkspaceNumbers } from "@/components/unofficial-whatsapp-groups/use-workspace-numbers";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRouter } from "@/i18n/routing";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  columnSort,
  keepSelectedRows,
  listStats,
  maxMessages,
  pageWithinTotal,
  parsePageSize,
  sortRows,
  toggleClientSort,
  toggleServerSort,
  type ClientSort,
  type ClientSortColumn,
} from "@/lib/unofficial-whatsapp-groups/group-list";
import type { GroupRow, PageMeta } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

const CLIENT_SORT_COLUMNS: readonly ClientSortColumn[] = ["net", "messages", "analysis", "numbers", "lastActivity"];

const EMPTY_META: PageMeta = { page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 0, totalItems: 0 };

interface Loaded {
  key: string;
  rows: GroupRow[];
  meta: PageMeta;
  error: string | null;
}

function isClientColumn(key: string): key is ClientSortColumn {
  return (CLIENT_SORT_COLUMNS as readonly string[]).includes(key);
}

export default function UnofficialWhatsAppGroupsListPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <GroupsList />
    </Suspense>
  );
}

function GroupsList() {
  const t = useTranslations("unofficialGroups.list");
  const fmt = useGroupsFormat();
  const tableEmpty = useTableEmpty();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can, permissionsLoading } = useWorkspace();
  const canCreate = can("unofficial_whatsapp_groups", "create");
  const canUpdate = can("unofficial_whatsapp_groups", "update");
  const canExport = can("unofficial_whatsapp_groups", "export");
  const canConfigure = can("unofficial_whatsapp_groups", "configure");
  const canCampaign = can("unofficial_whatsapp_campaigns", "create");

  const query = useMemo(() => parseAllGroupsQuery(new URLSearchParams(searchParams.toString())), [searchParams]);
  const { action: pendingAction, ...filters } = query;
  const filterKey = JSON.stringify(filters);

  const { numbers } = useWorkspaceNumbers();
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;
  const [refreshKey, setRefreshKey] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesKey, setCategoriesKey] = useState(0);
  const [joinsSignal, setJoinsSignal] = useState(0);
  const [clientSort, setClientSort] = useState<ClientSort | null>(null);
  const [selectedRows, setSelectedRows] = useState<Map<string, GroupRow>>(new Map());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"follow" | "unfollow" | "export" | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [analysisGroupId, setAnalysisGroupId] = useState<string | null>(null);
  const [handledAction, setHandledAction] = useState<string | null>(null);
  const [discoverQueued, setDiscoverQueued] = useState(false);

  if (!pendingAction && handledAction !== null) setHandledAction(null);
  if (pendingAction && pendingAction !== handledAction && !permissionsLoading) {
    setHandledAction(pendingAction);
    if (pendingAction === "join" && canCreate) setJoinOpen(true);
    if (pendingAction === "create" && canCreate) setCreateOpen(true);
    if (pendingAction === "discover" && canUpdate) setDiscoverQueued(true);
  }

  const paramsKey = JSON.stringify(listParams(filters, page, pageSize));
  const requestKey = `${paramsKey}#${refreshKey}`;
  const loading = loaded?.key !== requestKey;
  const shownParams = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listWorkspaceGroupsAction(JSON.parse(paramsKey)).then((result) => {
      if (cancelled) return;
      if (result.error && shownParams.current === paramsKey) {
        toast.error(t("reloadFailed"), { description: result.error });
        setLoaded((previous) => (previous ? { ...previous, key: requestKey } : previous));
        return;
      }
      shownParams.current = result.error ? null : paramsKey;
      setLoaded({ key: requestKey, rows: result.error ? [] : result.items, meta: result.error ? EMPTY_META : result.meta, error: result.error ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [paramsKey, requestKey, t]);

  useEffect(() => {
    let cancelled = false;
    void listGroupCategoriesAction().then((result) => {
      if (!cancelled && !result.error) setCategories(result.categories);
    });
    return () => {
      cancelled = true;
    };
  }, [categoriesKey]);

  const rows = useMemo(() => loaded?.rows ?? [], [loaded]);
  const meta = loaded?.meta ?? EMPTY_META;
  const loadError = loaded?.error ?? null;
  const reload = useCallback(() => setRefreshKey((value) => value + 1), []);

  const pageInRange = loaded && !loading && !loadError ? pageWithinTotal(page, meta, rows.length) : null;
  if (pageInRange !== null) setPaging({ key: filterKey, page: pageInRange });

  const navigate = useCallback((next: AllGroupsQuery) => router.replace(groupsRoutes.all(next), { scroll: false }), [router]);

  const numberNames = useMemo(() => {
    const names = new Map(numbers.map((number) => [number.id, numberLabel(number)]));
    for (const row of rows) for (const seat of row.numbers) if (!names.has(seat.instanceId)) names.set(seat.instanceId, seat.label);
    return names;
  }, [numbers, rows]);
  const numberOptions = useMemo(() => [...numberNames.entries()].sort((a, b) => a[1].localeCompare(b[1])), [numberNames]);

  const discover = useCallback(async () => {
    setDiscovering(true);
    const result = await discoverGroupsAction();
    setDiscovering(false);
    if (result.error || !result.data) {
      toast.error(t("discover.failed"), { description: result.error });
      return;
    }
    const found = t("discover.found", { groups: result.data.groups, numbers: result.data.numbers });
    const failed = result.data.failed.map((id) => numberNames.get(id) ?? id);
    const notify = failed.length > 0 ? toast.warning : toast;
    notify(t("discover.done"), {
      description: failed.length > 0 ? `${found} ${t("discover.failedNumbers", { names: failed.join(", ") })}` : found,
    });
    reload();
    setCategoriesKey((value) => value + 1);
  }, [t, numberNames, reload, setCategoriesKey]);

  useEffect(() => {
    if (!pendingAction || handledAction !== pendingAction) return;
    navigate(JSON.parse(filterKey) as AllGroupsQuery);
  }, [pendingAction, handledAction, filterKey, navigate]);

  useEffect(() => {
    if (!discoverQueued) return;
    const timer = setTimeout(() => {
      setDiscoverQueued(false);
      void discover();
    }, 0);
    return () => clearTimeout(timer);
  }, [discoverQueued, discover]);

  const clientSortable = meta.totalPages <= 1;
  const activeClientSort = clientSortable ? clientSort : null;
  const visibleRows = useMemo(() => sortRows(rows, activeClientSort), [rows, activeClientSort]);
  const stats = useMemo(() => listStats(rows), [rows]);
  const columns = useGroupColumns({ messagesMax: maxMessages(rows), clientSortable });

  const sorting: DashboardTableSorting = {
    sorts: (() => {
      const current = columnSort(query.sort ?? "recent", activeClientSort);
      return current ? [current] : [];
    })(),
    onToggle: (key) => {
      if (isClientColumn(key)) {
        setClientSort((current) => toggleClientSort(key, current));
        return;
      }
      if (key === "group" || key === "members") {
        setClientSort(null);
        navigate({ ...filters, sort: toggleServerSort(key, query.sort ?? "recent") });
      }
    },
  };

  const toggleFollow = useCallback(
    async (row: GroupRow) => {
      setBusyId(row.group.id);
      const following = Boolean(row.group.followedAt);
      const result = following ? await unfollowGroupAction(row.group.id) : await followGroupAction(row.group.id);
      setBusyId(null);
      if (result.error) {
        toast.error(t("follow.failed"), { description: result.error });
        return;
      }
      toast(following ? t("follow.unfollowed") : t("follow.followed"), { description: row.group.subject });
      reload();
    },
    [t, reload],
  );

  const selectedKeys = useMemo(() => new Set(selectedRows.keys()), [selectedRows]);
  const selectedList = useMemo(() => [...keepSelectedRows(selectedRows, selectedKeys, rows).values()], [selectedRows, selectedKeys, rows]);
  const toFollow = useMemo(() => selectedList.filter((row) => !row.group.followedAt), [selectedList]);
  const toUnfollow = useMemo(() => selectedList.filter((row) => row.group.followedAt), [selectedList]);

  const changeSelection = useCallback((keys: Set<string>) => setSelectedRows((previous) => keepSelectedRows(previous, keys, rows)), [rows]);
  const clearSelection = useCallback(() => setSelectedRows(new Map()), []);

  const bulkFollow = useCallback(
    async (follow: boolean) => {
      const targets = follow ? toFollow : toUnfollow;
      if (targets.length === 0) return;
      setBulkBusy(follow ? "follow" : "unfollow");
      const results = await Promise.all(targets.map((row) => (follow ? followGroupAction(row.group.id) : unfollowGroupAction(row.group.id))));
      setBulkBusy(null);
      const failed = results.filter((result) => result.error).length;
      const done = results.length - failed;
      const title = follow ? t("follow.bulkDone", { count: done }) : t("follow.bulkUnfollowed", { count: done });
      if (failed > 0) toast.warning(title, { description: t("follow.bulkFailed", { count: failed }) });
      else toast(title);
      reload();
    },
    [t, toFollow, toUnfollow, reload],
  );

  const exportSelected = useCallback(async () => {
    const targets = selectedList;
    if (targets.length === 0) return;
    setBulkBusy("export");
    const id = toast.loading(t("selection.exportProgress", { done: 0, total: targets.length }));
    let failed = 0;
    for (const [index, row] of targets.entries()) {
      const result = await exportGroupMembersAction(row.group.id);
      if (result.error) failed += 1;
      toast.loading(t("selection.exportProgress", { done: index + 1, total: targets.length }), { id });
    }
    setBulkBusy(null);
    const done = targets.length - failed;
    if (failed > 0) toast.warning(t("selection.exportDone", { count: done }), { id, description: t("selection.exportFailed", { count: failed }) });
    else toast.success(t("selection.exportDone", { count: done }), { id });
  }, [t, selectedList]);

  const busyIcon = (kind: typeof bulkBusy, icon: ReactNode) => (bulkBusy === kind ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : icon);

  const selectionActions = () => (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate && toFollow.length > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          title={t("selection.followCount", { count: toFollow.length })}
          icon={busyIcon("follow", <Bell className="h-4 w-4" weight="bold" />)}
          iconVisible
          disabled={bulkBusy !== null}
          onClick={() => void bulkFollow(true)}
        />
      ) : null}
      {canUpdate && toUnfollow.length > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          title={t("selection.unfollowCount", { count: toUnfollow.length })}
          icon={busyIcon("unfollow", <BellSlash className="h-4 w-4" weight="bold" />)}
          iconVisible
          disabled={bulkBusy !== null}
          onClick={() => void bulkFollow(false)}
        />
      ) : null}
      <StartCampaignButton groups={selectedList.map((row) => ({ id: row.group.id, origin: row.group.origin, numbers: row.numbers }))} variant="secondary" />
      {canExport ? (
        <Button
          variant="secondary"
          size="sm"
          title={t("selection.export")}
          icon={busyIcon("export", <DownloadSimple className="h-4 w-4" weight="bold" />)}
          iconVisible
          disabled={bulkBusy !== null}
          onClick={() => void exportSelected()}
        />
      ) : null}
      <Button variant="ghost" size="sm" title={t("selection.clear")} onClick={clearSelection} />
    </div>
  );

  const renderRowActions = (row: GroupRow) => {
    const busy = busyId === row.group.id;
    const followLabel = row.group.followedAt ? t("actions.unfollow") : t("actions.follow");
    const followIcon = busy ? (
      <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
    ) : row.group.followedAt ? (
      <BellSlash className="h-4 w-4" weight="bold" />
    ) : (
      <Bell className="h-4 w-4" weight="bold" />
    );
    return (
      <>
        {canUpdate ? (
          <TooltipWrapper content={followLabel}>
            <Button
              variant="ghost"
              size="icon"
              title=""
              aria-label={followLabel}
              icon={followIcon}
              iconVisible
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                void toggleFollow(row);
              }}
            />
          </TooltipWrapper>
        ) : null}
        <GroupRowMenu row={row} onNewAnalysis={setAnalysisGroupId} />
      </>
    );
  };

  const onPage = meta.totalPages > 1;
  const statLabel = (label: string) => (onPage ? t("stats.onPage", { label }) : label);
  const statValue = (value: string, mark?: "fault" | "warning") =>
    loading ? (
      <span className="text-muted-foreground">…</span>
    ) : (
      <span className="readout inline-flex items-center gap-1.5">
        {value}
        {mark ? <MarkDot mark={mark} /> : null}
      </span>
    );

  const firstUseActions =
    canUpdate || canCreate ? (
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {canUpdate ? <Button variant="secondary" title={t("actions.discover")} onClick={() => void discover()} disabled={discovering} /> : null}
        {canCreate ? <Button variant="secondary" title={t("actions.join")} onClick={() => setJoinOpen(true)} /> : null}
        {canCreate ? <Button variant="primary" title={t("actions.createGroup")} onClick={() => setCreateOpen(true)} /> : null}
      </div>
    ) : undefined;

  const emptyState = loadError
    ? tableEmpty.error(t("empty.errorTitle"), reload)
    : isSearchedOrNarrowed(filters)
      ? tableEmpty.noMatches(t("empty.noun"), () => navigate(clearedQuery(filters)))
      : tableEmpty.firstUse({ icon: <UsersThree className="h-7 w-7 text-muted-foreground" />, title: t("empty.title"), description: t("empty.description"), action: firstUseActions });

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {canUpdate ? (
        <Button
          variant="secondary"
          title={t("actions.discover")}
          icon={discovering ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <MagnifyingGlass className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
          disabled={discovering}
          onClick={() => void discover()}
        />
      ) : null}
      {canCreate ? (
        <>
          <Button
            variant="secondary"
            title={t("actions.join")}
            icon={<SignIn className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            onClick={() => setJoinOpen(true)}
          />
          <Button
            variant="primary"
            title={t("actions.createGroup")}
            icon={<Plus className="h-4 w-4" weight="bold" />}
            iconVisible
            iconSide="left"
            onClick={() => setCreateOpen(true)}
          />
        </>
      ) : null}
      <Button
        variant="command"
        aria-label={t("actions.refresh")}
        title=""
        icon={<ArrowClockwise className={cn("h-4 w-4", loading && "animate-spin")} weight="bold" />}
        iconVisible
        onClick={() => {
          reload();
          setJoinsSignal((value) => value + 1);
        }}
        disabled={loading}
      />
    </div>
  );

  return (
    <div className="w-full space-y-4">
      <DashboardPageHeader
        icon={<UsersThree className="h-6 w-6" />}
        badge={t("page.badge")}
        description={t("page.description")}
        meta={<CountChip count={meta.totalItems} noun={(count) => t("results", { count })} filtered={isNarrowed(filters)} loading={loading} />}
        actions={actions}
      />

      <JoinsPanel refreshSignal={joinsSignal} numbers={numbers} onJoinDone={reload} />

      <DashboardTable<GroupRow>
        data={visibleRows}
        columns={columns}
        rowKey={(row) => row.group.id}
        loading={loading}
        sorting={sorting}
        onRowClick={(row) => router.push(groupsRoutes.group(row.group.id))}
        renderRowActions={renderRowActions}
        headerLeft={
          <SearchField
            value={query.search ?? ""}
            onChange={(search) => navigate({ ...filters, search: search || undefined })}
            placeholder={t("filters.searchByName")}
            ariaLabel={t("filters.searchByName")}
          />
        }
        stats={[
          { label: t("stats.groups"), value: statValue(fmt.num(meta.totalItems)) },
          { label: statLabel(t("stats.followed")), value: statValue(fmt.num(stats.followed)) },
          {
            label: statLabel(stats.unsyncedMembers > 0 ? t("stats.membersWithOwn", { count: stats.unsyncedMembers }) : t("stats.members")),
            value: statValue(fmt.num(stats.members)),
          },
          { label: statLabel(t("stats.net")), value: statValue(fmt.signed(stats.net)) },
          { label: statLabel(t("stats.messages")), value: statValue(fmt.num(stats.messages)) },
          { label: statLabel(t("stats.highAlert")), value: statValue(fmt.num(stats.highAlertGroups), stats.highAlertGroups > 0 ? "fault" : undefined) },
          { label: statLabel(t("stats.withoutPoster")), value: statValue(fmt.num(stats.withoutPoster), stats.withoutPoster > 0 ? "warning" : undefined) },
        ]}
        toolbar={
          <GroupsToolbar
            query={filters}
            onChange={(next) => {
              if ((next.sort ?? "recent") !== (query.sort ?? "recent")) setClientSort(null);
              navigate(next);
            }}
            categories={categories}
            numberOptions={numberOptions}
            resultLabel={loading ? undefined : t("results", { count: meta.totalItems })}
          />
        }
        selection={
          canUpdate || canCampaign || canExport
            ? {
                selectedKeys,
                onSelectionChange: changeSelection,
                actions: selectionActions,
                label: (count) => t("selection.label", { count }),
                selectAllLabel: t("selection.selectAll"),
                selectRowLabel: t("selection.selectRow"),
              }
            : undefined
        }
        pagination={
          meta.totalItems > PAGE_SIZES[0] || meta.totalPages > 1 || page > 1
            ? {
                currentPage: page,
                totalPages: Math.max(1, meta.totalPages),
                pageSize,
                totalItems: meta.totalItems,
                onPageChange: (next) => setPaging({ key: filterKey, page: next }),
                pageSizeOptions: PAGE_SIZES,
                onPageSizeChange: (size) => {
                  setPageSize(parsePageSize(size));
                  setPaging({ key: filterKey, page: 1 });
                },
              }
            : undefined
        }
        paginationText={{ showing: t("pagination.showing"), of: t("pagination.of"), items: t("pagination.items"), perPage: t("pagination.perPage") }}
        emptyState={emptyState}
      />

      {canCreate ? (
        <>
          <JoinGroupSheet
            open={joinOpen}
            onOpenChange={setJoinOpen}
            onPlanned={() => {
              setJoinsSignal((value) => value + 1);
              reload();
            }}
          />
          <CreateGroupSheet
            open={createOpen}
            onOpenChange={setCreateOpen}
            onAttempted={() => {
              reload();
              setCategoriesKey((value) => value + 1);
            }}
            onCreated={(group) => router.push(groupsRoutes.group(group.id))}
          />
        </>
      ) : null}

      {canConfigure ? (
        <AnalysisFormSheet
          open={analysisGroupId !== null}
          onOpenChange={(open) => {
            if (!open) setAnalysisGroupId(null);
          }}
          groupId={analysisGroupId ?? undefined}
          onSaved={(analysis) => router.push(groupsRoutes.analysis(analysis.id))}
        />
      ) : null}
    </div>
  );
}
