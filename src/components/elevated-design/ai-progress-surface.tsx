"use client";

import type { CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";

import { CircleNotch, WarningCircle } from "@/components/icons";
import { ProgressTrack } from "@/components/ui/progress-panel";
import { AI_PROGRESS_PILL_HEIGHT } from "@/lib/ai-progress";
import { cn } from "@/lib/utils";

export type AiProgressIndicator = "center" | "bottom" | "badge" | "none";

export const AI_PROGRESS_FRAME = {
  strip: "h-9 w-full rounded-[--radius] bg-muted/40",
  square: "mx-auto aspect-square w-full max-w-40 rounded-[--radius] bg-muted/40",
} as const;

export type AiProgressFrame = keyof typeof AI_PROGRESS_FRAME;

const STILL: CSSProperties = { animation: "none" };

function statusText(label: string, detail?: string): string {
  return detail ? `${label}. ${detail}` : label;
}

function StatusIcon({ failed, still }: { failed: boolean; still: boolean }) {
  return failed ? <WarningCircle className="h-3 w-3 shrink-0 text-destructive-ink" aria-hidden /> : <CircleNotch className={cn("h-3 w-3 shrink-0", !still && "animate-spin")} aria-hidden />;
}

interface AiProgressPillProps {
  label: string;
  detail?: string;
  progress?: number;
  failed?: boolean;
  placement: string;
  className?: string;
  style?: CSSProperties;
}

export function AiProgressPill({ label, detail, progress, failed = false, placement, className, style }: AiProgressPillProps) {
  const still = Boolean(useReducedMotion());
  return (
    <span
      aria-hidden
      data-job-pill={placement}
      title={statusText(label, detail)}
      className={cn(
        "flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border bg-popover/95 px-2 text-2xs font-medium text-popover-foreground shadow-md backdrop-blur-sm",
        failed ? "border-destructive" : "border-border",
        className,
      )}
      style={{ height: AI_PROGRESS_PILL_HEIGHT, ...style }}
    >
      <StatusIcon failed={failed} still={still} />
      <span className="truncate">{label}</span>
      {typeof progress === "number" && !failed ? <span className="font-semibold tabular-nums">{progress}%</span> : null}
    </span>
  );
}

function Sweep({ still, flush }: { still: boolean; flush: boolean }) {
  const ring: CSSProperties = { ...(still ? STILL : {}), ...(flush ? { inset: 0 } : {}) };
  return (
    <>
      {flush ? null : <span aria-hidden className="vz-ai-halo" style={still ? STILL : undefined} />}
      <span aria-hidden data-job-sweep className="vz-ai-ring" style={ring} />
      <span aria-hidden className="absolute inset-0 rounded-[inherit] bg-primary/10" />
    </>
  );
}

interface AiProgressSurfaceProps {
  label?: string;
  detail?: string;
  progress?: number;
  failed?: boolean;
  indicator?: AiProgressIndicator;
  flush?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function AiProgressSurface({ label, detail, progress, failed = false, indicator = "center", flush = false, className, style }: AiProgressSurfaceProps) {
  const still = Boolean(useReducedMotion());
  const pill = indicator === "center" || indicator === "bottom";
  const bar = pill && !failed && typeof progress === "number";
  return (
    <span
      data-ai-progress={failed ? "failed" : "running"}
      data-motion={still ? "static" : "animated"}
      data-busy={failed ? undefined : "true"}
      aria-busy={failed ? undefined : true}
      className={cn("pointer-events-none relative block", failed ? "border-2 border-destructive bg-destructive/10" : "vz-ai-card vz-ai-job", className)}
      style={style}
    >
      {failed ? null : <Sweep still={still} flush={flush} />}
      {label && pill ? (
        <span className={cn("absolute inset-x-2 flex flex-col items-center gap-1.5", indicator === "center" ? "top-1/2 -translate-y-1/2" : "bottom-2")}>
          <AiProgressPill label={label} detail={detail} progress={bar ? progress : undefined} failed={failed} placement="inside" />
          {bar ? <ProgressTrack label={label} percent={progress} className="max-w-[10rem] bg-popover/80" /> : null}
        </span>
      ) : null}
      {label && indicator === "badge" ? (
        <span aria-hidden data-job-spinner className="absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-popover/95 text-popover-foreground shadow-md">
          <StatusIcon failed={failed} still={still} />
        </span>
      ) : null}
      {label ? (
        <span role="status" aria-live="polite" className="sr-only">
          {statusText(label, detail)}
        </span>
      ) : null}
    </span>
  );
}
