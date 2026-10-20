"use client";

import { motion, type Variant } from "framer-motion";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CaretLeft, CaretRight, DotsSixVertical } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ColumnDragHandle } from "@/hooks/use-board-drag";


const columnPulseVariants = {
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

interface KanbanColumnShellProps {
  columnId: string;
  name: string;
  color?: string;
  count: number;
  dashed?: boolean;
  isDragOver?: boolean;
  pulsing?: boolean;
  dragHandle?: ColumnDragHandle;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  headerExtra?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}

function columnFrameClass(dashed: boolean, isDragOver: boolean) {
  if (dashed) return "border border-dashed border-border bg-muted";
  if (isDragOver) return "border border-dashed border-border-strong bg-muted";
  return "border border-solid border-border bg-muted";
}

function ColumnCount({ count }: { count: number }) {
  return (
    <span className="readout rounded-full border border-border bg-card px-1.5 py-px text-2xs font-semibold text-muted-foreground">
      {count}
    </span>
  );
}

function ColumnMark({ color, dashed }: { color?: string; dashed: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-3 w-[3px] flex-shrink-0 rounded-[1px]",
        dashed && !color && "bg-muted-foreground/40",
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

const headerButtonClass =
  "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function KanbanColumnShell({
  columnId,
  name,
  color,
  count,
  dashed = false,
  isDragOver = false,
  pulsing = false,
  dragHandle,
  collapsed = false,
  onToggleCollapsed,
  headerExtra,
  bodyClassName,
  footer,
  children,
}: KanbanColumnShellProps) {
  const t = useTranslations("crmKanban");

  return (
    <motion.div
      data-column-id={columnId}
      data-collapsed={collapsed || undefined}
      animate={
        pulsing
          ? columnPulseVariants.pulse
          : {
              ...columnPulseVariants.idle,
              transition: { duration: 0.2, ease: "easeOut" },
            }
      }
      className={cn(
        "relative flex h-full flex-shrink-0 flex-col rounded-lg transition-colors",
        collapsed ? "w-11 min-w-[44px]" : "w-72 min-w-[288px]",
        columnFrameClass(dashed, isDragOver),
      )}
      style={{
        willChange: "box-shadow, border-color",
        borderColor: isDragOver && !dashed ? color : undefined,
      }}
    >
      {collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2 px-1 py-2">
          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={false}
              aria-label={t("expandColumn", { column: name })}
              title={t("expandColumn", { column: name })}
              className={headerButtonClass}
            >
              <CaretRight weight="bold" className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <ColumnCount count={count} />
          <ColumnMark color={color} dashed={dashed} />
          <span
            className={cn(
              "legend min-h-0 flex-1 truncate [writing-mode:vertical-rl]",
              !dashed && "!text-foreground",
            )}
          >
            {name}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-border px-2 py-2">
            {dragHandle ? (
              <button
                type="button"
                {...dragHandle}
                className={cn(headerButtonClass, "w-4 cursor-grab touch-none active:cursor-grabbing")}
              >
                <DotsSixVertical weight="bold" className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <ColumnMark color={color} dashed={dashed} />
            <span
              className={cn(
                "legend min-w-0 flex-1 truncate",
                !dashed && "!text-foreground",
              )}
            >
              {name}
            </span>
            <span className="ml-auto">
              <ColumnCount count={count} />
            </span>
            {onToggleCollapsed ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-expanded
                aria-label={t("collapseColumn", { column: name })}
                title={t("collapseColumn", { column: name })}
                className={headerButtonClass}
              >
                <CaretLeft weight="bold" className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {headerExtra ? (
            <div className="border-b border-border px-3 py-1.5">{headerExtra}</div>
          ) : null}

          <div className={cn("flex-1 space-y-2 overflow-y-auto p-2.5", bodyClassName)}>
            {children}
          </div>

          {footer ? (
            <div className="flex-shrink-0 border-t border-border p-2.5">{footer}</div>
          ) : null}
        </>
      )}
    </motion.div>
  );
}
