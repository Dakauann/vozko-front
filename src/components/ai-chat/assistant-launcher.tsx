"use client";

import { forwardRef } from "react";

import { EdgeTab } from "@/components/docks/edge-tab";

import { EloMark } from "./elo-mark";

import { cn } from "@/lib/utils";

const BARS = [
  { x: 3, height: 7, delay: "-0.48s" },
  { x: 8.25, height: 11, delay: "-0.24s" },
  { x: 13.5, height: 15, delay: "0s" },
] as const;

const CORNER =
  "bottom-4 right-4 h-14 w-14 rounded-full hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-6 sm:right-6";

function Glow() {
  return (
    <>
      <span aria-hidden className="vz-ai-halo" />
      <span aria-hidden className="vz-ai-ring" />
    </>
  );
}

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
    placement?: "corner" | "edge";
    tabLabel?: string;
    className?: string;
  }
>(function AssistantLauncher({ label, busy = false, onClick, placement = "corner", tabLabel, className }, ref) {
  if (placement === "edge") {
    return (
      <EdgeTab
        ref={ref}
        slot="upper"
        label={label}
        tabLabel={tabLabel ?? ""}
        icon={<EloMark className="h-5 w-5 text-foreground" />}
        onClick={onClick}
        decoration={<Glow />}
        dataBusy={busy}
        className={cn("vz-ai-launcher", className)}
      />
    );
  }
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      data-busy={busy}
      className={cn(
        "vz-ai-launcher group fixed z-[60] flex items-center justify-center bg-card text-primary shadow-lg transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        CORNER,
        className,
      )}
    >
      <Glow />
      <span aria-hidden className="absolute inset-0 rounded-[inherit] border border-border-strong bg-card" />
      <ChartGlyph />
      <span
        aria-hidden
        className="pointer-events-none absolute right-full mr-3 hidden translate-x-1 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-semibold text-foreground opacity-0 shadow-md transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:block"
      >
        {label}
      </span>
    </button>
  );
});
