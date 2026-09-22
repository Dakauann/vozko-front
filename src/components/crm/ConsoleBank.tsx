"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ConsoleBank({
  legend,
  children,
  className,
  grow = false,
}: {
  legend: string;
  children: ReactNode;
  className?: string;
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
