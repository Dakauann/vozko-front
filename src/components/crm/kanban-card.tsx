"use client";

import type { ReactNode } from "react";
import type { TargetAndTransition, Transition, Variants } from "framer-motion";
import { cn, readableInkFor } from "@/lib/utils";


export const kanbanCardVariants: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

export const kanbanCardTransition: Transition = {
  layout: { type: "spring", damping: 30, stiffness: 300, mass: 0.8 },
  opacity: { duration: 0.2, ease: "easeOut" },
  y: { duration: 0.2, ease: "easeOut" },
  scale: { duration: 0.2, ease: "easeOut" },
};

export const kanbanCardHover = {
  y: -2,
  transition: { duration: 0.15, ease: "easeOut" as const },
};


export const kanbanDragOverlayInitial: TargetAndTransition = {
  scale: 1,
  rotate: 0,
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
};

export const kanbanDragOverlayAnimate: TargetAndTransition = {
  scale: 1.04,
  rotate: [0, 2, -1.5, 1, -0.5, 0.5],
  boxShadow:
    "0 20px 40px -8px rgba(0,0,0,0.18), 0 8px 16px -4px rgba(0,0,0,0.1)",
};

export const kanbanDragOverlayTransition: Transition = {
  scale: { type: "spring", damping: 20, stiffness: 300 },
  rotate: { duration: 0.6, ease: "easeOut" },
  boxShadow: { duration: 0.2, ease: "easeOut" },
};

export const kanbanCardGhostClass =
  "rounded-[--radius] border border-dashed border-foreground/20 bg-muted";



export function kanbanCardClass(
  state?: { selected?: boolean; won?: boolean; lost?: boolean },
  extra?: string,
) {
  return cn(
    "group relative rounded-lg border bg-card p-3 shadow-sm transition-all",
    state?.won
      ? "border-border bg-muted hover:border-healthy hover:shadow"
      : state?.lost
        ? "border-border opacity-75 hover:opacity-100 hover:border-foreground/20 hover:shadow"
        : state?.selected
          ?
            "border-primary/40 shadow-md ring-1 ring-primary/30"
          : "border-border hover:border-foreground/20 hover:shadow",
    extra,
  );
}


export function KanbanCardHeader({
  tile,
  title,
  strongTitle = true,
  subtitle,
  thirdLine,
  right,
}: {
  tile: ReactNode;
  title: ReactNode;
  strongTitle?: boolean;
  subtitle?: ReactNode;
  thirdLine?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2.5">
      {tile}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-xs text-foreground",
            strongTitle ? "font-semibold" : "font-medium",
          )}
        >
          {title}
        </p>
        {subtitle ? (
          <p className="truncate text-2xs text-muted-foreground">{subtitle}</p>
        ) : null}
        {thirdLine ?? null}
      </div>
      {right ?? null}
    </div>
  );
}


export function KanbanCard({
  tile,
  title,
  strongTitle = true,
  subtitle,
  thirdLine,
  rightSlot,
  body,
  pills,
  trailingDot,
  chips,
}: {
  tile: ReactNode;
  title: ReactNode;
  strongTitle?: boolean;
  subtitle?: ReactNode;
  thirdLine?: ReactNode;
  rightSlot?: ReactNode;
  body?: ReactNode;
  pills?: ReactNode;
  trailingDot?: ReactNode;
  chips?: ReactNode;
}) {
  return (
    <>
      <KanbanCardHeader
        tile={tile}
        title={title}
        strongTitle={strongTitle}
        subtitle={subtitle}
        thirdLine={thirdLine}
        right={rightSlot}
      />
      {body ?? null}
      {pills || trailingDot ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {pills}
          {trailingDot}
        </div>
      ) : null}
      {chips ? <div className="mt-1.5 flex flex-wrap gap-1">{chips}</div> : null}
    </>
  );
}


export function CardTile({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        !color && "bg-primary",
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {children}
    </span>
  );
}


export type PillTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "neutral";

const PILL_TONE: Record<PillTone, string> = {
  success: "bg-healthy text-healthy-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-destructive text-destructive-foreground",
  info: "bg-muted text-muted-foreground",
  accent: "bg-primary text-primary-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function CardPill({
  children,
  tone = "neutral",
  color,
  icon,
  className,
  title,
}: {
  children: ReactNode;
  tone?: PillTone;
  color?: string;
  icon?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-[--radius] px-1.5 py-0.5 text-2xs font-semibold",
        !color && PILL_TONE[tone],
        className,
      )}
      style={
        color
          ? { backgroundColor: color, color: readableInkFor(color) }
          : undefined
      }
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}


export function CardLabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 truncate rounded-[--radius] px-2 py-0.5 text-2xs font-semibold shadow-sm"
      style={{ backgroundColor: color, color: readableInkFor(color) }}
    >
      {
}
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-40" />
      <span className="truncate">{name}</span>
    </span>
  );
}


export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
