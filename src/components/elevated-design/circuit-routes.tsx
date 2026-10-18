"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type CircuitRouteState = "linked" | "open" | "stale";

export type CircuitRoute = {
  key: string | number;
  name: string;
  state: CircuitRouteState;
  source: ReactNode;
  target: ReactNode;
  targetAnchor?: number;
};

const PAD = 6;
const SOURCE_ANCHOR = 20;

const WIRE_TONE: Record<CircuitRouteState, string> = {
  linked: "text-primary",
  open: "text-border-strong",
  stale: "text-warning",
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Wire({ d, state }: { d: string; state: CircuitRouteState }) {
  const linked = state === "linked";
  return (
    <>
      <path d={d} stroke="currentColor" strokeWidth={1.5} strokeOpacity={linked ? 0.55 : 1} strokeDasharray={linked ? undefined : "3 4"} fill="none" />
      {linked ? <path d={d} pathLength={100} className="vz-circuit-spark" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" fill="none" /> : null}
    </>
  );
}

function Pads({ points, state }: { points: [number, number][]; state: CircuitRouteState }) {
  return (
    <>
      {points.map(([x, y], index) => (
        <rect
          key={index}
          x={x - PAD / 2}
          y={y - PAD / 2}
          width={PAD}
          height={PAD}
          fill={index === 0 || state === "linked" ? "currentColor" : "hsl(var(--card))"}
          stroke="currentColor"
          strokeWidth={1.25}
        />
      ))}
    </>
  );
}

function acrossPath(width: number, targetY: number) {
  const start = PAD / 2;
  const drop = targetY - SOURCE_ANCHOR;
  const end = Math.max(start + Math.abs(drop) + 8, width - PAD / 2);
  if (drop === 0) return { d: `M${start} ${SOURCE_ANCHOR} H${end}`, start, end };
  const bend = start + (end - start - Math.abs(drop)) * 0.45;
  return { d: `M${start} ${SOURCE_ANCHOR} H${bend} L${bend + Math.abs(drop)} ${targetY} H${end}`, start, end };
}

function AcrossTrace({ state, targetY }: { state: CircuitRouteState; targetY: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { d, start, end } = acrossPath(width, targetY);
  return (
    <div ref={ref} className="vz-circuit-across" style={{ height: Math.max(SOURCE_ANCHOR, targetY) + PAD }}>
      {width > 0 ? (
        <svg aria-hidden width={width} height={Math.max(SOURCE_ANCHOR, targetY) + PAD} className={cn("block overflow-visible", WIRE_TONE[state])}>
          <Wire d={d} state={state} />
          <Pads points={[[start, SOURCE_ANCHOR], [end, targetY]]} state={state} />
        </svg>
      ) : null}
    </div>
  );
}

function DownTrace({ state }: { state: CircuitRouteState }) {
  const d = `M16 ${PAD / 2} V${24 - PAD / 2}`;
  return (
    <svg aria-hidden width={32} height={24} className={cn("vz-circuit-down block overflow-visible", WIRE_TONE[state])}>
      <Wire d={d} state={state} />
      <Pads points={[[16, PAD / 2], [16, 24 - PAD / 2]]} state={state} />
    </svg>
  );
}

export function CircuitRoutes({
  routes,
  label,
  headings,
  className,
}: {
  routes: CircuitRoute[];
  label?: string;
  headings?: { source: string; target: string };
  className?: string;
}) {
  return (
    <div className={cn("vz-circuit space-y-2", className)}>
      {headings ? (
        <div aria-hidden className="vz-circuit-row text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{headings.source}</span>
          <span className="vz-circuit-heading-gap" />
          <span className="vz-circuit-heading-target">{headings.target}</span>
        </div>
      ) : null}
      <ol aria-label={label} className="space-y-3">
      {routes.map((route) => (
        <li key={route.key} aria-label={route.name} data-state={route.state} className="vz-circuit-row">
          <div className="vz-circuit-source min-w-0">{route.source}</div>
          <div data-trace className="vz-circuit-trace">
            <AcrossTrace state={route.state} targetY={route.targetAnchor ?? SOURCE_ANCHOR} />
            <DownTrace state={route.state} />
          </div>
          <div className="vz-circuit-target min-w-0">{route.target}</div>
        </li>
      ))}
      </ol>
    </div>
  );
}
