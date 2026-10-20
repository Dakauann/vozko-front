"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  ArrowsLeftRight,
  Check,
  Circle,
  DotsThree,
} from "@/components/icons";
import type {
  EntryType,
  InboxEntry,
  Label,
  Stage,
} from "@/lib/conversations/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { reorderStagesAction } from "@/app/actions/stages";
import AnalysisHoverCard from "@/components/crm/AnalysisHoverCard";
import { effectiveAnalysis } from "@/lib/analysis/live";
import { AssigneeGlyph } from "@/components/crm/AssigneeGlyph";
import KanbanColumnShell from "@/components/crm/KanbanColumnShell";
import BoardColumn from "@/components/crm/kanban/BoardColumn";
import BoardDragArea from "@/components/crm/kanban/BoardDragArea";
import { ChannelAvatar } from "@/components/channels/channel-avatar";
import {
  CardPill,
  CardLabelChip,
  KanbanCard,
  kanbanCardClass,
  kanbanCardFocusClass,
  kanbanCardVariants,
  kanbanCardTransition,
  kanbanCardHover,
  kanbanCardGhostClass,
} from "@/components/crm/kanban-card";
import { AnchoredMenu } from "@/components/ui/anchored-menu";
import { useWorkspace } from "@/contexts/workspace-context";
import { toast } from "sonner";
import {
  beginOperation,
  confirmOperation,
  emptyLedger,
  rollbackOperation,
  type OptimisticLedger,
} from "@/lib/crm/optimistic";
import { performReversible } from "@/lib/crm/undoable";
import { canUndoCardMove, type BoardDragSubject } from "@/lib/crm/board-drag";
import { useCompactAgeText } from "@/hooks/use-compact-age";
import { useBoardCard, useBoardDrag, type ColumnDragHandle } from "@/hooks/use-board-drag";
import { useCollapsedColumns } from "@/hooks/use-collapsed-columns";
import { useColumnPulse } from "@/hooks/use-column-pulse";
import type { FunnelColumnState } from "@/hooks/use-conversation-ws";
import type { FunnelStages } from "@/app/actions/stages";
import MoveToFunnelDialog from "@/components/crm/MoveToFunnelDialog";


const UNSTAGED_COLUMN_ID = "__unstaged__";
const COLUMN_PAGE_SIZE = 20;

function entryKeyOf(entry: InboxEntry): string {
  return `${entry.entry_type}-${entry.entry_id}`;
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

interface CrmFunnelViewProps {
  entries: InboxEntry[];
  stages: Stage[];
  selectedEntryId: string | null;
  onSelect: (entryId: string, entryType: EntryType) => void;
  onStagesReorder?: (stages: Stage[]) => void;
  onEntryStageChange?: (
    entryId: string,
    entryType: EntryType,
    newStageId: string,
    oldStageId: string | null,
  ) => Promise<boolean> | void;
  funnelColumns?: Map<string, FunnelColumnState>;
  funnelSummary?: Map<string, number>;
  loadingFunnelColumn?: string | null;
  onRequestColumn?: (stageId: string, page?: number, pageSize?: number) => void;
  onRequestSummary?: (stageIds: string[]) => void;
  labels?: Label[];
  onAssignLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  onRemoveLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  funnelStages?: FunnelStages[];
  onMoveToFunnel?: (
    entryId: string,
    entryType: EntryType,
    stageId: string,
  ) => Promise<string | null>;
}


function FunnelCardBody({ entry }: { entry: InboxEntry }) {
  const t = useTranslations("crmKanban");
  const age = useCompactAgeText()(entry.last_message_at);
  const hasUnread = entry.unread_count > 0;

  const labels = entry.labels ?? [];

  return (
    <KanbanCard
      strongTitle={hasUnread}
      tile={
        <ChannelAvatar
          name={entry.lead_name || entry.lead_number}
          pictureUrl={entry.lead_picture}
          entryType={entry.entry_type}
          isGroup={entry.is_group}
          size="sm"
        />
      }
      title={entry.lead_name || entry.lead_number}
      subtitle={entry.campaign_name || undefined}
      thirdLine={
        <p className="truncate text-2xs text-muted-foreground">{age}</p>
      }
      rightSlot={
        hasUnread ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-[--radius] bg-healthy px-1 text-2xs font-semibold text-healthy-foreground">
            {entry.unread_count > 99 ? "99+" : entry.unread_count}
          </span>
        ) : undefined
      }
      body={
        <p className="text-2xs leading-relaxed text-muted-foreground">
          {truncate(entry.last_message_preview, 80)}
        </p>
      }
      pills={
        <>
          {entry.window_open ? (
            <CardPill tone="success" icon={<Circle weight="fill" className="h-1.5 w-1.5" />}>
              {t("windowOpen")}
            </CardPill>
          ) : (
            <CardPill tone="warning" icon={<Circle weight="fill" className="h-1.5 w-1.5" />}>
              {t("windowClosed")}
            </CardPill>
          )}
          {entry.assigned_username ? (
            <CardPill
              tone="info"
              className="max-w-[50%]"
              icon={
                <AssigneeGlyph
                  assignedUserId={entry.assigned_user_id}
                  className="h-2.5 w-2.5 flex-shrink-0"
                />
              }
            >
              {entry.assigned_username}
            </CardPill>
          ) : null}
        </>
      }
      trailingDot={
        entry.stage ? (
          <span
            className="ml-auto h-2 w-2 rounded-full ring-1 ring-white"
            style={{ backgroundColor: entry.stage.color }}
            title={entry.stage.name}
          />
        ) : undefined
      }
      chips={
        labels.length > 0 ? (
          <>
            {labels.slice(0, 3).map((label) => (
              <CardLabelChip key={label.label_id} name={label.name} color={label.color} />
            ))}
            {labels.length > 3 ? (
              <span className="inline-flex items-center rounded-[--radius] bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground shadow-sm">
                +{labels.length - 3}
              </span>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}


function FunnelCard({
  entry,
  columnId,
  isSelected,
  onSelect,
  canDrag = true,
  availableLabels,
  onAssignLabel,
  onRemoveLabel,
  onRequestMoveToFunnel,
  labelMenuOpen,
  onLabelMenuToggle,
}: {
  entry: InboxEntry;
  columnId: string;
  isSelected: boolean;
  onSelect: () => void;
  canDrag?: boolean;
  availableLabels?: Label[];
  onAssignLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  onRemoveLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  onRequestMoveToFunnel?: (entry: InboxEntry) => void;
  labelMenuOpen?: boolean;
  onLabelMenuToggle?: () => void;
}) {
  const t = useTranslations("crmKanban");
  const [isHovered, setIsHovered] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const { can } = useWorkspace();
  const canReadAnalysis = can("audience", "read");
  const analysis = effectiveAnalysis(entry);
  const { cardProps, isDragging } = useBoardCard({
    id: entryKeyOf(entry),
    columnId,
    draggable: canDrag,
    onOpen: onSelect,
  });

  const hasLabelActions = Boolean(
    availableLabels && availableLabels.length > 0 && onLabelMenuToggle,
  );

  const hasCardMenu = hasLabelActions || Boolean(onRequestMoveToFunnel);

  const layoutId = `kanban-card-${columnId}-${entry.entry_type}-${entry.entry_id}`;

  if (isDragging) {
    return (
      <motion.div
        {...cardProps}
        layout="position"
        layoutId={layoutId}
        className={cn(kanbanCardGhostClass, "p-3")}
      >
        <div className="invisible">
          <FunnelCardBody entry={entry} />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...cardProps}
      aria-label={entry.lead_name || entry.lead_number}
      layout="position"
      layoutId={layoutId}
      onMouseEnter={() => {
        if (canReadAnalysis && analysis) setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      variants={kanbanCardVariants}
      initial={false}
      animate="animate"
      exit="exit"
      transition={kanbanCardTransition}
      onClick={onSelect}
      className={kanbanCardClass(
        { selected: isSelected },
        cn(
          "will-change-transform select-none",
          "group/kanban-card",
          kanbanCardFocusClass,
          canDrag ? "cursor-grab touch-manipulation active:cursor-grabbing" : "cursor-pointer",
        ),
      )}
      whileHover={kanbanCardHover}
      onContextMenu={(e) => {
        if (hasCardMenu) {
          e.preventDefault();
          e.stopPropagation();
          onLabelMenuToggle?.();
        }
      }}
    >
      <FunnelCardBody entry={entry} />

      {hasCardMenu ? (
        <button
          type="button"
          ref={menuAnchorRef}
          aria-label={t("cardActions")}
          aria-haspopup="menu"
          aria-expanded={Boolean(labelMenuOpen)}
          onClick={(e) => {
            e.stopPropagation();
            onLabelMenuToggle?.();
          }}
          className={cn(
            "absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-[--radius]",
            "text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
            "opacity-100 md:opacity-0 md:group-hover/kanban-card:opacity-100 md:group-focus-visible/kanban-card:opacity-100 md:focus-visible:opacity-100",
            labelMenuOpen && "md:opacity-100",
          )}
        >
          <DotsThree weight="bold" className="h-4 w-4" />
        </button>
      ) : null}

      <AnchoredMenu
        open={Boolean(labelMenuOpen && hasCardMenu)}
        anchorRef={menuAnchorRef}
        onClose={() => onLabelMenuToggle?.()}
        label={t("cardActions")}
      >
        {hasLabelActions && availableLabels ? (
          <>
            <div className="px-3 py-1.5 text-2xs font-semibold text-muted-foreground">
              {t("labels")}
            </div>
            <div className="max-h-44 overflow-y-auto">
              {availableLabels.map((label) => {
                const isAssigned = entry.labels?.some(
                  (l) => l.label_id === label.id,
                );
                return (
                  <button
                    key={label.id}
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAssigned && onRemoveLabel) {
                        onRemoveLabel(
                          label.id,
                          entry.entry_id,
                          entry.entry_type,
                        );
                      } else if (!isAssigned && onAssignLabel) {
                        onAssignLabel(
                          label.id,
                          entry.entry_id,
                          entry.entry_type,
                        );
                      }
                      onLabelMenuToggle?.();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-2xs transition-colors hover:bg-muted"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5 flex-shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="flex-1 truncate font-medium text-foreground">
                      {label.name}
                    </span>
                    {isAssigned && (
                      <Check
                        weight="bold"
                        className="h-3 w-3 text-chart-4 flex-shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {onRequestMoveToFunnel ? (
          <>
            {hasLabelActions ? (
              <div className="my-1 border-t border-border" />
            ) : null}
            <button
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                onLabelMenuToggle?.();
                onRequestMoveToFunnel(entry);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-2xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ArrowsLeftRight
                weight="bold"
                className="h-3 w-3 flex-shrink-0 text-muted-foreground"
              />
              <span className="truncate">{t("moveToFunnel")}</span>
            </button>
          </>
        ) : null}
      </AnchoredMenu>

      {canReadAnalysis && analysis && (
        <AnalysisHoverCard
          analysis={analysis}
          visible={isHovered}
        />
      )}
    </motion.div>
  );
}


function FunnelColumn({
  stage,
  entries,
  selectedEntryId,
  onSelect,
  isDragOver,
  isPulsing,
  canDrag = true,
  dragHandle,
  collapsed,
  onToggleCollapsed,
  totalItems,
  isLoading,
  onLoadMore,
  currentPage,
  pageSize,
  availableLabels,
  onAssignLabel,
  onRemoveLabel,
  labelMenuEntryId,
  onRequestMoveToFunnel,
  onLabelMenuToggle,
}: {
  stage: Stage;
  entries: InboxEntry[];
  selectedEntryId: string | null;
  onSelect: (entryId: string, entryType: EntryType) => void;
  isDragOver: boolean;
  isPulsing: boolean;
  canDrag?: boolean;
  dragHandle?: ColumnDragHandle;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  totalItems?: number;
  isLoading?: boolean;
  onLoadMore?: () => void;
  currentPage?: number;
  pageSize?: number;
  availableLabels?: Label[];
  onAssignLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  onRemoveLabel?: (
    labelId: string,
    entryId: string,
    entryType: EntryType,
  ) => void;
  labelMenuEntryId?: string | null;
  onRequestMoveToFunnel?: (entry: InboxEntry) => void;
  onLabelMenuToggle?: (entryKey: string) => void;
}) {
  const t = useTranslations("crmKanban");
  const pSize = pageSize ?? COLUMN_PAGE_SIZE;
  const allPagesLoaded =
    currentPage !== undefined &&
    totalItems !== undefined &&
    currentPage * pSize >= totalItems;
  const hasMore =
    totalItems !== undefined && entries.length < totalItems && !allPagesLoaded;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  // eslint-disable-next-line react-hooks/refs
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!hasMore || isLoading) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && onLoadMoreRef.current) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin: "100px", threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, entries.length]);

  return (
    <KanbanColumnShell
      columnId={stage.id}
      name={stage.name}
      color={stage.color}
      count={totalItems ?? entries.length}
      isDragOver={isDragOver}
      pulsing={isPulsing}
      dragHandle={dragHandle}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {entries.length === 0 && !isLoading ? (
          <motion.div
            key="empty-placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-8"
          >
            <p className="text-2xs text-muted-foreground italic">
              {t("noConversations")}
            </p>
          </motion.div>
        ) : (
          entries.map((entry) => {
            const entryKey = entryKeyOf(entry);
            return (
              <FunnelCard
                key={entryKey}
                entry={entry}
                columnId={stage.id}
                isSelected={entry.entry_id === selectedEntryId}
                onSelect={() => onSelect(entry.entry_id, entry.entry_type)}
                canDrag={canDrag}
                availableLabels={availableLabels}
                onAssignLabel={onAssignLabel}
                onRemoveLabel={onRemoveLabel}
                onRequestMoveToFunnel={
                  onRequestMoveToFunnel
                }
                labelMenuOpen={labelMenuEntryId === entryKey}
                onLabelMenuToggle={() => onLabelMenuToggle?.(entryKey)}
              />
            );
          })
        )}
      </AnimatePresence>

      {isLoading && (
        <div className="flex items-center justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border border-foreground/20 border-t-primary" />
        </div>
      )}
      {hasMore && !isLoading && (
        <div ref={sentinelRef} className="h-8 flex items-center justify-center">
          <span className="text-2xs text-muted-foreground">
            {t("shownOf", { shown: entries.length, total: totalItems ?? entries.length })}
          </span>
        </div>
      )}
    </KanbanColumnShell>
  );
}


export default function CrmFunnelView({
  entries,
  stages,
  selectedEntryId,
  onSelect,
  onStagesReorder,
  onEntryStageChange,
  funnelColumns,
  funnelSummary,
  loadingFunnelColumn,
  onRequestColumn,
  onRequestSummary,
  labels: availableLabels = [],
  onAssignLabel,
  onRemoveLabel,
  funnelStages = [],
  onMoveToFunnel,
}: CrmFunnelViewProps) {
  const t = useTranslations("crmKanban");
  const tActions = useTranslations("crmActions");
  const defaultColumnOrder = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position).map((t) => t.id),
    [stages],
  );
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const { pulsing: pulsingColumns, pulse: triggerColumnPulse } = useColumnPulse();
  const { isCollapsed, toggle: toggleCollapsed } = useCollapsedColumns("conversation-funnel");
  const [labelMenuEntryId, setLabelMenuEntryId] = useState<string | null>(null);
  const [optimisticMoves, setOptimisticMoves] = useState<Map<string, string>>(
    new Map(),
  );
  const movesLedgerRef = useRef<OptimisticLedger<string | undefined>>(emptyLedger());
  const reorderSequenceRef = useRef(0);

  const [movingEntry, setMovingEntry] = useState<InboxEntry | null>(null);

  const canMoveAcrossFunnels =
    Boolean(onMoveToFunnel) &&
    funnelStages.filter((f) => f.stages.length > 0).length > 1;

  const prevColumnEntriesRef = useRef<Map<string, Set<string>>>(new Map());

  const effectiveColumnOrder =
    columnOrder.length > 0 && columnOrder.length === defaultColumnOrder.length
      ? columnOrder
      : defaultColumnOrder;

  const hasRequestedRef = useRef(false);
  const prevStageIdsRef = useRef<Set<string>>(new Set());
  const kanbanIsEmpty = !funnelColumns || funnelColumns.size === 0;

  useEffect(() => {
    if (!onRequestColumn || !onRequestSummary || stages.length === 0) return;

    if (kanbanIsEmpty) {
      hasRequestedRef.current = false;
    }

    if (hasRequestedRef.current) return;
    hasRequestedRef.current = true;

    const allStageIds = [UNSTAGED_COLUMN_ID, ...stages.map((t) => t.id)];
    onRequestSummary(allStageIds);

    for (const stageId of allStageIds) {
      onRequestColumn(stageId, 1, COLUMN_PAGE_SIZE);
    }

    prevStageIdsRef.current = new Set(stages.map((t) => t.id));
  }, [stages, onRequestColumn, onRequestSummary, kanbanIsEmpty]);

  useEffect(() => {
    const prevStageIds: Set<string> = hasRequestedRef.current
      ? new Set(stages.map((t) => t.id))
      : new Set();
    return () => {
      const currentStageIds = new Set(stages.map((t) => t.id));
      if (
        prevStageIds.size !== currentStageIds.size ||
        [...prevStageIds].some((id: string) => !currentStageIds.has(id))
      ) {
        hasRequestedRef.current = false;
      }
    };
  }, [stages]);

  useEffect(() => {
    if (!onRequestColumn || !onRequestSummary) return;

    const currentStageIds = new Set(stages.map((t) => t.id));
    const newStageIds: string[] = [];

    for (const stageId of currentStageIds) {
      if (!prevStageIdsRef.current.has(stageId)) {
        newStageIds.push(stageId);
      }
    }

    if (newStageIds.length > 0) {
      onRequestSummary(newStageIds);
      for (const stageId of newStageIds) {
        onRequestColumn(stageId, 1, COLUMN_PAGE_SIZE);
      }
    }

    prevStageIdsRef.current = currentStageIds;
  }, [stages, onRequestColumn, onRequestSummary]);

  const columnEntries = useMemo(() => {
    const map = new Map<string, InboxEntry[]>();
    map.set(UNSTAGED_COLUMN_ID, []);

    for (const stage of stages) {
      map.set(stage.id, []);
    }

    if (funnelColumns && funnelColumns.size > 0) {
      const allKanbanEntries = new Map<string, InboxEntry>();
      for (const [, colState] of funnelColumns) {
        for (const entry of colState.entries ?? []) {
          allKanbanEntries.set(entryKeyOf(entry), entry);
        }
      }

      for (const stageId of map.keys()) {
        const colState = funnelColumns.get(stageId);
        const wsEntries = colState?.entries ?? [];
        const entriesWithOverrides: InboxEntry[] = [];

        for (const entry of wsEntries) {
          const override = optimisticMoves.get(entryKeyOf(entry));
          if (override && override !== stageId) continue;
          entriesWithOverrides.push(entry);
        }

        for (const [entryKey, targetStageId] of optimisticMoves) {
          if (targetStageId !== stageId) continue;
          if (entriesWithOverrides.some((e) => entryKeyOf(e) === entryKey)) continue;
          const entry =
            entries.find((e) => entryKeyOf(e) === entryKey) ??
            allKanbanEntries.get(entryKey);
          if (entry) {
            entriesWithOverrides.push(entry);
          }
        }

        map.set(stageId, entriesWithOverrides);
      }
      return map;
    }

    for (const entry of entries) {
      const override = optimisticMoves.get(entryKeyOf(entry));
      if (override && map.has(override)) {
        map.get(override)!.push(entry);
        continue;
      }

      const entryStage = entry.stage;
      if (!entryStage) {
        map.get(UNSTAGED_COLUMN_ID)!.push(entry);
        continue;
      }

      if (map.has(entryStage.stage_id)) {
        map.get(entryStage.stage_id)!.push(entry);
      } else {
        map.get(UNSTAGED_COLUMN_ID)!.push(entry);
      }
    }

    return map;
  }, [entries, stages, optimisticMoves, funnelColumns]);

  const entryByKey = useMemo(() => {
    const map = new Map<string, InboxEntry>();
    for (const list of columnEntries.values()) {
      for (const entry of list) map.set(entryKeyOf(entry), entry);
    }
    return map;
  }, [columnEntries]);

  useEffect(() => {
    if (optimisticMoves.size === 0) return;

    const allFunnelEntries = new Map<string, InboxEntry>();
    if (funnelColumns) {
      for (const [, colState] of funnelColumns) {
        for (const entry of colState.entries ?? []) {
          allFunnelEntries.set(entryKeyOf(entry), entry);
        }
      }
    }

    const keysToRemove: string[] = [];
    for (const [entryKey, targetStageId] of optimisticMoves) {
      const landedInTarget = funnelColumns
        ?.get(targetStageId)
        ?.entries?.some((e) => entryKeyOf(e) === entryKey);
      if (landedInTarget) {
        keysToRemove.push(entryKey);
        continue;
      }
      const entry =
        entries.find((e) => entryKeyOf(e) === entryKey) ??
        allFunnelEntries.get(entryKey);
      if (!entry) {
        continue;
      }
      if (entry.stage?.stage_id === targetStageId) {
        keysToRemove.push(entryKey);
      }
    }

    if (keysToRemove.length > 0) {
      queueMicrotask(() => {
        setOptimisticMoves((prev) => {
          const next = new Map(prev);
          for (const key of keysToRemove) {
            next.delete(key);
          }
          return next;
        });
      });
    }
  }, [entries, optimisticMoves, funnelColumns]);


  const settleMove = useCallback(
    (operationId: string, entryKey: string, accepted: boolean) => {
      if (accepted) {
        movesLedgerRef.current = confirmOperation(movesLedgerRef.current, operationId).ledger;
        return;
      }
      const { ledger, snapshot } = rollbackOperation(movesLedgerRef.current, operationId);
      if (ledger === movesLedgerRef.current) return;
      movesLedgerRef.current = ledger;
      setOptimisticMoves((prev) => {
        const next = new Map(prev);
        if (snapshot === null || snapshot === undefined) next.delete(entryKey);
        else next.set(entryKey, snapshot);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const newColumnEntries = new Map<string, Set<string>>();
    for (const [colId, colEntries] of columnEntries) {
      newColumnEntries.set(colId, new Set(colEntries.map(entryKeyOf)));
    }

    const prev = prevColumnEntriesRef.current;

    if (prev.size > 0) {
      const columnsToPulse: string[] = [];
      for (const [colId, currentIds] of newColumnEntries) {
        const prevIds = prev.get(colId);
        if (!prevIds) continue;

        for (const id of currentIds) {
          if (!prevIds.has(id)) {
            columnsToPulse.push(colId);
            break;
          }
        }
      }

      if (columnsToPulse.length > 0) {
        queueMicrotask(() => {
          for (const colId of columnsToPulse) {
            triggerColumnPulse(colId);
          }
        });
      }
    }

    prevColumnEntriesRef.current = newColumnEntries;
  }, [columnEntries, triggerColumnPulse]);

  const commitMove = useCallback(
    async (entry: InboxEntry, fromColumnId: string, toColumnId: string): Promise<boolean> => {
      if (!onEntryStageChange) return false;
      const entryKey = entryKeyOf(entry);
      const operationId = crypto.randomUUID();

      setOptimisticMoves((prev) => {
        movesLedgerRef.current = beginOperation(movesLedgerRef.current, {
          id: operationId,
          target: entryKey,
          snapshot: prev.get(entryKey),
        });
        const next = new Map(prev);
        next.set(entryKey, toColumnId);
        return next;
      });

      triggerColumnPulse(toColumnId);

      const accepted =
        (await onEntryStageChange(entry.entry_id, entry.entry_type, toColumnId, fromColumnId)) !==
        false;
      settleMove(operationId, entryKey, accepted);
      return accepted;
    },
    [onEntryStageChange, triggerColumnPulse, settleMove],
  );

  const handleColumnReorder = useCallback(
    async (newOrder: string[]) => {
      if (!onStagesReorder) return;
      const sequence = ++reorderSequenceRef.current;
      setColumnOrder(newOrder);
      setIsReordering(true);
      const result = await reorderStagesAction(newOrder);
      if (sequence !== reorderSequenceRef.current) return;
      setIsReordering(false);
      if (result.error) {
        setColumnOrder([]);
        toast.error(result.error);
        return;
      }
      if (result.stages.length > 0) {
        onStagesReorder(result.stages);
      }
    },
    [onStagesReorder],
  );

  const orderedStages = useMemo(() => {
    const stageMap = new Map(stages.map((t) => [t.id, t]));
    return effectiveColumnOrder
      .map((id) => stageMap.get(id))
      .filter(Boolean) as Stage[];
  }, [stages, effectiveColumnOrder]);

  const columnName = useCallback(
    (columnId: string) =>
      columnId === UNSTAGED_COLUMN_ID
        ? t("unstaged")
        : (stages.find((s) => s.id === columnId)?.name ?? ""),
    [stages, t],
  );

  const cardLabel = useCallback(
    (cardId: string) => {
      const entry = entryByKey.get(cardId);
      return entry ? entry.lead_name || entry.lead_number : "";
    },
    [entryByKey],
  );

  const handleCardDrop = useCallback(
    ({ itemId, from, to }: { itemId: string; from: string; to: string }) => {
      const entry = entryByKey.get(itemId);
      if (!entry) return;
      if (!canUndoCardMove(from, to)) {
        void commitMove(entry, from, to);
        return;
      }
      void performReversible(
        {
          apply: () => commitMove(entry, from, to),
          inverse: () => commitMove(entry, to, from),
          labelKey: "cardMoved",
        },
        (key) => tActions(key, { column: columnName(to) }),
      );
    },
    [entryByKey, commitMove, tActions, columnName],
  );

  const drag = useBoardDrag({
    columnOrder: effectiveColumnOrder,
    columnName,
    cardLabel,
    onCardDrop: onEntryStageChange ? handleCardDrop : undefined,
    onColumnReorder: onStagesReorder ? handleColumnReorder : undefined,
  });

  const renderOverlay = (subject: BoardDragSubject) => {
    if (subject.kind === "card") {
      const entry = entryByKey.get(subject.id);
      return entry ? (
        <div className="rounded-[--radius] border border-border bg-card p-3">
          <FunnelCardBody entry={entry} />
        </div>
      ) : null;
    }
    const stage = stages.find((s) => s.id === subject.columnId);
    return stage ? (
      <KanbanColumnShell
        columnId={stage.id}
        name={stage.name}
        color={stage.color}
        count={
          funnelColumns?.get(stage.id)?.totalItems ??
          funnelSummary?.get(stage.id) ??
          (columnEntries.get(stage.id)?.length ?? 0)
        }
      >
        {null}
      </KanbanColumnShell>
    ) : null;
  };

  const toggleLabelMenu = (entryKey: string) =>
    setLabelMenuEntryId(labelMenuEntryId === entryKey ? null : entryKey);

  const unstagedEntries = columnEntries.get(UNSTAGED_COLUMN_ID) ?? [];
  const unstagedTotal =
    funnelColumns?.get(UNSTAGED_COLUMN_ID)?.totalItems ??
    funnelSummary?.get(UNSTAGED_COLUMN_ID);
  const unstagedLoading = loadingFunnelColumn === UNSTAGED_COLUMN_ID;

  return (
    <div className="flex h-full flex-col">
      <AnimatePresence>
        {isReordering && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center py-1 overflow-hidden"
          >
            <span role="status" className="text-2xs text-muted-foreground animate-pulse">
              {t("savingOrder")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <BoardDragArea
          drag={drag}
          reorderableColumnIds={onStagesReorder ? effectiveColumnOrder : []}
          renderOverlay={renderOverlay}
        >
          <LayoutGroup>
            <div className="flex gap-3 p-4 h-full min-w-max">
              {orderedStages.map((stage) => {
                const columnState = funnelColumns?.get(stage.id);
                const totalItems =
                  columnState?.totalItems ?? funnelSummary?.get(stage.id);
                const isLoading =
                  loadingFunnelColumn === stage.id ||
                  (columnState?.loading ?? false);

                return (
                  <BoardColumn
                    key={stage.id}
                    columnId={stage.id}
                    reorderable={Boolean(onStagesReorder)}
                  >
                    {({ isCardOver, dragHandle }) => (
                      <FunnelColumn
                        stage={stage}
                        entries={columnEntries.get(stage.id) ?? []}
                        selectedEntryId={selectedEntryId}
                        onSelect={onSelect}
                        isDragOver={isCardOver}
                        isPulsing={pulsingColumns.has(stage.id)}
                        canDrag={!!onEntryStageChange}
                        dragHandle={dragHandle}
                        collapsed={isCollapsed(stage.id)}
                        onToggleCollapsed={() => toggleCollapsed(stage.id)}
                        totalItems={totalItems}
                        isLoading={isLoading}
                        currentPage={columnState?.page ?? 1}
                        pageSize={COLUMN_PAGE_SIZE}
                        onLoadMore={
                          onRequestColumn
                            ? () => {
                                const page = columnState?.page ?? 1;
                                onRequestColumn(stage.id, page + 1, COLUMN_PAGE_SIZE);
                              }
                            : undefined
                        }
                        availableLabels={availableLabels}
                        onAssignLabel={onAssignLabel}
                        onRemoveLabel={onRemoveLabel}
                        onRequestMoveToFunnel={
                          canMoveAcrossFunnels ? setMovingEntry : undefined
                        }
                        labelMenuEntryId={labelMenuEntryId}
                        onLabelMenuToggle={toggleLabelMenu}
                      />
                    )}
                  </BoardColumn>
                );
              })}

              <AnimatePresence>
                {(unstagedEntries.length > 0 ||
                  (funnelSummary?.get(UNSTAGED_COLUMN_ID) ?? 0) > 0) && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="flex-shrink-0 h-full flex flex-col"
                  >
                    <div className="h-[18px] flex-shrink-0" />
                    <div className="min-h-0 flex-1">
                      <BoardColumn columnId={UNSTAGED_COLUMN_ID}>
                        {({ isCardOver }) => (
                          <KanbanColumnShell
                            columnId={UNSTAGED_COLUMN_ID}
                            name={t("unstaged")}
                            dashed
                            count={
                              funnelSummary?.get(UNSTAGED_COLUMN_ID) ??
                              unstagedEntries.length
                            }
                            isDragOver={isCardOver}
                            pulsing={pulsingColumns.has(UNSTAGED_COLUMN_ID)}
                            collapsed={isCollapsed(UNSTAGED_COLUMN_ID)}
                            onToggleCollapsed={() => toggleCollapsed(UNSTAGED_COLUMN_ID)}
                          >
                            <AnimatePresence initial={false} mode="popLayout">
                              {unstagedEntries.map((entry) => {
                                const entryKey = entryKeyOf(entry);
                                return (
                                  <FunnelCard
                                    key={entryKey}
                                    entry={entry}
                                    columnId={UNSTAGED_COLUMN_ID}
                                    isSelected={entry.entry_id === selectedEntryId}
                                    onSelect={() =>
                                      onSelect(entry.entry_id, entry.entry_type)
                                    }
                                    canDrag={!!onEntryStageChange}
                                    availableLabels={availableLabels}
                                    onAssignLabel={onAssignLabel}
                                    onRemoveLabel={onRemoveLabel}
                                    onRequestMoveToFunnel={
                                      canMoveAcrossFunnels ? setMovingEntry : undefined
                                    }
                                    labelMenuOpen={labelMenuEntryId === entryKey}
                                    onLabelMenuToggle={() => toggleLabelMenu(entryKey)}
                                  />
                                );
                              })}
                            </AnimatePresence>

                            {unstagedLoading && (
                              <div className="flex items-center justify-center py-2">
                                <div className="h-4 w-4 animate-spin rounded-full border border-foreground/20 border-t-primary" />
                              </div>
                            )}

                            {unstagedTotal !== undefined &&
                            unstagedEntries.length < unstagedTotal &&
                            !unstagedLoading &&
                            onRequestColumn ? (
                              <button
                                onClick={() => {
                                  const page =
                                    funnelColumns?.get(UNSTAGED_COLUMN_ID)?.page ?? 1;
                                  onRequestColumn(UNSTAGED_COLUMN_ID, page + 1, COLUMN_PAGE_SIZE);
                                }}
                                className="w-full py-2 text-2xs font-medium text-muted-foreground hover:text-healthy-ink hover:bg-muted rounded-lg transition-colors"
                              >
                                {t("loadMore", {
                                  shown: unstagedEntries.length,
                                  total: unstagedTotal,
                                })}
                              </button>
                            ) : null}
                          </KanbanColumnShell>
                        )}
                      </BoardColumn>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        </BoardDragArea>
      </div>

      {canMoveAcrossFunnels && onMoveToFunnel && movingEntry ? (
        <MoveToFunnelDialog
          open
          onOpenChange={(next) => {
            if (!next) setMovingEntry(null);
          }}
          funnels={funnelStages}
          currentStageId={movingEntry.stage?.stage_id ?? null}
          currentStageName={movingEntry.stage?.name ?? null}
          contactName={movingEntry.lead_name || movingEntry.lead_number}
          onConfirm={(stageId) =>
            onMoveToFunnel(
              movingEntry.entry_id,
              movingEntry.entry_type,
              stageId,
            )
          }
        />
      ) : null}
    </div>
  );
}
