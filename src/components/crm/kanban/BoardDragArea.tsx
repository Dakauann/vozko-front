"use client";

import type { ReactNode } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { motion, useReducedMotion } from "framer-motion";

import {
  kanbanDragOverlayAnimate,
  kanbanDragOverlayInitial,
  kanbanDragOverlayTransition,
} from "@/components/crm/kanban-card";
import { boardDragId, type BoardDragSubject } from "@/lib/crm/board-drag";
import type { BoardDrag } from "@/hooks/use-board-drag";
import { cssCubicBezier, durationMs, easing } from "@/lib/motion/tokens";

const OVERLAY_Z_INDEX = 9999;
const KEYBOARD_STEP_TRANSITION = `transform ${durationMs.state}ms ${cssCubicBezier(easing.state)}`;

export default function BoardDragArea({
  drag,
  reorderableColumnIds = [],
  renderOverlay,
  children,
}: {
  drag: BoardDrag;
  reorderableColumnIds?: readonly string[];
  renderOverlay: (subject: BoardDragSubject) => ReactNode;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const sortableIds = reorderableColumnIds.map((id) => boardDragId("column", id));

  return (
    <DndContext {...drag.contextProps}>
      <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay
        dropAnimation={null}
        zIndex={OVERLAY_Z_INDEX}
        transition={reducedMotion ? "none" : KEYBOARD_STEP_TRANSITION}
      >
        {drag.active ? (
          <motion.div
            initial={kanbanDragOverlayInitial}
            animate={kanbanDragOverlayAnimate}
            transition={kanbanDragOverlayTransition}
            className="h-full cursor-grabbing rounded-[--radius]"
          >
            {renderOverlay(drag.active)}
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
