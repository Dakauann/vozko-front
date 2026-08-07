"use client";

import {
  AnimatePresence,
  LayoutGroup,
  Reorder,
  motion,
  useDragControls,
} from "framer-motion";
import { Check, Circle, User } from "@/components/icons";
import type {
  EntryType,
  InboxEntry,
  Label,
  Stage,
} from "@/lib/conversations/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { reorderStagesAction } from "@/app/actions/stages";
import AnalysisHoverCard from "@/components/crm/AnalysisHoverCard";
import KanbanColumnShell from "@/components/crm/KanbanColumnShell";
import { ChannelAvatar } from "@/components/channels/channel-avatar";
import {
  CardPill,
  CardLabelChip,
  KanbanCard,
  kanbanCardClass,
  kanbanCardVariants,
  kanbanCardTransition,
  kanbanCardHover,
  kanbanCardGhostClass,
  kanbanDragOverlayInitial,
  kanbanDragOverlayAnimate,
  kanbanDragOverlayTransition,
} from "@/components/crm/kanban-card";
import { useWorkspace } from "@/contexts/workspace-context";


function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD < 7) return `${diffD}d`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(isoDate));
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}


import type { FunnelColumnState } from "@/hooks/use-conversation-ws";

interface CrmFunnelViewProps {
  entries: InboxEntry[];
  stages: Stage[];
  selectedEntryId: string | null;
  onSelect: (entryId: string, entryType: EntryType) => void;
  onStagesReorder: (stages: Stage[]) => void;
  onEntryStageChange?: (
    entryId: string,
    entryType: EntryType,
    newStageId: string,
    oldStageId: string | null,
  ) => void;
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
}

let _skipCardClick = false;


function FunnelCardBody({ entry }: { entry: InboxEntry }) {
  const hasUnread = entry.unread_count > 0;

  const labels = entry.labels ?? [];

  return (
    <KanbanCard
      strongTitle={hasUnread}
      // The same avatar the inbox uses: the person owns the circle and the
      // channel is a badge on it. The board previously showed a WhatsApp glyph
      // or a bare initial, so an Instagram or Telegram card was indistinguishable
      // from one with no channel at all.
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
        <p className="truncate text-[11px] text-muted-foreground">
          {relativeTime(entry.last_message_at)}
        </p>
      }
      rightSlot={
        hasUnread ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-[--radius] bg-healthy px-1 text-[11px] font-semibold text-healthy-foreground">
            {entry.unread_count > 99 ? "99+" : entry.unread_count}
          </span>
        ) : undefined
      }
      body={
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {truncate(entry.last_message_preview, 80)}
        </p>
      }
      pills={
        <>
          {entry.window_open ? (
            <CardPill tone="success" icon={<Circle weight="fill" className="h-1.5 w-1.5" />}>
              Ativa
            </CardPill>
          ) : (
            <CardPill tone="warning" icon={<Circle weight="fill" className="h-1.5 w-1.5" />}>
              Fechada
            </CardPill>
          )}
          {entry.assigned_username ? (
            <CardPill
              tone="info"
              className="max-w-[50%]"
              icon={<User weight="bold" className="h-2.5 w-2.5 flex-shrink-0" />}
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
              <span className="inline-flex items-center rounded-[--radius] bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-sm">
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
  isDragGhost,
  onPointerDownForDrag,
  canDrag = true,
  availableLabels,
  onAssignLabel,
  onRemoveLabel,
  labelMenuOpen,
  onLabelMenuToggle,
}: {
  entry: InboxEntry;
  /** The column this card instance lives in, scopes the layoutId so the SAME
   *  entry appearing in multiple columns (label/owner axes) doesn't collide and
   *  fling horizontally under framer's shared-layout animation. */
  columnId: string;
  isSelected: boolean;
  onSelect: () => void;
  isDragGhost: boolean;
  onPointerDownForDrag: (e: React.PointerEvent<HTMLDivElement>) => void;
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
  labelMenuOpen?: boolean;
  onLabelMenuToggle?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { can } = useWorkspace();
  const canReadAnalysis = can("analysis", "read");

  if (isDragGhost) {
    return (
      <div className={cn(kanbanCardGhostClass, "p-3")}>
        <div className="invisible">
          <FunnelCardBody entry={entry} />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      layout="position"
      layoutId={`kanban-card-${columnId}-${entry.entry_type}-${entry.entry_id}`}
      onMouseEnter={() => {
        if (canReadAnalysis && entry.latest_analysis) setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      variants={kanbanCardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={kanbanCardTransition}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDownForDrag(e);
      }}
      onClick={() => {
        if (_skipCardClick) return;
        onSelect();
      }}
      className={kanbanCardClass(
        { selected: isSelected },
        cn(
          "will-change-transform select-none",
          canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        ),
      )}
      whileHover={kanbanCardHover}
      onContextMenu={(e) => {
        if (
          availableLabels &&
          availableLabels.length > 0 &&
          onLabelMenuToggle
        ) {
          e.preventDefault();
          e.stopPropagation();
          onLabelMenuToggle();
        }
      }}
    >
      <FunnelCardBody entry={entry} />

      {/* Label context menu (right-click) */}
      {labelMenuOpen && availableLabels && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              onLabelMenuToggle?.();
            }}
          />
          <div className="absolute right-2 top-10 z-50 w-48 rounded-[--radius] border border-border bg-card shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
              Labels
            </div>
            <div className="max-h-44 overflow-y-auto">
              {availableLabels.map((label) => {
                const isAssigned = entry.labels?.some(
                  (l) => l.label_id === label.id,
                );
                return (
                  <button
                    key={label.id}
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
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-muted"
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
          </div>
        </>
      )}

      {/* Analysis hover card */}
      {canReadAnalysis && entry.latest_analysis && (
        <AnalysisHoverCard
          analysis={entry.latest_analysis}
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
  isDraggingCardKey,
  onCardPointerDown,
  canDrag = true,
  onStartColumnDrag,
  totalItems,
  isLoading,
  onLoadMore,
  currentPage,
  pageSize,
  availableLabels,
  onAssignLabel,
  onRemoveLabel,
  labelMenuEntryId,
  onLabelMenuToggle,
}: {
  stage: Stage;
  entries: InboxEntry[];
  selectedEntryId: string | null;
  onSelect: (entryId: string, entryType: EntryType) => void;
  isDragOver: boolean;
  isPulsing: boolean;
  isDraggingCardKey: string | null;
  onCardPointerDown: (
    e: React.PointerEvent<HTMLDivElement>,
    entry: InboxEntry,
    sourceStageId: string,
  ) => void;
  canDrag?: boolean;
  onStartColumnDrag?: (e: React.PointerEvent<HTMLDivElement>) => void;
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
  onLabelMenuToggle?: (entryKey: string) => void;
}) {
  const pSize = pageSize ?? 20;
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
      countKey={totalItems ?? entries.length}
      isDragOver={isDragOver}
      pulsing={isPulsing}
      onStartColumnDrag={onStartColumnDrag}
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
            <p className="text-[11px] text-muted-foreground italic">
              Nenhuma conversa
            </p>
          </motion.div>
        ) : (
          entries.map((entry) => {
            const entryKey = `${entry.entry_type}-${entry.entry_id}`;
            return (
              <FunnelCard
                key={entryKey}
                entry={entry}
                columnId={stage.id}
                isSelected={entry.entry_id === selectedEntryId}
                onSelect={() => onSelect(entry.entry_id, entry.entry_type)}
                isDragGhost={isDraggingCardKey === entryKey}
                onPointerDownForDrag={(e) =>
                  onCardPointerDown(e, entry, stage.id)
                }
                canDrag={canDrag}
                availableLabels={availableLabels}
                onAssignLabel={onAssignLabel}
                onRemoveLabel={onRemoveLabel}
                labelMenuOpen={labelMenuEntryId === entryKey}
                onLabelMenuToggle={() => onLabelMenuToggle?.(entryKey)}
              />
            );
          })
        )}
      </AnimatePresence>

      {/* Load More / Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-2">
          <div className="h-4 w-4 animate-spin rounded-full border border-foreground/20 border-t-emerald-500" />
        </div>
      )}
      {/* Sentinel for infinite scroll */}
      {hasMore && !isLoading && (
        <div ref={sentinelRef} className="h-8 flex items-center justify-center">
          <span className="text-[11px] text-muted-foreground">
            {entries.length} de {totalItems}
          </span>
        </div>
      )}
    </KanbanColumnShell>
  );
}


function ReorderableColumn({
  stage,
  children,
}: {
  stage: Stage;
  children: (startDrag: (e: React.PointerEvent) => void) => React.ReactNode;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      key={stage.id}
      value={stage.id}
      dragListener={false}
      dragControls={controls}
      className="flex-shrink-0 h-full"
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 10px 40px -10px rgba(0,0,0,0.15)",
        cursor: "grabbing",
      }}
    >
      {children((e) => controls.start(e))}
    </Reorder.Item>
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
}: CrmFunnelViewProps) {
  const defaultColumnOrder = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position).map((t) => t.id),
    [stages],
  );
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const [pulsingColumns, setPulsingColumns] = useState<Set<string>>(new Set());
  const [labelMenuEntryId, setLabelMenuEntryId] = useState<string | null>(null);
  const [optimisticMoves, setOptimisticMoves] = useState<Map<string, string>>(
    new Map(),
  );

  const [isDraggingCard, setIsDraggingCard] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [dragOverlayData, setDragOverlayData] = useState<{
    entry: InboxEntry;
    width: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const dragOverlayRef = useRef<HTMLDivElement>(null);
  const dragDataRef = useRef<{
    entry: InboxEntry;
    sourceStageId: string;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    initialX: number;
    initialY: number;
  } | null>(null);
  const pendingDragRef = useRef<{
    entry: InboxEntry;
    sourceStageId: string;
    startX: number;
    startY: number;
    rect: DOMRect;
  } | null>(null);
  const currentDragOverRef = useRef<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevColumnEntriesRef = useRef<Map<string, Set<string>>>(new Map());
  const pulseTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

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

    const allStageIds = ["__unstaged__", ...stages.map((t) => t.id)];
    onRequestSummary(allStageIds);

    for (const stageId of allStageIds) {
      onRequestColumn(stageId, 1, 20);
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
        onRequestColumn(stageId, 1, 20);
      }
    }

    prevStageIdsRef.current = currentStageIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages, onRequestColumn, onRequestSummary]);

  const columnEntries = useMemo(() => {
    const map = new Map<string, InboxEntry[]>();
    map.set("__unstaged__", []);

    for (const stage of stages) {
      map.set(stage.id, []);
    }

    if (funnelColumns && funnelColumns.size > 0) {
      const allKanbanEntries = new Map<string, InboxEntry>();
      for (const [, colState] of funnelColumns) {
        for (const entry of colState.entries ?? []) {
          const entryKey = `${entry.entry_type}-${entry.entry_id}`;
          allKanbanEntries.set(entryKey, entry);
        }
      }

      for (const stageId of map.keys()) {
        const colState = funnelColumns.get(stageId);
        const wsEntries = colState?.entries ?? [];
        const entriesWithOverrides: InboxEntry[] = [];

        for (const entry of wsEntries) {
          const entryKey = `${entry.entry_type}-${entry.entry_id}`;
          const override = optimisticMoves.get(entryKey);
          if (override && override !== stageId) continue;
          entriesWithOverrides.push(entry);
        }

        for (const [entryKey, targetStageId] of optimisticMoves) {
          if (targetStageId !== stageId) continue;
          if (
            entriesWithOverrides.some(
              (e) => `${e.entry_type}-${e.entry_id}` === entryKey,
            )
          )
            continue;
          let entry = entries.find(
            (e) => `${e.entry_type}-${e.entry_id}` === entryKey,
          );
          if (!entry) {
            entry = allKanbanEntries.get(entryKey);
          }
          if (entry) {
            entriesWithOverrides.push(entry);
          }
        }

        map.set(stageId, entriesWithOverrides);
      }
      return map;
    }

    for (const entry of entries) {
      const entryKey = `${entry.entry_type}-${entry.entry_id}`;

      const override = optimisticMoves.get(entryKey);
      if (override && map.has(override)) {
        map.get(override)!.push(entry);
        continue;
      }

      const entryStage = entry.stage;
      if (!entryStage) {
        map.get("__unstaged__")!.push(entry);
        continue;
      }

      if (map.has(entryStage.stage_id)) {
        map.get(entryStage.stage_id)!.push(entry);
      } else {
        map.get("__unstaged__")!.push(entry);
      }
    }

    return map;
  }, [entries, stages, optimisticMoves, funnelColumns]);

  useEffect(() => {
    if (optimisticMoves.size === 0) return;

    const allFunnelEntries = new Map<string, InboxEntry>();
    if (funnelColumns) {
      for (const [, colState] of funnelColumns) {
        for (const entry of colState.entries ?? []) {
          const entryKey = `${entry.entry_type}-${entry.entry_id}`;
          allFunnelEntries.set(entryKey, entry);
        }
      }
    }

    const keysToRemove: string[] = [];
    for (const [entryKey, targetStageId] of optimisticMoves) {
      let entry = entries.find(
        (e) => `${e.entry_type}-${e.entry_id}` === entryKey,
      );
      if (!entry) {
        entry = allFunnelEntries.get(entryKey);
      }
      if (!entry) {
        continue;
      }
      const realStage = entry.stage;
      if (realStage?.stage_id === targetStageId) {
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


  const triggerColumnPulse = useCallback((columnId: string) => {
    const existingTimer = pulseTimersRef.current.get(columnId);
    if (existingTimer) clearTimeout(existingTimer);

    setPulsingColumns((prev) => {
      const next = new Set(prev);
      next.add(columnId);
      return next;
    });

    const timer = setTimeout(() => {
      setPulsingColumns((prev) => {
        const next = new Set(prev);
        next.delete(columnId);
        return next;
      });
      pulseTimersRef.current.delete(columnId);
    }, 750);

    pulseTimersRef.current.set(columnId, timer);
  }, []);

  useEffect(() => {
    const newColumnEntries = new Map<string, Set<string>>();
    for (const [colId, colEntries] of columnEntries) {
      newColumnEntries.set(
        colId,
        new Set(colEntries.map((e) => `${e.entry_type}-${e.entry_id}`)),
      );
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

  useEffect(() => {
    const timers = pulseTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);


  const handleCardPointerDown = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      entry: InboxEntry,
      sourceStageId: string,
    ) => {
      if (e.button !== 0) return; 
      if (!onEntryStageChange) return; 
      const rect = e.currentTarget.getBoundingClientRect();
      pendingDragRef.current = {
        entry,
        sourceStageId,
        startX: e.clientX,
        startY: e.clientY,
        rect,
      };
    },
    [onEntryStageChange],
  );

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const pending = pendingDragRef.current;

      if (pending && !dragDataRef.current) {
        const dx = e.clientX - pending.startX;
        const dy = e.clientY - pending.startY;
        if (Math.abs(dx) + Math.abs(dy) > 5) {
          dragDataRef.current = {
            entry: pending.entry,
            sourceStageId: pending.sourceStageId,
            offsetX: pending.startX - pending.rect.left,
            offsetY: pending.startY - pending.rect.top,
            width: pending.rect.width,
            height: pending.rect.height,
            initialX: pending.rect.left,
            initialY: pending.rect.top,
          };
          setIsDraggingCard(
            `${pending.entry.entry_type}-${pending.entry.entry_id}`,
          );
          setDragOverlayData({
            entry: pending.entry,
            width: pending.rect.width,
            initialX: pending.rect.left,
            initialY: pending.rect.top,
          });
          pendingDragRef.current = null;
        }
        return;
      }

      if (dragDataRef.current && dragOverlayRef.current) {
        const dd = dragDataRef.current;
        const x = e.clientX - dd.offsetX;
        const y = e.clientY - dd.offsetY;
        dragOverlayRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let colId: string | null = null;
        for (const el of elements) {
          const attr = (el as HTMLElement).dataset?.columnId;
          if (attr) {
            colId = attr;
            break;
          }
        }
        if (colId !== currentDragOverRef.current) {
          currentDragOverRef.current = colId;
          setDragOverColumnId(colId);
        }
      }
    };

    const handlePointerUp = () => {
      const dd = dragDataRef.current;
      const targetColId = currentDragOverRef.current;

      if (
        dd &&
        targetColId &&
        targetColId !== dd.sourceStageId &&
        onEntryStageChange
      ) {
        const entryKey = `${dd.entry.entry_type}-${dd.entry.entry_id}`;

        setOptimisticMoves((prev) => {
          const next = new Map(prev);
          next.set(entryKey, targetColId);
          return next;
        });

        triggerColumnPulse(targetColId);

        onEntryStageChange(
          dd.entry.entry_id,
          dd.entry.entry_type,
          targetColId,
          dd.sourceStageId,
        );
      }

      if (dragDataRef.current) {
        _skipCardClick = true;
        requestAnimationFrame(() => {
          _skipCardClick = false;
        });
      }

      pendingDragRef.current = null;
      dragDataRef.current = null;
      currentDragOverRef.current = null;
      setIsDraggingCard(null);
      setDragOverColumnId(null);
      setDragOverlayData(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onEntryStageChange, triggerColumnPulse]);

  useEffect(() => {
    if (isDraggingCard) {
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDraggingCard]);

  const handleColumnReorder = useCallback(
    async (newOrder: string[]) => {
      setColumnOrder(newOrder);
      setIsReordering(true);
      const result = await reorderStagesAction(newOrder);
      if (!result.error && result.stages.length > 0) {
        onStagesReorder(result.stages);
      }
      setIsReordering(false);
    },
    [onStagesReorder],
  );

  const orderedStages = useMemo(() => {
    const stageMap = new Map(stages.map((t) => [t.id, t]));
    return effectiveColumnOrder
      .map((id) => stageMap.get(id))
      .filter(Boolean) as Stage[];
  }, [stages, effectiveColumnOrder]);

  const unstagedEntries = columnEntries.get("__unstaged__") ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Reorder handle hint */}
      <AnimatePresence>
        {isReordering && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center py-1 overflow-hidden"
          >
            <span className="text-[11px] text-muted-foreground animate-pulse">
              Salvando ordem...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Funnel columns */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden"
      >
        <LayoutGroup>
          <Reorder.Group
            axis="x"
            values={effectiveColumnOrder}
            onReorder={handleColumnReorder}
            className="flex gap-3 p-4 h-full min-w-max"
          >
            {orderedStages.map((stage) => {
              const columnState = funnelColumns?.get(stage.id);
              const totalItems =
                columnState?.totalItems ?? funnelSummary?.get(stage.id);
              const isLoading =
                loadingFunnelColumn === stage.id ||
                (columnState?.loading ?? false);

              return (
                <ReorderableColumn key={stage.id} stage={stage}>
                  {(startDrag) => (
                    <FunnelColumn
                      stage={stage}
                      entries={columnEntries.get(stage.id) ?? []}
                      selectedEntryId={selectedEntryId}
                      onSelect={onSelect}
                      isDragOver={dragOverColumnId === stage.id}
                      isPulsing={pulsingColumns.has(stage.id)}
                      isDraggingCardKey={isDraggingCard}
                      onCardPointerDown={handleCardPointerDown}
                      canDrag={!!onEntryStageChange}
                      onStartColumnDrag={startDrag}
                      totalItems={totalItems}
                      isLoading={isLoading}
                      currentPage={columnState?.page ?? 1}
                      pageSize={20}
                      onLoadMore={
                        onRequestColumn
                          ? () => {
                              const page = columnState?.page ?? 1;
                              onRequestColumn(stage.id, page + 1, 20);
                            }
                          : undefined
                      }
                      availableLabels={availableLabels}
                      onAssignLabel={onAssignLabel}
                      onRemoveLabel={onRemoveLabel}
                      labelMenuEntryId={labelMenuEntryId}
                      onLabelMenuToggle={(key) =>
                        setLabelMenuEntryId(
                          labelMenuEntryId === key ? null : key,
                        )
                      }
                    />
                  )}
                </ReorderableColumn>
              );
            })}

            {/* Unstaged column */}
            <AnimatePresence>
              {(unstagedEntries.length > 0 ||
                (funnelSummary?.get("__unstaged__") ?? 0) > 0) && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="flex-shrink-0 h-full flex flex-col"
                >
                  <div className="h-[18px] flex-shrink-0" />
                  <div className="min-h-0 flex-1">
                    <KanbanColumnShell
                      columnId="__unstaged__"
                      name="Sem tag"
                      dashed
                      count={
                        funnelSummary?.get("__unstaged__") ??
                        unstagedEntries.length
                      }
                      countKey={
                        funnelSummary?.get("__unstaged__") ??
                        unstagedEntries.length
                      }
                      pulsing={pulsingColumns.has("__unstaged__")}
                    >
                      <AnimatePresence initial={false} mode="popLayout">
                        {unstagedEntries.map((entry) => {
                          const entryKey = `${entry.entry_type}-${entry.entry_id}`;
                          return (
                            <FunnelCard
                              key={entryKey}
                              entry={entry}
                              columnId="__unstaged__"
                              isSelected={entry.entry_id === selectedEntryId}
                              onSelect={() =>
                                onSelect(entry.entry_id, entry.entry_type)
                              }
                              isDragGhost={isDraggingCard === entryKey}
                              onPointerDownForDrag={(e) =>
                                handleCardPointerDown(e, entry, "__unstaged__")
                              }
                              canDrag={!!onEntryStageChange}
                              availableLabels={availableLabels}
                              onAssignLabel={onAssignLabel}
                              onRemoveLabel={onRemoveLabel}
                              labelMenuOpen={labelMenuEntryId === entryKey}
                              onLabelMenuToggle={() =>
                                setLabelMenuEntryId(
                                  labelMenuEntryId === entryKey
                                    ? null
                                    : entryKey,
                                )
                              }
                            />
                          );
                        })}
                      </AnimatePresence>

                      {/* Loading indicator for unstaged column */}
                      {loadingFunnelColumn === "__unstaged__" && (
                        <div className="flex items-center justify-center py-2">
                          <div className="h-4 w-4 animate-spin rounded-full border border-foreground/20 border-t-emerald-500" />
                        </div>
                      )}

                      {/* Load more for unstaged column */}
                      {(() => {
                        const unstagedTotal =
                          funnelColumns?.get("__unstaged__")?.totalItems ??
                          funnelSummary?.get("__unstaged__");
                        const hasMore =
                          unstagedTotal !== undefined &&
                          unstagedEntries.length < unstagedTotal;
                        const isLoading =
                          loadingFunnelColumn === "__unstaged__";
                        if (hasMore && !isLoading && onRequestColumn) {
                          return (
                            <button
                              onClick={() => {
                                const page =
                                  funnelColumns?.get("__unstaged__")?.page ?? 1;
                                onRequestColumn("__unstaged__", page + 1, 20);
                              }}
                              className="w-full py-2 text-[11px] font-medium text-muted-foreground hover:text-healthy-ink hover:bg-muted rounded-lg transition-colors"
                            >
                              Carregar mais ({unstagedEntries.length} de{" "}
                              {unstagedTotal})
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </KanbanColumnShell>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Reorder.Group>
        </LayoutGroup>
      </div>

      {/* Drag overlay Ã¢â‚¬â€œ floating card that follows the pointer */}
      {isDraggingCard && dragOverlayData && (
        <div
          ref={dragOverlayRef}
          className="fixed top-0 left-0 pointer-events-none z-[9999]"
          style={{
            width: dragOverlayData.width,
            transform: `translate3d(${dragOverlayData.initialX}px, ${dragOverlayData.initialY}px, 0)`,
          }}
        >
          <motion.div
            initial={kanbanDragOverlayInitial}
            animate={kanbanDragOverlayAnimate}
            transition={kanbanDragOverlayTransition}
            className="rounded-[--radius] border border-border bg-card p-3 cursor-grabbing"
          >
            <FunnelCardBody entry={dragOverlayData.entry} />
          </motion.div>
        </div>
      )}
    </div>
  );
}
