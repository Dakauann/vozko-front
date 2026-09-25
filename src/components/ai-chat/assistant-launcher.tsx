"use client";

import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const BARS = [
  { x: 3, height: 7, delay: "-0.48s" },
  { x: 8.25, height: 11, delay: "-0.24s" },
  { x: 13.5, height: 15, delay: "0s" },
] as const;

const PLACEMENT = {
  corner:
    "bottom-4 right-4 h-14 w-14 rounded-full hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-6 sm:right-6",
  edge:
    "right-0 top-1/2 h-28 w-9 -translate-y-1/2 flex-col gap-2 rounded-l-xl [@media(hover:hover)]:translate-x-[calc(100%-22px)] [@media(hover:hover)]:hover:translate-x-0 [@media(hover:hover)]:focus-visible:translate-x-0 [@media(hover:hover)]:data-[busy=true]:translate-x-0",
} as const;

function ChartGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="relative h-6 w-6 flex-shrink-0">
      <path d="M2 18.25h16" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
      {BARS.map((bar) => (
        <rect
          key={bar.x}
          className="vz-ai-bar"
          x={bar.x}
          y={17 - bar.height}
          width="3.5"
          height={bar.height}
          rx="1.25"
          fill="currentColor"
          style={{ animationDelay: bar.delay }}
        />
      ))}
    </svg>
  );
}

export const AssistantLauncher = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    busy?: boolean;
    onClick: () => void;
    placement?: keyof typeof PLACEMENT;
    tabLabel?: string;
    className?: string;
  }
>(function AssistantLauncher({ label, busy = false, onClick, placement = "corner", tabLabel, className }, ref) {
  const edge = placement === "edge";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      data-busy={busy}
      className={cn(
        "vz-ai-launcher group fixed z-[60] flex items-center justify-center bg-card text-primary shadow-lg transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        PLACEMENT[placement],
        className,
      )}
    >
      <span aria-hidden className="vz-ai-halo" />
      <span aria-hidden className="vz-ai-ring" />
      <span aria-hidden className="absolute inset-0 rounded-[inherit] border border-border-strong bg-card" />
      <ChartGlyph />
      {edge && tabLabel ? (
        <span aria-hidden className="relative text-2xs font-semibold tracking-[0.08em] [writing-mode:vertical-rl]">
          {tabLabel}
        </span>
      ) : null}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-semibold text-foreground opacity-0 shadow-md transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:opacity-100 group-focus-visible:opacity-100 sm:block",
          edge ? "top-1/2 -translate-y-1/2" : "translate-x-1 group-hover:translate-x-0 group-focus-visible:translate-x-0",
        )}
      >
        {label}
      </span>
    </button>
  );
});
