"use client";

import type { ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { DotsSixVertical } from "@/components/icons";
import { cn } from "@/lib/utils";

interface SortableListProps<T> {
  items: readonly T[];
  itemKey: (item: T) => string;
  onMove: (from: number, to: number) => void;
  handleLabel: (item: T) => string;
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
  className?: string;
  disabled?: boolean;
}

function SortableRow({ id, label, disabled, children }: { id: string; label: string; disabled?: boolean; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label={label}
      disabled={disabled}
      className="inline-flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40"
      {...attributes}
      {...listeners}
    >
      <DotsSixVertical className="h-4 w-4" />
    </button>
  );
  return (
    <li ref={setNodeRef} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }} className={cn(isDragging && "relative z-10 opacity-80")}>
      {children(handle)}
    </li>
  );
}

export function SortableList<T>({ items, itemKey, onMove, handleLabel, renderItem, className, disabled }: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(itemKey);

  const end = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item, index) => (
            <SortableRow key={ids[index]} id={ids[index]} label={handleLabel(item)} disabled={disabled}>
              {(handle) => renderItem(item, index, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
