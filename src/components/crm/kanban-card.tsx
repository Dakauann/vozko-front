"use client";

import type { ReactNode } from "react";
import type { TargetAndTransition, Transition, Variants } from "framer-motion";
import { cn } from "@/lib/utils";

// --- shared card motion ------------------------------------------------------
// The ONE motion spec both boards animate with, lifted from the original
// conversation funnel so the deal board glides identically (fade+rise on enter,
// spring on layout change, a 2px hover lift). Keep these here so the two surfaces
// can never drift apart on feel.

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

// --- shared drag motion ------------------------------------------------------
// The ONE drag-and-drop feel both boards use: a floating overlay that lifts out
// of the column, scales up, wobble-settles, and casts a deep shadow while the
// source position holds a dashed ghost. Lifted from the original conversation
// funnel and single-sourced HERE so the deal board's drag is pixel-for-pixel the
// same gesture, never the browser's native HTML5 drag. Both the funnel overlay
// and the deal-board overlay render these exact values.

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

// The dashed placeholder left behind in the column while a card is being dragged
// (the "ghost"). Border + fill match the column's drag-over highlight so the
// whole gesture reads as one system.
export const kanbanCardGhostClass =
  "rounded-[--radius] border border-dashed border-foreground/20 bg-muted";

// Shared kanban-card primitives. The conversation funnel and the deal board are
// two genuinely different objects (a chat has unread/last-message; a deal has
// value/close-date), so they keep their own card BODIES. But they must read as
// ONE system, so the building blocks live here and both cards are assembled from
// the same lego: the accent tile (DESIGN.md §5, solid opaque fill + white
// glyph, never a faded same-colour wash), the white-on-colour meta pill, and the
// label chip. Change the grammar here and both surfaces move together.

// --- kanbanCardClass ---------------------------------------------------------
// The ONE card frame both boards render. Rest state is flat (no shadow) and only
// lifts on hover, exactly like the original conversation funnel card, so a deal
// card and a chat card are the same object visually. Terminal states (won/lost)
// and the conversation "selected" state are variants of this one frame, never a
// second card style.

export function kanbanCardClass(
  state?: { selected?: boolean; won?: boolean; lost?: boolean },
  extra?: string,
) {
  return cn(
    "group relative rounded-[--radius] border bg-card p-3 transition-all",
    state?.won
      ? "border-emerald-300 bg-healthy/10/40 hover:border-healthy hover:shadow-sm dark:bg-healthy/5"
      : state?.lost
        ? "border-border opacity-75 hover:opacity-100 hover:border-foreground/20 hover:shadow-sm"
        : state?.selected
          ? "border-emerald-300 shadow-md ring-1 ring-emerald-500/30"
          : "border-border hover:border-foreground/20 hover:shadow-sm",
    extra,
  );
}

// --- KanbanCardHeader --------------------------------------------------------
// The shared header row: accent tile + title (+ optional subtitle / third line)
// + an optional right slot (an unread badge on a chat, an overflow affordance on
// a deal). Both cards render THIS, so the header geometry is identical and only
// the slotted content differs.

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
  /** Bold when the card wants attention (unread chat); medium otherwise. */
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
          <p className="truncate text-[9px] text-muted-foreground">{subtitle}</p>
        ) : null}
        {thirdLine ?? null}
      </div>
      {right ?? null}
    </div>
  );
}

// --- KanbanCard --------------------------------------------------------------
// THE card. Both boards render this exact component, the conversation funnel and
// the deal board are no longer two card implementations, only two data sources
// filling the same slots. A chat puts its message preview in `body` and its
// labels in `chips`; a deal puts its value in `body` and its custom fields in
// `chips`. Same header, same rows, same spacing, same everything. Assemble the
// interactive/animated wrapper (motion.div, drag) around it per board.

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
  /** The one content line: a chat's preview, a deal's value. */
  body?: ReactNode;
  /** Meta pills (status / owner / urgency …). */
  pills?: ReactNode;
  /** Pushed to the row's right edge (e.g. the conversation stage dot). */
  trailingDot?: ReactNode;
  /** Footer chips (a chat's labels, a deal's custom fields). */
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

// --- CardTile ----------------------------------------------------------------
// The house symbol: a solid, opaque tile carrying the category colour with a
// white glyph. `color` overrides the accent for channel-specific tiles
// (WhatsApp green, etc.); pass a plain initial via `children` when there is no
// glyph.

export function CardTile({
  children,
  color,
  className,
}: {
  children: ReactNode;
  /** Solid tile colour. Defaults to the Signal Blue accent. */
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        !color && "bg-primary",
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {children}
    </span>
  );
}

// --- CardPill ----------------------------------------------------------------
// A compact meta pill. Tones map to the design system's meaning colours (never a
// second action accent): success = emerald, warning = amber, danger = rose,
// info = indigo, neutral = muted. The label sits white on a solid tone so it
// never washes out. `color` lets a caller supply an arbitrary solid (a label's
// own colour); it wins over `tone`.

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
  // Neutral is the only non-white pill: muted fill, muted ink (still ≥4.5:1).
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
  /** Arbitrary solid fill (e.g. a label colour). Overrides `tone`; text stays white. */
  color?: string;
  icon?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-[--radius] px-1.5 py-0.5 text-[9px] font-semibold",
        color ? "text-white" : PILL_TONE[tone],
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

// --- CardLabelChip -----------------------------------------------------------
// A workspace label rendered in its own colour, with the small inner dot the
// funnel already used so overlapping labels stay legible.

export function CardLabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 truncate rounded-[--radius] px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/40" />
      <span className="truncate">{name}</span>
    </span>
  );
}

// --- initials helper ---------------------------------------------------------
// One place for the "MJ"-style avatar initials both cards derive from a name.

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
