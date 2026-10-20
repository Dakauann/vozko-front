"use client";

import type { ReactNode } from "react";

import { kanbanColumnGhostClass } from "@/components/crm/kanban-card";
import { useBoardColumn, type ColumnDragHandle } from "@/hooks/use-board-drag";
import { cn } from "@/lib/utils";

interface BoardColumnState {
  isCardOver: boolean;
  dragHandle?: ColumnDragHandle;
}

export default function BoardColumn({
  columnId,
  reorderable = false,
  children,
}: {
  columnId: string;
  reorderable?: boolean;
  children: (state: BoardColumnState) => ReactNode;
}) {
  const { setNodeRef, style, isDragging, isCardOver, dragHandle } = useBoardColumn({
    columnId,
    reorderable,
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("h-full flex-shrink-0", isDragging && kanbanColumnGhostClass)}
    >
      <div className={cn("h-full", isDragging && "invisible")}>
        {children({ isCardOver, dragHandle })}
      </div>
    </div>
  );
}
