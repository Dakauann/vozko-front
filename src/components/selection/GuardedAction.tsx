"use client";

import type { ReactNode } from "react";

import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import type { ActionState } from "@/lib/selection/action-state";
import { cn } from "@/lib/utils";

export type ReasonText<R extends string = string> = (state: ActionState<R>) => string | null;

export const BULK_CONTROL = cn(
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[--radius] border border-control-edge bg-card px-2.5 text-xs font-medium text-foreground transition-colors",
  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground",
  "[&_svg]:text-muted-foreground",
);

const PRIMARY_CONTROL = "border-primary bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active [&_svg]:text-primary-foreground";
const ICON_ONLY_CONTROL = "w-8 justify-center px-0";

export function GuardedAction({ reason, children }: { reason: string | null; children: ReactNode }) {
  return (
    <TooltipWrapper content={reason ?? ""} enabled={!!reason}>
      {children}
    </TooltipWrapper>
  );
}

export function BulkActionButton<R extends string>({
  state,
  reasonText,
  icon,
  label,
  onClick,
  primary = false,
  iconOnly = false,
  labelClassName,
}: {
  state: ActionState<R>;
  reasonText: ReasonText<R>;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  iconOnly?: boolean;
  labelClassName?: string;
}) {
  const reason = reasonText(state);
  return (
    <GuardedAction reason={reason}>
      <button
        type="button"
        disabled={!state.enabled}
        onClick={onClick}
        aria-label={iconOnly ? (reason ? `${label}. ${reason}` : label) : undefined}
        title={iconOnly ? label : undefined}
        className={cn(BULK_CONTROL, primary && PRIMARY_CONTROL, iconOnly && ICON_ONLY_CONTROL)}
      >
        {icon}
        {iconOnly ? null : <span className={labelClassName}>{label}</span>}
        {reason && !iconOnly ? <span className="sr-only">{`. ${reason}`}</span> : null}
      </button>
    </GuardedAction>
  );
}
