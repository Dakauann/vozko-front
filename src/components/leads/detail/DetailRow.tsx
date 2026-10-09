"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DetailRows({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("flex flex-col", className)}>{children}</dl>;
}

export function DetailRow({
  icon,
  label,
  hint,
  mono = false,
  action,
  children,
}: {
  icon?: ReactNode;
  label: string;
  hint?: ReactNode;
  mono?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const value = <span className={cn("break-words", mono && "font-mono")}>{children}</span>;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <dt className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {icon ? (
          <span aria-hidden className="flex shrink-0 items-center [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
        ) : null}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="min-w-0 text-right text-sm font-medium text-foreground">
        {action ? (
          <span className="-my-1.5 inline-flex items-center gap-1.5">
            {value}
            {action}
          </span>
        ) : (
          value
        )}
        {hint ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  );
}
