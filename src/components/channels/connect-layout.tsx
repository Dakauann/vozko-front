"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The shared composition for every "connect a channel" screen.
 *
 * All three of these pages do one job — walk an operator through a sequence
 * whose final step happens on this screen — and each had grown its own
 * structure. The result was three different page widths and three different
 * places for the thing you actually came to do.
 *
 * The spatial thesis is a split between DOING and KNOWING:
 *
 *   · Doing — the ordered steps and the form or CTA. Primary, and it belongs at
 *     the top of the viewport rather than under three blocks of explanation.
 *   · Knowing — what the connection gives you, prerequisites, security. Read
 *     once, then referenced while working, which is what makes it worth keeping
 *     on screen instead of scrolled past.
 *
 * Stacked full-width, those two compete and the page wastes most of a wide
 * screen. Side by side, each gets a readable measure and the work leads.
 *
 * Below `lg` the columns collapse and the work still comes first.
 */

const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

export const connectMotion = { container, item };

/**
 * ConnectShell owns the page's width and rhythm.
 *
 * max-w-6xl rather than the 3xl/5xl the three pages each picked: two columns
 * need roughly 1150px before the narrower one drops below a comfortable
 * measure, and below that the split is worse than a single column.
 */
export function ConnectShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className={cn("mx-auto w-full max-w-6xl space-y-6 pb-16", className)}
    >
      {children}
    </motion.div>
  );
}

/** ConnectBlock is one staggered, full-width section (back link, banners, hero). */
export function ConnectBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * ConnectWorkArea splits the page into the work and its reference material.
 *
 * 7/5 rather than an even split: the work column carries a form and an ordered
 * list, both of which need the wider measure, while the aside is short prose
 * that reads better narrow.
 *
 * `items-start` matters — without it the aside stretches to the work column's
 * height and its sticky positioning has nothing to travel against.
 */
export function ConnectWorkArea({
  work,
  aside,
}: {
  work: ReactNode;
  aside?: ReactNode;
}) {
  if (!aside) {
    return <motion.div variants={item}>{work}</motion.div>;
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      {/* Ordered first in the DOM as well as visually, so keyboard and screen
          reader order match: the task, then its reference. */}
      <motion.div variants={item} className="space-y-6 lg:col-span-7">
        {work}
      </motion.div>

      <motion.div variants={item} className="lg:col-span-5">
        {/* Sticky only where there is room to scroll past it. The offset clears
            the dashboard header. */}
        <div className="space-y-4 lg:sticky lg:top-6">{aside}</div>
      </motion.div>
    </div>
  );
}

/**
 * ConnectAsideCard is one reference block.
 *
 * Deliberately quieter than the work column — a lighter surface and smaller
 * type — because it is support material. Matching the work column's weight is
 * what made the old pages read as an undifferentiated ribbon.
 */
export function ConnectAsideCard({
  title,
  children,
  icon,
  tone = "default",
}: {
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        tone === "warn"
          ? "border-amber-500/25 bg-amber-500/[0.04]"
          : "border-border/70 bg-muted/30",
      )}
    >
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h2>
        </div>
      )}
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

/**
 * ConnectBenefit is one line of "what this gives you".
 *
 * A list, not a card grid. Three equal-weight cards was the page's structure on
 * two of these screens, which gave supporting detail the same visual weight as
 * the task itself and cost a full row of vertical space to say three short
 * things.
 */
export function ConnectBenefit({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex gap-3">
      {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
