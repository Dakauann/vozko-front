"use client";

import { motion, type Variant } from "framer-motion";
import { DotsSixVertical } from "@/components/icons";
import type { PointerEvent as ReactPointerEvent, DragEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

// KanbanColumnShell is the SINGLE source of truth for a kanban column's chrome:
// the rounded-[--radius] bordered container, the header (optional drag handle + colour
// dot + name + animated count badge), the optional sub-header line, the pulse
// animation on new arrivals, and the scrollable body. Both surfaces render
// through it so the conversation funnel and the deal board are visibly ONE
// system while each keeps its own drag model:
//   - the conversation funnel drives a pointer-drag overlay and hit-tests via
//     `data-column-id` (set here), passing `onStartColumnDrag` + `pulsing`;
//   - the deal board uses native HTML5 drag, passing `onDragOver/Leave/Drop`.
// The card content itself stays with each caller (conversations vs. deals are
// genuinely two objects), which is exactly the intended separation.

/**
 * Arrival pulse.
 *
 * This motion stays — something genuinely landed in this bay and the operator
 * needs to know without watching. What changed is what it does: the bay's own
 * edge lights briefly, in the lamp colour, instead of blooming a green glow.
 * State, reported once, in the system's own signal.
 */
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
  // countKey stays in the prop contract (callers pass it) but has no consumer:
  // it drove a scale-pop on the count badge, and a number that jumps every time
  // it changes is decoration in a queue that changes constantly.
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
      // A bay in the rack: a fixed-width strip recessed into the panel, headed
      // by its scribble strip. The stage colour survives as a short lamp on
      // that head rather than as a dot, so a board of twelve stages reads as
      // one instrument instead of twelve competing bullets.
      className={cn(
        // A container takes the panel corner (6px), not the control corner:
        // the board reads as a row of quiet trays with white cards on them.
        "relative flex h-full w-72 min-w-[288px] flex-shrink-0 flex-col rounded-lg transition-colors",
        dashed
          ? "border border-dashed border-border bg-muted/70"
          : isDragOver
            ? "border border-dashed border-border-strong bg-muted"
            : "border border-solid border-border/70 bg-muted/70",
      )}
      style={{
        willChange: "box-shadow, border-color",
        borderColor: isDragOver && !dashed ? color : undefined,
      }}
    >
      {/* Column header — the scribble strip */}
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
        {/* The count as a quiet chip, the way the reference bays badge their
            depth — a bare grey number at the row's end read as a timestamp. */}
        <span className="readout ml-auto rounded-full border border-border bg-card px-1.5 py-px text-2xs font-semibold text-muted-foreground">
          {count}
        </span>
      </div>

      {headerExtra ? (
        <div className="border-b border-border px-3 py-1.5">{headerExtra}</div>
      ) : null}

      {/* Column body */}
      <div className={cn("flex-1 space-y-2 overflow-y-auto p-2.5", bodyClassName)}>
        {children}
      </div>

      {/* Pinned footer (e.g. the add-card button): sits below the scrollable body
          so it stays at the column's bottom edge instead of scrolling with cards. */}
      {footer ? (
        <div className="flex-shrink-0 border-t border-border p-2.5">{footer}</div>
      ) : null}
    </motion.div>
  );
}
