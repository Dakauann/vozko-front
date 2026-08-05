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

// A reusable kanban board for objects that move between columns (the deal board).
// It renders each column through the shared KanbanColumnShell AND drives the SAME
// drag gesture the conversation funnel uses, a pointer-drag that lifts the card
// into a floating overlay (scale + wobble + deep shadow), leaves a dashed ghost in
// place, highlights the hovered column, and pulses the target column green on drop
// (kanban-card.tsx / KanbanColumnShell). It deliberately does NOT use the browser's
// native HTML5 drag, so the two boards feel identical in motion. The CARD content
// is supplied by the caller via `renderCard`; each object type keeps its own card
// while sharing the column chrome, motion, empty state and add-card affordance.

export interface KanbanColumnModel {
  id: string;
  name: string;
  color?: string;
  count: number;
  // Optional line under the header (e.g. a deal column's summed value).
  headerExtra?: ReactNode;
}

interface KanbanBoardProps<T> {
  columns: KanbanColumnModel[];
  itemsFor: (columnId: string) => T[];
  getItemId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  // Fired when a card is dropped on a different column. Return nothing; the caller
  // persists + reloads.
  onCardMove?: (item: T, fromColumnId: string, toColumnId: string) => void;
  // Which column each item currently belongs to (to compute from/to on drop).
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
  // The id of the card currently lifted out (rendered as a ghost in place), the
  // column under the pointer (highlight), the columns mid-pulse (drop feedback),
  // and the floating overlay's data. Mirrors the conversation funnel exactly.
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
  // A press that MIGHT become a drag (waiting to cross the 5px threshold).
  const pendingRef = useRef<{
    item: T;
    from: string;
    startX: number;
    startY: number;
    rect: DOMRect;
  } | null>(null);
  // The active drag (threshold crossed).
  const dragRef = useRef<{ item: T; from: string; offsetX: number; offsetY: number } | null>(
    null,
  );
  const overColRef = useRef<string | null>(null);
  // Set on pointerup after a real drag so the click that follows (which would open
  // the card) is swallowed instead of firing.
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

  // Global pointer handlers: promote a press to a drag past 5px, move the overlay,
  // hit-test the column under the pointer via `data-column-id`, and commit on drop.
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
        justDraggedRef.current = true; // swallow the trailing click
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

  // Grabbing cursor + no text selection while a card is in flight.
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
    // LayoutGroup lets a card morph across columns when it moves (shared layoutId),
    // matching the conversation funnel's cross-column glide.
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
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary-ink"
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

                  // The lifted card holds its place as a dashed ghost while the
                  // floating overlay follows the pointer.
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
                    className="flex items-center justify-center py-8"
                  >
                    <span className="text-[11px] italic text-muted-foreground">{emptyLabel}</span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </KanbanColumnShell>
          );
        })}
      </div>

      {/* Floating drag overlay, the card lifted out of the column, following the
          pointer with the shared scale + wobble + deep-shadow spec. Rendered once,
          fixed to the viewport, above everything, and non-interactive. */}
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
