import type { ReactNode } from "react";

import { ArrowBendUpLeft } from "@/components/icons";
import { cn } from "@/lib/utils";

export function QuickReplyChip({ text, stale = false, stat }: { text: string; stale?: boolean; stat?: ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium text-foreground shadow-sm",
        stale ? "border-dashed border-warning" : "border-border",
      )}
    >
      <ArrowBendUpLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{text}</span>
      {stat ? <span className="ml-1 shrink-0">{stat}</span> : null}
    </span>
  );
}

export function RouteTarget({ label, open = false }: { label: string; open?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-10 min-w-0 items-center rounded-lg border bg-card px-3 text-sm shadow-sm",
        open ? "border-dashed border-border-strong text-muted-foreground" : "border-border text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export const FIELD_ANCHOR = 34;

export function RouteCard({ children }: { children: ReactNode }) {
  return <div className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-3 shadow-sm">{children}</div>;
}
