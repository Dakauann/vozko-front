"use client";

import type { ReactNode } from "react";

import { EmptyValue } from "@/components/elevated-design/empty-value";
import type { GroupAnalysis } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { CycleProgress } from "../kit/figures";
import { useGroupsFormat } from "../kit/use-groups-format";

export function RowAction({
  label,
  ariaLabel,
  icon,
  iconOnly,
  iconSide = "left",
  disabled,
  expanded,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  icon: ReactNode;
  iconOnly?: boolean;
  iconSide?: "left" | "right";
  disabled?: boolean;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      aria-expanded={expanded}
      title={ariaLabel ?? label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {iconSide === "left" ? icon : null}
      {iconOnly ? null : label}
      {iconSide === "right" ? icon : null}
    </button>
  );
}

export function Fact({ label, sub, className, children }: { label: string; sub?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0 bg-card px-3 py-2.5", className)}>
      <dt className="text-2xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-xs text-foreground">{children}</dd>
      {sub ? <dd className="mt-0.5 text-[11px] text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}

export function NextCycle({
  analysis,
  timeZone,
}: {
  analysis: Pick<GroupAnalysis, "status" | "trigger" | "messagesPerCycle" | "pendingMessages" | "nextRunAt">;
  timeZone?: string;
}) {
  const fmt = useGroupsFormat(timeZone);
  if (analysis.status !== "active" || analysis.trigger !== "scheduled") return <CycleProgress analysis={analysis} compact timeZone={timeZone} />;
  if (!analysis.nextRunAt) return <EmptyValue className="text-xs" />;
  return <span className="readout whitespace-nowrap text-xs tabular-nums text-foreground">{fmt.dateTime(analysis.nextRunAt)}</span>;
}
