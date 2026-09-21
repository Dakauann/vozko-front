"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Plus } from "@/components/icons";
import { cn } from "@/lib/utils";
import KanbanColumnShell from "@/components/crm/KanbanColumnShell";
import {
  kanbanCardGhostClass,
  kanbanCardHover,
  kanbanCardTransition,
  kanbanCardVariants,
  kanbanDragOverlayAnimate,
  kanbanDragOverlayInitial,
  kanbanDragOverlayTransition,
} from "@/components/crm/kanban-card";


export interface KanbanColumnModel {
  id: string;
  name: string;
  color?: string;
  count: number;
  headerExtra?: ReactNode;
}

interface KanbanBoardProps<T> {
  columns: KanbanColumnModel[];
  itemsFor: (columnId: string) => T[];
  getItemId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onCardMove?: (item: T, fromColumnId: string, toColumnId: string) => void;
  columnOfItem: (item: T) => string;
  onAddCard?: (columnId: string) => void;
  emptyLabel?: string;
  addLabel?: string;
  canEdit?: boolean;
  className?: string;
}

export default function KanbanBoard<T>({
  columns,
  itemsFor,
  getItemId,
  renderCard,
  onCardMove,
  columnOfItem,
  onAddCard,
  emptyLabel = "Vazio",
  addLabel = "Adicionar",
  canEdit = true,
  className,
}: KanbanBoardProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [pulsingCols, setPulsingCols] = useState<Set<string>>(new Set());
  const [overlay, setOverlay] = useState<{
    item: T;
    width: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  const overlayElRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<{
    item: T;
    from: string;
    startX: number;
    startY: number;
    rect: DOMRect;
  } | null>(null);
  const dragRef = useRef<{ item: T; from: string; offsetX: number; offsetY: number } | null>(
    null,
  );
  const overColRef = useRef<string | null>(null);
  const justDraggedRef = useRef(false);
  const pulseTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const triggerPulse = useCallback((colId: string) => {
    const existing = pulseTimers.current.get(colId);
    if (existing) clearTimeout(existing);
    setPulsingCols((prev) => {
      const next = new Set(prev);
      next.add(colId);
      return next;
    });
    const timer = setTimeout(() => {
      setPulsingCols((prev) => {
        const next = new Set(prev);
        next.delete(colId);
        return next;
      });
      pulseTimers.current.delete(colId);
    }, 750);
    pulseTimers.current.set(colId, timer);
  }, []);

  useEffect(() => {
    const timers = pulseTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  const onCardPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, item: T) => {
      if (e.button !== 0 || !onCardMove) return;
      const rect = e.currentTarget.getBoundingClientRect();
      pendingRef.current = {
        item,
        from: columnOfItem(item),
        startX: e.clientX,
        startY: e.clientY,
        rect,
      };
    },
    [onCardMove, columnOfItem],
  );

  useEffect(() => {
    if (!onCardMove) return;

    const handleMove = (e: PointerEvent) => {
      const pending = pendingRef.current;
      if (pending && !dragRef.current) {
        const dx = e.clientX - pending.startX;
        const dy = e.clientY - pending.startY;
        if (Math.abs(dx) + Math.abs(dy) > 5) {
          dragRef.current = {
            item: pending.item,
            from: pending.from,
            offsetX: pending.startX - pending.rect.left,
            offsetY: pending.startY - pending.rect.top,
          };
          setDraggingId(getItemId(pending.item));
          setOverlay({
            item: pending.item,
            width: pending.rect.width,
            initialX: pending.rect.left,
            initialY: pending.rect.top,
          });
          pendingRef.current = null;
        }
        return;
      }

      if (dragRef.current && overlayElRef.current) {
        const d = dragRef.current;
        overlayElRef.current.style.transform = `translate3d(${e.clientX - d.offsetX}px, ${
          e.clientY - d.offsetY
        }px, 0)`;

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let colId: string | null = null;
        for (const el of elements) {
          const attr = (el as HTMLElement).dataset?.columnId;
          if (attr) {
            colId = attr;
            break;
          }
        }
        if (colId !== overColRef.current) {
          overColRef.current = colId;
          setDragOverCol(colId);
        }
      }
    };

    const handleUp = () => {
      const d = dragRef.current;
      const target = overColRef.current;

      if (d) {
        justDraggedRef.current = true;
        if (target && target !== d.from) {
          triggerPulse(target);
          onCardMove(d.item, d.from, target);
        }
      }

      pendingRef.current = null;
      dragRef.current = null;
      overColRef.current = null;
      setDraggingId(null);
      setDragOverCol(null);
      setOverlay(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [onCardMove, getItemId, triggerPulse]);

  useEffect(() => {
    if (draggingId) {
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
  }, [draggingId]);

  return (
    <LayoutGroup>
      <div className={cn("flex h-full min-w-max gap-3 p-4", className)}>
        {columns.map((col) => {
          const items = itemsFor(col.id);
          return (
            <KanbanColumnShell
              key={col.id}
              columnId={col.id}
              name={col.name}
              color={col.color}
              count={col.count}
              countKey={col.count}
              headerExtra={col.headerExtra}
              isDragOver={dragOverCol === col.id}
              pulsing={pulsingCols.has(col.id)}
              footer={
                canEdit && onAddCard ? (
                  <button
                    type="button"
                    onClick={() => onAddCard(col.id)}
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-2xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary-ink"
                  >
                    <Plus weight="bold" className="h-3 w-3" />
                    {addLabel}
                  </button>
                ) : undefined
              }
            >
              <AnimatePresence initial={false} mode="popLayout">
                {items.map((item) => {
                  const id = getItemId(item);

                  if (draggingId === id) {
                    return (
                      <motion.div key={id} layout="position" layoutId={id} className={kanbanCardGhostClass}>
                        <div className="invisible">{renderCard(item)}</div>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div
                      key={id}
                      layout="position"
                      layoutId={id}
                      variants={kanbanCardVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={kanbanCardTransition}
                      whileHover={onCardMove ? kanbanCardHover : undefined}
                      onPointerDown={
                        onCardMove ? (e) => onCardPointerDown(e, item) : undefined
                      }
                      onClickCapture={
                        onCardMove
                          ? (e) => {
                              if (justDraggedRef.current) {
                                e.preventDefault();
                                e.stopPropagation();
                                justDraggedRef.current = false;
                              }
                            }
                          : undefined
                      }
                      className={cn(
                        "will-change-transform select-none",
                        onCardMove
                          ? "cursor-grab active:cursor-grabbing"
                          : "cursor-pointer",
                      )}
                    >
                      {renderCard(item)}
                    </motion.div>
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
                      {emptyLabel}
                    </span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </KanbanColumnShell>
          );
        })}
      </div>

      {
}
      {overlay ? (
        <div
          ref={overlayElRef}
          className="pointer-events-none fixed left-0 top-0 z-[9999]"
          style={{
            width: overlay.width,
            transform: `translate3d(${overlay.initialX}px, ${overlay.initialY}px, 0)`,
          }}
        >
          <motion.div
            initial={kanbanDragOverlayInitial}
            animate={kanbanDragOverlayAnimate}
            transition={kanbanDragOverlayTransition}
            className="cursor-grabbing rounded-[--radius]"
          >
            {renderCard(overlay.item)}
          </motion.div>
        </div>
      ) : null}
    </LayoutGroup>
  );
}
