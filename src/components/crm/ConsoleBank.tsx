"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One labelled bank of a console bar.
 *
 * The CRM header used to be a row of bordered control groups — channel chips in
 * a box, campaign chips in a box, view chips in a box, then loose buttons. Four
 * boxes side by side is the toolbar every product ships, and no amount of
 * restyling the chips changes what the row is.
 *
 * A console does not group controls by drawing a box around them. It engraves a
 * legend above them and cuts a hairline between banks: the panel is continuous,
 * the labels do the grouping. That is what this is — a silkscreen legend over
 * its controls, divided from its neighbour by a rule, never by a border of its
 * own.
 */
export function ConsoleBank({
  legend,
  children,
  className,
  grow = false,
}: {
  /** Silkscreen label. Names what the bank routes, not what its buttons do. */
  legend: string;
  children: ReactNode;
  className?: string;
  /** Let this bank absorb spare width instead of sitting at its natural size. */
  grow?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-center gap-1.5 border-l border-border px-3 py-2 first:border-l-0 first:pl-4",
        grow ? "flex-1" : "shrink-0",
        className,
      )}
    >
      <span className="legend truncate">{legend}</span>
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </div>
  );
}

export default ConsoleBank;
