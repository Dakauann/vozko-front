"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { assigneeKind } from "@/lib/conversations/assignee";

import {
  ArrowsClockwise,
  ArrowsLeftRight,
  ChatCircleDots,
  Stack,
  Tag,
  UsersThree,
  WhatsappLogo,
  X,
} from "@/components/icons";

import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ElevatedButton from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import AssignMemberPicker from "@/components/crm/AssignMemberPicker";
import MoveToFunnelDialog from "@/components/crm/MoveToFunnelDialog";
import { BULK_CONTROL } from "@/components/selection/GuardedAction";
import { SelectionCount, type SelectionOffer } from "@/components/selection/SelectionCount";
import { useBulkSelection, type WideCount } from "@/components/selection/use-bulk-selection";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { FunnelStages } from "@/app/actions/stages";

import { getCrmEntriesAction, crmBulkAction, countCrmBulkAction } from "@/app/actions/crm-board";
import { getBatchEntryStagesAction } from "@/app/actions/stages";
import { listAssignableMembersAction, type AssignableMember } from "@/app/actions/workspace";
import type { CodedError } from "@/lib/api/coded-error";
import { emptyValue } from "@/lib/format/empty-value";
import {
  encodeFilterParam,
  isEmptyCrmFilter,
  type CrmBoardEntry,
  type CrmBulkActionType,
  type CrmBulkResult,
  type CrmBulkTarget,
  type CrmFilter,
} from "@/lib/crm/board";
import { bulkRequest, filterSelection, type CrmBulkSelection } from "@/lib/crm/bulk-selection";
import { offersAllMatching } from "@/lib/selection/bulk-state";
import { SELECTION_CHANGED, selectionErrorMessage } from "@/lib/selection/errors";
import type { EntryStage, EntryType, Label, Stage } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const BULK_NAMESPACE = "crmBoard.bulk";

interface ChannelMeta {
  label: React.ReactNode;
  icon: React.ReactNode;
  tile: string;
}

function channelMeta(entryType: string): ChannelMeta {
  switch (entryType) {
    case "whatsapp":
      return {
        label: "WhatsApp",
        icon: <WhatsappLogo weight="fill" className="h-3.5 w-3.5 text-white" />,
        tile: "bg-[#25d366] text-white",
      };
    default:
      return {
        label: entryType || <EmptyValue />,
        icon: <ChatCircleDots weight="fill" className="h-3.5 w-3.5 text-white" />,
        tile: "bg-foreground/80 text-background",
      };
  }
}

function OwnerCell({ name }: { name: string | null }) {
  if (!name) return <EmptyValue className="text-sm" />;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold uppercase text-foreground">
        {name.charAt(0)}
      </span>
      <span className="max-w-[10rem] truncate text-sm text-foreground">{name}</span>
    </span>
  );
}

function formatDate(value: string | undefined | null, locale: string): string {
  if (!value) return emptyValue(locale);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return emptyValue(locale);
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

interface BulkMenuProps {
  triggerLabel: string;
  icon: React.ReactNode;
  heading: string;
  searchPlaceholder: string;
  emptyMessage: string;
  options: { value: string; label: string; color?: string }[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  tone?: "default" | "ghost";
}

function BulkMenu({
  triggerLabel,
  icon,
  heading,
  searchPlaceholder,
  emptyMessage,
  options,
  onSelect,
  disabled,
  tone = "default",
}: BulkMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={
            tone === "ghost"
              ? "inline-flex h-8 items-center gap-1.5 rounded-[--radius] px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground"
              : BULK_CONTROL
          }
        >
          <span className="text-muted-foreground">{icon}</span>
          <span>{triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 rounded-[--radius] border border-border bg-card p-0 shadow-2xl"
      >
        <div className="border-b border-border px-3 py-2">
          <span className="text-2xs font-semibold text-muted-foreground">
            {heading}
          </span>
        </div>
        <Command shouldFilter className="rounded-none bg-transparent text-foreground">
          <CommandInput placeholder={searchPlaceholder} className="text-sm" />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.value} ${option.label}`.toLowerCase()}
                  onSelect={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs text-foreground data-[selected=true]:bg-muted"
                >
                  {option.color ? (
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-black/5"
                      style={{ backgroundColor: option.color }}
                    />
                  ) : null}
                  <span className="flex-1 truncate font-medium">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type BulkOption = { value: string; label: string; color?: string };

interface BulkActionsBarProps {
  canAssignStage: boolean;
  canAssignOwner: boolean;
  canAssignLabel: boolean;
  workspaceId?: string;
  stageOptions: BulkOption[];
  labelOptions: BulkOption[];
  bulkBusy: boolean;
  onBulk: (action: CrmBulkActionType, value: string) => void;
  onRequestBulkMoveToFunnel?: () => void;
  onClear: () => void;
}

function BulkActionsBar({
  canAssignStage,
  canAssignOwner,
  canAssignLabel,
  workspaceId,
  stageOptions,
  labelOptions,
  bulkBusy,
  onBulk,
  onRequestBulkMoveToFunnel,
  onClear,
}: BulkActionsBarProps) {
  const t = useTranslations(BULK_NAMESPACE);
  return (
    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
      {canAssignStage ? (
        <BulkMenu
          triggerLabel={t("moveStage")}
          icon={<Stack weight="bold" className="h-3.5 w-3.5" />}
          heading={t("moveStageHeading")}
          searchPlaceholder={t("searchStage")}
          emptyMessage={t("noStages")}
          options={stageOptions}
          onSelect={(v) => onBulk("move_stage", v)}
          disabled={bulkBusy}
        />
      ) : null}

      {canAssignStage && onRequestBulkMoveToFunnel ? (
        <button
          type="button"
          disabled={bulkBusy}
          onClick={onRequestBulkMoveToFunnel}
          className={BULK_CONTROL}
        >
          <ArrowsLeftRight
            weight="bold"
            className="h-3.5 w-3.5 text-muted-foreground"
          />
          <span>{t("moveFunnel")}</span>
        </button>
      ) : null}

      {canAssignOwner && workspaceId ? (
        <AssignMemberPicker
          workspaceId={workspaceId}
          onAssign={(userId) => onBulk("assign", userId)}
        />
      ) : null}

      {canAssignLabel ? (
        <BulkMenu
          triggerLabel={t("addLabel")}
          icon={<Tag weight="bold" className="h-3.5 w-3.5" />}
          heading={t("addLabelHeading")}
          searchPlaceholder={t("searchLabel")}
          emptyMessage={t("noLabels")}
          options={labelOptions}
          onSelect={(v) => onBulk("add_label", v)}
          disabled={bulkBusy}
        />
      ) : null}

      {canAssignLabel ? (
        <BulkMenu
          triggerLabel={t("removeLabel")}
          icon={<X weight="bold" className="h-3.5 w-3.5" />}
          heading={t("removeLabel")}
          searchPlaceholder={t("searchLabel")}
          emptyMessage={t("noLabels")}
          options={labelOptions}
          onSelect={(v) => onBulk("remove_label", v)}
          disabled={bulkBusy}
          tone="ghost"
        />
      ) : null}

      <button
        type="button"
        onClick={onClear}
        className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <X weight="bold" className="h-3.5 w-3.5" />
        {t("clear")}
      </button>
    </div>
  );
}

interface PendingBulk {
  action: CrmBulkActionType;
  value: string;
  previousCount?: number;
}

function reportBulkResult(t: ReturnType<typeof useTranslations>, result: CrmBulkResult) {
  const succeeded = result.succeeded ?? 0;
  const failed = result.failed?.length ?? 0;
  if (result.truncated) {
    toast.warning(t("truncated", { succeeded, matched: result.matched ?? succeeded }));
    return;
  }
  if (failed > 0) {
    toast.warning(t("partial", { succeeded, eligible: result.eligible ?? succeeded + failed, failed }));
    return;
  }
  toast.success(t("updated", { count: succeeded }));
}

export interface CrmListViewProps {
  filter: CrmFilter;
  stages: Stage[];
  labels: Label[];
  workspaceId?: string;
  canAssignStage?: boolean;
  funnelStages?: FunnelStages[];
  canMoveToFunnel?: boolean;
  canAssignOwner?: boolean;
  canAssignLabel?: boolean;
}

export default function CrmListView({
  filter,
  stages,
  labels,
  workspaceId,
  canAssignStage = false,
  funnelStages = [],
  canMoveToFunnel = false,
  canAssignOwner = false,
  canAssignLabel = false,
}: CrmListViewProps) {
  const locale = useLocale();
  const t = useTranslations(BULK_NAMESPACE);
  const tList = useTranslations("crmBoard.list");
  const tSelection = useTranslations("selection");

  const [entries, setEntries] = useState<CrmBoardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [stageByEntry, setStageByEntry] = useState<Record<string, EntryStage | null>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [pendingBulk, setPendingBulk] = useState<PendingBulk | null>(null);
  const [entryTypes, setEntryTypes] = useState<ReadonlyMap<string, string>>(new Map());

  const reqRef = useRef(0);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void listAssignableMembersAction(workspaceId, { pageSize: 200 }).then((res) => {
      if (!cancelled) setMembers(res.members ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const membersById = useMemo(() => {
    const map = new Map<string, AssignableMember>();
    if (!workspaceId) return map;
    for (const m of members) map.set(m.userId, m);
    return map;
  }, [members, workspaceId]);

  const filterKey = encodeFilterParam(filter);
  const currentScope = `${filterKey}|${sortOrder}`;
  const selection = useBulkSelection(currentScope);
  const { widen, clear: clearSelection, setPicked } = selection;

  const [scope, setScope] = useState(currentScope);
  if (scope !== currentScope) {
    setScope(currentScope);
    setPage(1);
    setEntryTypes(new Map());
    if (pendingBulk) setPendingBulk(null);
  }

  const wide = selection.wide;
  const activeAllMatching = useMemo<Extract<CrmBulkSelection, { kind: "filter" }> | null>(
    () =>
      wide && wide.fingerprint !== undefined
        ? filterSelection(filter, { matched: wide.matched, fingerprint: wide.fingerprint })
        : null,
    [wide, filter],
  );

  const enrichStages = useCallback(
    async (list: CrmBoardEntry[], reqId: number) => {
      const idsByType = new Map<EntryType, string[]>();
      for (const e of list) {
        const t = e.EntryType as EntryType;
        const bucket = idsByType.get(t);
        if (bucket) bucket.push(e.EntryID);
        else idsByType.set(t, [e.EntryID]);
      }
      const merged: Record<string, EntryStage | null> = {};
      await Promise.all(
        [...idsByType.entries()].map(async ([t, ids]) => {
          const { entryStages } = await getBatchEntryStagesAction(ids, t);
          for (const [id, es] of Object.entries(entryStages)) merged[id] = es;
        }),
      );
      if (reqId !== reqRef.current) return;
      setStageByEntry(merged);
    },
    [],
  );

  const load = useCallback(async () => {
    const reqId = ++reqRef.current;
    setLoading(true);
    const { result, error: err } = await getCrmEntriesAction({
      filter,
      page,
      pageSize: PAGE_SIZE,
      sortOrder,
    });
    if (reqId !== reqRef.current) return;
    if (err) {
      setError(err);
      setEntries([]);
      setTotal(0);
      setStageByEntry({});
      setLoading(false);
      return;
    }
    const list = result?.entries ?? [];
    setEntries(list);
    setEntryTypes((known) => {
      const next = new Map(known);
      for (const entry of list) next.set(entry.EntryID, entry.EntryType);
      return next;
    });
    setTotal(result?.total ?? 0);
    setError(null);
    setLoading(false);
    setStageByEntry({});
    if (list.length > 0) void enrichStages(list, reqId);
  }, [filter, page, sortOrder, enrichStages]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const pickedTargets = useMemo((): CrmBulkTarget[] | null => {
    const targets: CrmBulkTarget[] = [];
    for (const entryId of selection.picked) {
      const entryType = entryTypes.get(entryId);
      if (!entryType) return null;
      targets.push({ entryId, entryType });
    }
    return targets;
  }, [selection.picked, entryTypes]);

  const [movingSelection, setMovingSelection] = useState(false);

  const canMoveAcrossFunnels =
    canAssignStage &&
    canMoveToFunnel &&
    funnelStages.filter((f) => f.stages.length > 0).length > 1;

  const unfiltered = isEmptyCrmFilter(filter);
  const wideMode: SelectionOffer["mode"] = unfiltered ? "everyone" : "all_matching";

  const countMatching = useCallback(
    async (counted: CrmFilter): Promise<WideCount | null> => {
      const { count, error: countError } = await countCrmBulkAction(counted);
      if (!count) {
        toast.error(selectionErrorMessage(tSelection, countError ?? {}));
        return null;
      }
      return count;
    },
    [tSelection],
  );

  const selectAllMatching = useCallback(() => {
    void widen(wideMode, () => countMatching(filter));
  }, [widen, wideMode, countMatching, filter]);

  const applyBulk = useCallback(
    async (
      action: CrmBulkActionType,
      value: string,
      chosen: CrmBulkSelection,
    ): Promise<CodedError | null> => {
      setBulkBusy(true);
      const { result, error: bulkError } = await crmBulkAction(bulkRequest(action, value, chosen));
      setBulkBusy(false);
      if (!result) return bulkError ?? {};
      reportBulkResult(t, result);
      clearSelection();
      await load();
      return null;
    },
    [t, clearSelection, load],
  );

  const runBulk = useCallback(
    async (
      action: CrmBulkActionType,
      value: string,
    ): Promise<string | null> => {
      if (!value) return null;

      if (activeAllMatching) {
        setPendingBulk({ action, value });
        return null;
      }

      if (pickedTargets === null) {
        const message = t("unknownPick");
        toast.error(message);
        return message;
      }
      if (pickedTargets.length === 0) return null;

      const refusal = await applyBulk(action, value, { kind: "ids", targets: pickedTargets });
      if (!refusal) return null;
      const message = selectionErrorMessage(tSelection, refusal);
      toast.error(message);
      return message;
    },
    [activeAllMatching, pickedTargets, applyBulk, tSelection, t],
  );

  const confirmPendingBulk = useCallback(async (): Promise<boolean> => {
    if (!pendingBulk || !activeAllMatching) return true;

    const refusal = await applyBulk(pendingBulk.action, pendingBulk.value, activeAllMatching);
    if (!refusal) return true;
    if (refusal.code !== SELECTION_CHANGED) {
      toast.error(selectionErrorMessage(tSelection, refusal));
      return true;
    }

    const previousCount = activeAllMatching.count.matched;
    const recounted = await widen(activeAllMatching.mode, () => countMatching(activeAllMatching.filter));
    if (!recounted) return true;
    setPendingBulk({ ...pendingBulk, previousCount });
    return false;
  }, [pendingBulk, activeAllMatching, applyBulk, tSelection, widen, countMatching]);

  const stageOptions = useMemo(
    () =>
      [...stages]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ value: s.id, label: s.name, color: s.color })),
    [stages],
  );
  const labelOptions = useMemo(
    () =>
      [...labels]
        .sort((a, b) => a.position - b.position)
        .map((l) => ({ value: l.id, label: l.name, color: l.color })),
    [labels],
  );

  const columns = useMemo<DashboardTableColumn<CrmBoardEntry>[]>(
    () => [
      {
        key: "contato",
        header: tList("columns.contact"),
        render: (row) => {
          const name = row.LeadName?.trim();
          const number = row.LeadNumber?.trim();
          return (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {name || number || <EmptyValue />}
              </span>
              {name && number ? (
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {number}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "canal",
        header: tList("columns.channel"),
        render: (row) => {
          const meta = channelMeta(row.EntryType);
          return (
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md",
                  meta.tile,
                )}
              >
                {meta.icon}
              </span>
              <span className="text-sm text-foreground">{meta.label}</span>
            </span>
          );
        },
      },
      {
        key: "mensagem",
        header: tList("columns.lastMessage"),
        className: "max-w-[280px]",
        render: (row) => {
          const preview = row.LastMessageText?.trim();
          const unread = row.UnreadCount ?? 0;
          return (
            <div className="flex items-center gap-2">
              <span className="max-w-[240px] truncate text-sm text-muted-foreground">
                {preview || <EmptyValue />}
              </span>
              {unread > 0 ? (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-[--radius] bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">
                  {unread}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "etapa",
        header: tList("columns.stage"),
        render: (row) => {
          const es = stageByEntry[row.EntryID];
          if (!es) return <EmptyValue className="text-sm" />;
          return (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-black/5"
                style={{ backgroundColor: es.stageColor || "#94a3b8" }}
              />
              <span className="truncate text-sm text-foreground">{es.stageName}</span>
            </span>
          );
        },
      },
      {
        key: "responsavel",
        header: tList("columns.owner"),
        render: (row) => {
          const uid = row.AssignedUserID?.trim();
          if (!uid) return <OwnerCell name={null} />;
          const holder = assigneeKind(uid);
          if (holder === "ai") return <OwnerCell name={tList("owner.ai")} />;
          if (holder === "workflow") return <OwnerCell name={tList("owner.workflow")} />;
          const m = membersById.get(uid);
          const name = m ? m.username?.trim() || m.email?.trim() || uid : tList("owner.assigned");
          return <OwnerCell name={name} />;
        },
      },
      {
        key: "atualizado",
        header: tList("columns.updated"),
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(row.LastMessageAt, locale)}
          </span>
        ),
      },
    ],
    [stageByEntry, locale, membersById, tList],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageKeys = useMemo(() => entries.map((entry) => entry.EntryID), [entries]);

  const renderBulkActions = useCallback(
    () => (
      <BulkActionsBar
        canAssignStage={canAssignStage}
        canAssignOwner={canAssignOwner}
        canAssignLabel={canAssignLabel}
        workspaceId={workspaceId}
        stageOptions={stageOptions}
        labelOptions={labelOptions}
        bulkBusy={bulkBusy || selection.counting !== null}
        onBulk={runBulk}
        onRequestBulkMoveToFunnel={
          canMoveAcrossFunnels ? () => setMovingSelection(true) : undefined
        }
        onClear={clearSelection}
      />
    ),
    [
      canAssignStage,
      canAssignOwner,
      canAssignLabel,
      workspaceId,
      stageOptions,
      labelOptions,
      bulkBusy,
      selection.counting,
      clearSelection,
      runBulk,
      canMoveAcrossFunnels,
    ],
  );

  const offer = useMemo<SelectionOffer | null>(
    () => (offersAllMatching(selection.picked, pageKeys, total) ? { count: total, mode: wideMode } : null),
    [selection.picked, pageKeys, total, wideMode],
  );

  const renderSelectionCount = useCallback(
    () => (
      <SelectionCount
        namespace={BULK_NAMESPACE}
        picked={selection.picked.size}
        wide={wide}
        counting={selection.counting !== null}
        offer={offer}
        onSelectAll={selectAllMatching}
        onClear={clearSelection}
      />
    ),
    [selection.picked, selection.counting, clearSelection, wide, offer, selectAllMatching],
  );

  const pendingEveryone = activeAllMatching?.mode === "everyone";

  return (
    <div className="h-full w-full overflow-auto p-4">
      <DashboardTable<CrmBoardEntry>
        data={entries}
        columns={columns}
        rowKey={(row) => row.EntryID}
        loading={loading}
        stats={[
          {
            label: tList("stats.conversations"),
            value: loading ? "..." : String(total),
            icon: <UsersThree className="h-4 w-4 text-primary-ink" weight="fill" />,
          },
        ]}
        headerRight={
          <ElevatedSelect
            value={sortOrder}
            onValueChange={(v) => setSortOrder(v as "desc" | "asc")}
            className="w-auto min-w-[170px]"
          >
            <ElevatedSelectItem value="desc">{tList("sort.newest")}</ElevatedSelectItem>
            <ElevatedSelectItem value="asc">{tList("sort.oldest")}</ElevatedSelectItem>
          </ElevatedSelect>
        }
        selection={{
          selectedKeys: selection.picked,
          onSelectionChange: setPicked,
          actions: renderBulkActions,
          label: renderSelectionCount,
          selectAllLabel: tList("selectPage"),
          selectRowLabel: tList("selectRow"),
        }}
        pagination={
          totalPages > 1
            ? {
                currentPage: page,
                totalPages,
                pageSize: PAGE_SIZE,
                totalItems: total,
                onPageChange: setPage,
              }
            : undefined
        }
        paginationText={{ showing: tList("pagination.showing"), of: tList("pagination.of"), items: tList("pagination.items") }}
        emptyState={
          error
            ? {
                icon: <ArrowsClockwise className="h-7 w-7 text-destructive-ink" weight="bold" />,
                title: tList("empty.failedTitle"),
                description: error,
                action: (
                  <ElevatedButton
                    variant="outline-subtle"
                    size="sm"
                    title={tList("empty.retry")}
                    onClick={() => void load()}
                  />
                ),
              }
            : {
                icon: <ChatCircleDots className="h-7 w-7 text-muted-foreground" weight="fill" />,
                title: tList("empty.title"),
                description: tList("empty.description"),
              }
        }
      />

      {canMoveAcrossFunnels && movingSelection ? (
        <MoveToFunnelDialog
          open
          onOpenChange={(next) => {
            if (!next) setMovingSelection(false);
          }}
          funnels={funnelStages}
          currentStageId={null}
          bulkCount={selection.size}
          onConfirm={(stageId) => runBulk("move_funnel", stageId)}
        />
      ) : null}

      {pendingBulk && activeAllMatching ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) setPendingBulk(null);
          }}
          tone="default"
          title={t("confirmTitle", { count: activeAllMatching.count.matched })}
          description={
            <>
              {pendingBulk.previousCount !== undefined ? (
                <span className="mb-2 block font-medium text-foreground">
                  {t("confirmChanged", {
                    previous: pendingBulk.previousCount,
                    count: activeAllMatching.count.matched,
                  })}
                </span>
              ) : null}
              <span className="block">
                {t(pendingEveryone ? "confirmEveryone" : "confirmAllMatching")}
              </span>
            </>
          }
          confirmLabel={t(pendingEveryone ? "confirmEveryoneAction" : "confirm")}
          cancelLabel={t("cancel")}
          confirmDisabled={activeAllMatching.count.matched === 0}
          onConfirm={confirmPendingBulk}
        />
      ) : null}
    </div>
  );
}
