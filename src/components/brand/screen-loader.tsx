"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export type ScreenLoaderFit = "viewport" | "screen" | "fill" | "inline";

interface ScreenLoaderProps {
  fit?: ScreenLoaderFit;
  label?: string;
  className?: string;
}

const FIT: Record<ScreenLoaderFit, { root: string; mark: string; label: string }> = {
  viewport: {
    root: "flex min-h-dvh w-full flex-col items-center justify-center gap-3 bg-background",
    mark: "w-[124px]",
    label: "legend",
  },
  screen: {
    root: "flex min-h-[calc(100dvh-4.5rem)] w-full flex-col items-center justify-center gap-3 sm:min-h-[calc(100dvh-6rem)]",
    mark: "w-[112px]",
    label: "legend",
  },
  fill: {
    root: "flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2.5",
    mark: "w-[72px]",
    label: "legend",
  },
  inline: {
    root: "inline-flex items-center gap-2",
    mark: "w-8",
    label: "text-xs text-muted-foreground",
  },
};

const LEAD_ROUTE = "M6 24H22L30 16H46L54 8H66";
const FAINT_ROUTE = "M6 30H24L32 22H40";

const PADS = [
  { x: 6, y: 24, delay: "0s" },
  { x: 38, y: 16, delay: "0.83s" },
  { x: 66, y: 8, delay: "1.57s" },
];

export function TraceMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 32" fill="none" aria-hidden="true" className={cn("vz-loader-mark h-auto shrink-0 overflow-visible", className)}>
      <path d={FAINT_ROUTE} className="vz-loader-route" strokeWidth={1} opacity={0.55} />
      <rect x={38.5} y={20.5} width={3} height={3} rx={0.5} className="vz-loader-route-pad" />
      <path d={LEAD_ROUTE} className="vz-loader-route" strokeWidth={1.5} />
      <path d={LEAD_ROUTE} pathLength={100} className="vz-loader-current" strokeWidth={2} strokeLinecap="round" />
      {PADS.map((pad) => (
        <rect
          key={pad.x}
          x={pad.x - 2.5}
          y={pad.y - 2.5}
          width={5}
          height={5}
          rx={1}
          strokeWidth={1.25}
          className="vz-loader-pad"
          style={{ animationDelay: pad.delay }}
        />
      ))}
    </svg>
  );
}

export function ScreenLoader({ fit = "screen", label, className }: ScreenLoaderProps) {
  const t = useTranslations("screenLoader");
  const styles = FIT[fit];

  return (
    <div role="status" aria-busy="true" aria-live="polite" data-fit={fit} className={cn("vz-loader", styles.root, className)}>
      <TraceMark className={styles.mark} />
      <span className={styles.label}>{label ?? t("label")}</span>
    </div>
  );
}
