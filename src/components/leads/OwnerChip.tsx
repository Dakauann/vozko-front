import type { ReactNode } from "react";

import { initials } from "@/lib/format/initials";
import { cn } from "@/lib/utils";

export function OwnerChip({ name, children, className }: { name: string; children?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-[12rem] items-center gap-1.5", className)}>
      <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-foreground">
        {initials(name)}
      </span>
      <span className="truncate">{children ?? name}</span>
    </span>
  );
}
