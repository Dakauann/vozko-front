import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function OutgoingBubble({ text, emptyLabel, className, children }: { text: string; emptyLabel: string; className?: string; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "max-w-[360px] whitespace-pre-wrap break-words rounded-lg rounded-br-sm border border-border bg-card px-3 py-2.5 text-sm shadow-sm",
        className,
      )}
    >
      {text.trim() ? (children ?? text) : <span className="text-muted-foreground">{emptyLabel}</span>}
    </div>
  );
}
