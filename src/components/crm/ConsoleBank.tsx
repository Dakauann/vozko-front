"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One group of the CRM command bar.
 *
 * This used to render a legend line ABOVE its controls — a two-storey bank
 * that cost the toolbar ~20px of height on a surface where every pixel is
 * queue. The Azure command bar it now follows is single-line: controls sit
 * inline, groups are separated by a hairline divider, and the group's name
 * moves to the accessible layer (`aria-label` + `title`) where assistive
 * tech and hover still get it. Every control inside already carries its own
 * tooltip, so nothing is unlabeled — it is just no longer labeled twice.
 */
export function ConsoleBank({
  legend,
  children,
  className,
  grow = false,
}: {
  /** Group name. Read by AT and shown on hover; no longer painted in the bar. */
  legend: string;
  children: ReactNode;
  className?: string;
  /** Let this bank absorb spare width instead of sitting at its natural size. */
  grow?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={legend}
      title={legend}
      className={cn(
        "flex min-w-0 items-center gap-1 border-l border-border px-2 py-1.5 first:border-l-0 first:pl-3",
        grow ? "flex-1" : "shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default ConsoleBank;
