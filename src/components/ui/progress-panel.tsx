import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export function ProgressPanel({
  label,
  progress,
  className,
  style,
}: {
  label: string;
  progress?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const known = typeof progress === "number";
  return (
    <div
      aria-busy="true"
      className={cn("flex flex-col items-center justify-center gap-2.5 rounded-[--radius] bg-muted/50 px-6", className)}
      style={style}
    >
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={known ? 0 : undefined}
        aria-valuemax={known ? 100 : undefined}
        aria-valuenow={known ? progress : undefined}
        className="h-1.5 w-full max-w-[16rem] overflow-hidden rounded-full bg-muted"
      >
        {known ? (
          <div
            className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        ) : (
          <div className="h-full w-full origin-left scale-x-[0.35] rounded-full bg-primary animate-progress-creep motion-reduce:animate-none" />
        )}
      </div>
      <span className="flex items-baseline gap-1.5 text-2xs text-muted-foreground">
        {label}
        {known ? <span className="font-semibold tabular-nums text-foreground">{progress}%</span> : null}
      </span>
    </div>
  );
}
