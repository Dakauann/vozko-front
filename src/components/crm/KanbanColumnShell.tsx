"use client";

import { motion, type Variant } from "framer-motion";
import { DotsSixVertical } from "@/components/icons";
import type { PointerEvent as ReactPointerEvent, DragEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";


export const columnPulseVariants = {
  idle: {
    borderColor: "hsl(var(--border))",
  },
  pulse: {
    borderColor: [
      "hsl(var(--border))",
      "hsl(var(--lamp))",
      "hsl(var(--border))",
    ],
    transition: { duration: 0.7, ease: "easeInOut" as const },
  },
} satisfies Record<string, Variant>;

export interface KanbanColumnShellProps {
  columnId: string;
  name: string;
  color?: string;
  count: number;
  countKey?: string | number;
  dashed?: boolean;
  isDragOver?: boolean;
  pulsing?: boolean;
  onStartColumnDrag?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  headerExtra?: ReactNode;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export default function KanbanColumnShell({
  columnId,
  name,
  color,
  count,
  dashed = false,
  isDragOver = false,
  pulsing = false,
  onStartColumnDrag,
  headerExtra,
  onDragOver,
  onDragLeave,
  onDrop,
  bodyClassName,
  footer,
  children,
}: KanbanColumnShellProps) {
  return (
    <motion.div
      data-column-id={columnId}
      animate={
        pulsing
          ? columnPulseVariants.pulse
          : {
              ...columnPulseVariants.idle,
              transition: { duration: 0.2, ease: "easeOut" },
            }
      }
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative flex h-full w-72 min-w-[288px] flex-shrink-0 flex-col rounded-lg transition-colors",
        dashed
          ? "border border-dashed border-border bg-muted"
          : isDragOver
            ? "border border-dashed border-border-strong bg-muted"
            : "border border-solid border-border bg-muted",
      )}
      style={{
        willChange: "box-shadow, border-color",
        borderColor: isDragOver && !dashed ? color : undefined,
      }}
    >
      {}
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        {onStartColumnDrag ? (
          <div
            onPointerDown={onStartColumnDrag}
            className="flex h-5 w-4 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded-[--radius] transition-colors hover:bg-muted active:cursor-grabbing"
            title="Arrastar coluna"
          >
            <DotsSixVertical
              weight="bold"
              className="h-3.5 w-3.5 text-muted-foreground"
            />
          </div>
        ) : null}
        <span
          aria-hidden="true"
          className={cn(
            "h-3 w-[3px] flex-shrink-0 rounded-[1px]",
            dashed && !color && "bg-muted-foreground/40",
          )}
          style={color ? { backgroundColor: color } : undefined}
        />
        <span
          className={cn(
            "legend min-w-0 flex-1 truncate",
            !dashed && "!text-foreground",
          )}
        >
          {name}
        </span>
        {
}
        <span className="readout ml-auto rounded-full border border-border bg-card px-1.5 py-px text-2xs font-semibold text-muted-foreground">
          {count}
        </span>
      </div>

      {headerExtra ? (
        <div className="border-b border-border px-3 py-1.5">{headerExtra}</div>
      ) : null}

      {}
      <div className={cn("flex-1 space-y-2 overflow-y-auto p-2.5", bodyClassName)}>
        {children}
      </div>

      {
}
      {footer ? (
        <div className="flex-shrink-0 border-t border-border p-2.5">{footer}</div>
      ) : null}
    </motion.div>
  );
}
