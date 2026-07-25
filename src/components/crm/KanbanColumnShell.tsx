"use client";

import { motion, type Variant } from "framer-motion";
import { DotsSixVertical } from "@phosphor-icons/react";
import type { PointerEvent as ReactPointerEvent, DragEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

// KanbanColumnShell is the SINGLE source of truth for a kanban column's chrome:
// the rounded-2xl bordered container, the header (optional drag handle + colour
// dot + name + animated count badge), the optional sub-header line, the pulse
// animation on new arrivals, and the scrollable body. Both surfaces render
// through it so the conversation funnel and the deal board are visibly ONE
// system while each keeps its own drag model:
//   - the conversation funnel drives a pointer-drag overlay and hit-tests via
//     `data-column-id` (set here), passing `onStartColumnDrag` + `pulsing`;
//   - the deal board uses native HTML5 drag, passing `onDragOver/Leave/Drop`.
// The card content itself stays with each caller (conversations vs. deals are
// genuinely two objects), which is exactly the intended separation.

export const columnPulseVariants = {
  idle: {
    boxShadow:
      "0 0 0 0px rgba(16, 185, 129, 0), inset 0 0 0 0px rgba(16, 185, 129, 0)",
    borderColor: "hsl(var(--border))",
  },
  pulse: {
    boxShadow: [
      "0 0 0 0px rgba(16, 185, 129, 0), inset 0 0 0 0px rgba(16, 185, 129, 0)",
      "0 0 0 6px rgba(16, 185, 129, 0.15), inset 0 0 20px 0px rgba(16, 185, 129, 0.04)",
      "0 0 0 0px rgba(16, 185, 129, 0), inset 0 0 0 0px rgba(16, 185, 129, 0)",
    ],
    borderColor: [
      "hsl(var(--border))",
      "rgba(16, 185, 129, 0.5)",
      "hsl(var(--border))",
    ],
    transition: { duration: 0.7, ease: "easeInOut" as const },
  },
} satisfies Record<string, Variant>;

export interface KanbanColumnShellProps {
  /** Set as `data-column-id` so pointer-drag hit-testing can find this column. */
  columnId: string;
  name: string;
  color?: string;
  count: number;
  /** Changing this re-triggers the count-badge pop (e.g. total items). */
  countKey?: string | number;
  /** Dashed neutral variant for the catch-all "Sem tag" column. */
  dashed?: boolean;
  isDragOver?: boolean;
  pulsing?: boolean;
  /** When provided, renders the column drag handle (funnel reorder). */
  onStartColumnDrag?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** Optional line under the header (e.g. a deal column's summed value). */
  headerExtra?: ReactNode;
  /** Native HTML5 drop-zone wiring (deal board). */
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
  bodyClassName?: string;
  /** Pinned below the scrollable body (e.g. the deal board's "add card" button),
   *  so it always sits at the column's bottom edge instead of scrolling away. */
  footer?: ReactNode;
  children: ReactNode;
}

export default function KanbanColumnShell({
  columnId,
  name,
  color,
  count,
  countKey,
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
        "relative flex h-full w-72 min-w-[288px] flex-shrink-0 flex-col rounded-2xl transition-colors duration-200",
        dashed
          ? "border border-dashed border-foreground/20 bg-muted/30"
          : isDragOver
            ? "border-2 border-dashed bg-muted/60"
            : "border border-solid border-border bg-muted/50",
      )}
      style={{
        willChange: "box-shadow, border-color",
        borderColor: isDragOver && !dashed ? color : undefined,
      }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-3">
        {onStartColumnDrag ? (
          <div
            onPointerDown={onStartColumnDrag}
            className="flex h-6 w-6 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded-md transition-colors hover:bg-border/80 active:cursor-grabbing active:bg-muted-foreground/40"
            title="Arrastar coluna"
          >
            <DotsSixVertical weight="bold" className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : null}
        <span
          className={cn(
            "h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-black/5",
            dashed && !color && "bg-muted-foreground/40",
          )}
          style={color ? { backgroundColor: color } : undefined}
        />
        <span
          className={cn(
            "truncate text-xs font-bold",
            dashed ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {name}
        </span>
        <motion.span
          key={countKey ?? count}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-card px-1.5 text-[10px] font-bold text-muted-foreground"
        >
          {count}
        </motion.span>
      </div>

      {headerExtra ? (
        <div className="border-b border-border/40 px-3 py-1.5">{headerExtra}</div>
      ) : null}

      {/* Column body */}
      <div className={cn("flex-1 space-y-2 overflow-y-auto p-2.5", bodyClassName)}>
        {children}
      </div>

      {/* Pinned footer (e.g. the add-card button): sits below the scrollable body
          so it stays at the column's bottom edge instead of scrolling with cards. */}
      {footer ? (
        <div className="flex-shrink-0 border-t border-border/60 p-2.5">{footer}</div>
      ) : null}
    </motion.div>
  );
}
