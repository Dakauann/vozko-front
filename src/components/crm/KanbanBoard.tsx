"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Plus } from "@/components/icons";
import { cn } from "@/lib/utils";
import KanbanColumnShell from "@/components/crm/KanbanColumnShell";
import BoardColumn from "@/components/crm/kanban/BoardColumn";
import BoardDragArea from "@/components/crm/kanban/BoardDragArea";
import {
  kanbanCardFocusClass,
  kanbanCardGhostClass,
  kanbanCardHover,
  kanbanCardTransition,
  kanbanCardVariants,
} from "@/components/crm/kanban-card";
import { useBoardCard, useBoardDrag } from "@/hooks/use-board-drag";
import { useCollapsedColumns } from "@/hooks/use-collapsed-columns";
import { useColumnPulse } from "@/hooks/use-column-pulse";
import type { BoardDragSubject } from "@/lib/crm/board-drag";
import type { CollapsedColumnsBoard } from "@/lib/crm/collapsed-columns";


interface KanbanColumnModel {
  id: string;
  name: string;
  color?: string;
  count: number;
  headerExtra?: ReactNode;
}

interface KanbanBoardProps<T> {
  board: CollapsedColumnsBoard;
  columns: KanbanColumnModel[];
  itemsFor: (columnId: string) => T[];
  getItemId: (item: T) => string;
  cardLabel: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onCardOpen: (item: T) => void;
  onCardMove?: (item: T, fromColumnId: string, toColumnId: string) => void;
  onAddCard?: (columnId: string) => void;
  emptyLabel?: string;
  addLabel?: string;
  canEdit?: boolean;
  className?: string;
}

function KanbanBoardCard({
  id,
  columnId,
  draggable,
  onOpen,
  children,
}: {
  id: string;
  columnId: string;
  draggable: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  const { cardProps, isDragging } = useBoardCard({ id, columnId, draggable, onOpen });

  return (
    <motion.div
      {...cardProps}
      layout="position"
      layoutId={id}
      variants={kanbanCardVariants}
      initial={false}
      animate="animate"
      exit="exit"
      transition={kanbanCardTransition}
      whileHover={draggable && !isDragging ? kanbanCardHover : undefined}
      onClick={onOpen}
      className={cn(
        "will-change-transform select-none rounded-lg",
        kanbanCardFocusClass,
        isDragging
          ? kanbanCardGhostClass
          : draggable
            ? "cursor-grab touch-manipulation active:cursor-grabbing"
            : "cursor-pointer",
      )}
    >
      <div className={isDragging ? "invisible" : undefined}>{children}</div>
    </motion.div>
  );
}

export default function KanbanBoard<T>({
  board,
  columns,
  itemsFor,
  getItemId,
  cardLabel,
  renderCard,
  onCardOpen,
  onCardMove,
  onAddCard,
  emptyLabel,
  addLabel,
  canEdit = true,
  className,
}: KanbanBoardProps<T>) {
  const t = useTranslations("crmKanban");
  const { pulsing, pulse } = useColumnPulse();
  const { isCollapsed, toggle } = useCollapsedColumns(board);

  const placed = useMemo(() => {
    const byId = new Map<string, { item: T; columnId: string }>();
    for (const col of columns) {
      for (const item of itemsFor(col.id)) byId.set(getItemId(item), { item, columnId: col.id });
    }
    return byId;
  }, [columns, itemsFor, getItemId]);

  const columnOrder = useMemo(() => columns.map((c) => c.id), [columns]);

  const columnName = useCallback(
    (columnId: string) => columns.find((c) => c.id === columnId)?.name ?? "",
    [columns],
  );

  const labelOfCard = useCallback(
    (cardId: string) => {
      const found = placed.get(cardId);
      return found ? cardLabel(found.item) : "";
    },
    [placed, cardLabel],
  );

  const onCardDrop = useCallback(
    ({ itemId, from, to }: { itemId: string; from: string; to: string }) => {
      const found = placed.get(itemId);
      if (!found || !onCardMove) return;
      pulse(to);
      onCardMove(found.item, from, to);
    },
    [placed, onCardMove, pulse],
  );

  const drag = useBoardDrag({
    columnOrder,
    columnName,
    cardLabel: labelOfCard,
    onCardDrop,
  });

  const renderOverlay = (subject: BoardDragSubject) => {
    const found = subject.kind === "card" ? placed.get(subject.id) : undefined;
    return found ? renderCard(found.item) : null;
  };

  return (
    <BoardDragArea drag={drag} renderOverlay={renderOverlay}>
      <LayoutGroup>
        <div className={cn("flex h-full min-w-max gap-3 p-4", className)}>
          {columns.map((col) => {
            const items = itemsFor(col.id);
            return (
              <BoardColumn key={col.id} columnId={col.id}>
                {({ isCardOver }) => (
                  <KanbanColumnShell
                    columnId={col.id}
                    name={col.name}
                    color={col.color}
                    count={col.count}
                    headerExtra={col.headerExtra}
                    isDragOver={isCardOver}
                    pulsing={pulsing.has(col.id)}
                    collapsed={isCollapsed(col.id)}
                    onToggleCollapsed={() => toggle(col.id)}
                    footer={
                      canEdit && onAddCard ? (
                        <button
                          type="button"
                          onClick={() => onAddCard(col.id)}
                          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-2xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary-ink"
                        >
                          <Plus weight="bold" className="h-3 w-3" />
                          {addLabel ?? t("add")}
                        </button>
                      ) : undefined
                    }
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {items.map((item) => {
                        const id = getItemId(item);
                        return (
                          <KanbanBoardCard
                            key={id}
                            id={id}
                            columnId={col.id}
                            draggable={Boolean(onCardMove)}
                            onOpen={() => onCardOpen(item)}
                          >
                            {renderCard(item)}
                          </KanbanBoardCard>
                        );
                      })}

                      {items.length === 0 ? (
                        <motion.div
                          key="__empty__"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-control-edge px-3 py-8 text-center"
                          style={col.color ? { borderColor: col.color } : undefined}
                        >
                          <span
                            aria-hidden
                            className="h-1.5 w-6 rounded-full bg-control-edge"
                            style={col.color ? { backgroundColor: col.color } : undefined}
                          />
                          <span className="text-2xs font-medium text-muted-foreground">
                            {emptyLabel ?? t("empty")}
                          </span>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </KanbanColumnShell>
                )}
              </BoardColumn>
            );
          })}
        </div>
      </LayoutGroup>
    </BoardDragArea>
  );
}
