
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { circuitPath, createCircuitRoutes } from "./circuit-geometry";

interface OrnamentProps {
  className?: string;
  pulse?: boolean;
  tone?: "bold" | "quiet";
  dynamic?: boolean;
  seed?: number;
  branches?: number;
  speed?: number;
}

const TONE: Record<NonNullable<OrnamentProps["tone"]>, string> = {
  bold: "text-ornament/75 dark:text-ornament/55",
  quiet: "text-ornament/50 dark:text-ornament/35",
};

type RunProps = {
  d: string;
  width: number;
  opacity?: number;
  pulse: boolean;
  delay: number;
  dash?: number;
  duration?: number;
};

function Run({ d, width, opacity = 1, pulse, delay, dash = 14, duration = 8 }: RunProps) {
  return (
    <>
      <path d={d} stroke="currentColor" strokeWidth={width} opacity={opacity} />
      {pulse && <path d={d} stroke="currentColor" strokeWidth={width + 0.3} strokeLinecap="round" className="vz-trace-energize" style={{ animationDelay: `${delay}s`, animationDuration: `${duration * 0.65}s` }} />}
      {pulse && [
        { length: dash * 1.7, strength: 0.16, weight: width },
        { length: dash, strength: 0.38, weight: width + 0.25 },
        { length: dash * 0.28, strength: 0.95, weight: width + 0.5 },
      ].map(({ length, strength, weight }) => (
        <path
          key={length}
          d={d}
          stroke="currentColor"
          strokeWidth={weight}
          strokeLinecap="round"
          pathLength={100}
          opacity={strength}
          className="vz-trace-pulse"
          style={{
            strokeDasharray: `${length} ${100 - length}`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
            "--trace-phase": -(dash * 1.7 - length),
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

function GeneratedRuns({ width, height, pulse, seed, branches = 7, speed = 1 }: OrnamentProps & { width: number; height: number; pulse: boolean }) {
  const id = useId();
  const root = useRef<SVGGElement>(null);
  const initial = seed ?? Array.from(id).reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0), 17);
  const [generation, setGeneration] = useState({ current: initial, previous: null as number | null });
  useEffect(() => {
    if (!pulse || !root.current) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;
    let visible = false;
    let started = false;
    let sequence = 0;
    const evolve = () => {
      const next = seed === undefined ? crypto.getRandomValues(new Uint32Array(1))[0] : seed + ++sequence * 7919;
      setGeneration(previous => ({ current: next, previous: previous.current }));
    };
    const schedule = () => {
      window.clearInterval(timer);
      if (!visible || document.hidden || motion.matches) return;
      if (!started) { started = true; evolve(); }
      timer = window.setInterval(evolve, 24000 / Math.max(0.25, Math.min(2, speed)));
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); });
    observer.observe(root.current);
    document.addEventListener("visibilitychange", schedule);
    motion.addEventListener("change", schedule);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", schedule);
      motion.removeEventListener("change", schedule);
    };
  }, [pulse, seed, speed]);
  const runs = (routeSeed: number, animate: boolean) => createCircuitRoutes({ width, height, seed: routeSeed, branches }).map((route, index) => (
    <Run key={index} d={circuitPath(route.points)} width={index < 2 ? 2.2 : 1.4} opacity={index < 2 ? 0.6 : 0.26} pulse={animate} delay={-route.phase * 10} dash={12} duration={(9 + route.phase * 3) / Math.max(0.25, speed)} />
  ));
  return <g ref={root} data-circuit-generation={generation.current}>
    {generation.previous !== null && <g key={`old-${generation.previous}`} className="vz-circuit-retire">{runs(generation.previous, false)}</g>}
    <g key={generation.current} className="vz-circuit-grow">{runs(generation.current, pulse)}</g>
  </g>;
}

export function CircuitTraces({
  className,
  pulse = true,
  tone = "bold",
  dynamic = true,
  seed,
  branches,
  speed,
}: OrnamentProps) {
  return (
    <svg
      viewBox="0 0 220 220"
      fill="none"
      aria-hidden="true"
      className={cn(TONE[tone], className)}
      style={{ pointerEvents: "none" }}
    >
      {dynamic ? <GeneratedRuns width={220} height={220} pulse={pulse} seed={seed} branches={branches} speed={speed} /> : <>
      {}
      <Run d="M8 202 H38 L94 146 H120 L190 76" width={3} pulse={pulse} delay={0} dash={16} />
      {
}
      <Run d="M8 178 H30 L86 122 H108 L174 56" width={2} opacity={0.45} pulse={pulse} delay={-2.4} dash={12} />
      <Run d="M24 216 H56 L120 152 H140 L208 84" width={1.5} opacity={0.3} pulse={pulse} delay={-4.6} dash={10} duration={9} />
      <Run d="M8 150 L64 94 H86 L142 38" width={1.5} opacity={0.22} pulse={pulse} delay={-6.1} dash={9} duration={9} />
      <Run d="M56 216 L118 154" width={1.5} opacity={0.16} pulse={pulse} delay={-7.2} dash={18} duration={7} />
      </>}
    </svg>
  );
}

export function CircuitBoard({
  className,
  pulse = true,
  tone = "bold",
  dynamic = true,
  seed,
  branches,
  speed,
}: OrnamentProps) {
  return (
    <svg
      viewBox="0 0 220 220"
      fill="none"
      aria-hidden="true"
      className={cn(TONE[tone], className)}
      style={{ pointerEvents: "none" }}
    >
      {dynamic ? <GeneratedRuns width={220} height={220} pulse={pulse} seed={seed} branches={branches} speed={speed} /> : <>
      {}
      <Run d="M28 214 V158 L56 130 V86 L92 50 H150 L178 22 H214" width={3} pulse={pulse} delay={0} dash={13} duration={9} />
      {}
      <Run d="M56 108 H104 L132 80 V44" width={2} opacity={0.5} pulse={pulse} delay={-3.2} dash={16} duration={7} />
      {}
      <Run d="M8 214 V166 L36 138 V94 L72 58 H142" width={1.5} opacity={0.3} pulse={pulse} delay={-5} dash={11} duration={9} />
      <Run d="M48 214 V170 L76 142 V110 H120 L148 82 H196" width={1.5} opacity={0.22} pulse={pulse} delay={-6.4} dash={10} duration={10} />
      <Run d="M96 214 V182 L124 154 H168" width={1.5} opacity={0.16} pulse={pulse} delay={-7.5} dash={16} duration={7} />
      </>}
    </svg>
  );
}

export function CircuitTracesWide({
  className,
  pulse = true,
  tone = "bold",
  dynamic = true,
  seed,
  branches,
  speed,
}: OrnamentProps) {
  return (
    <svg
      viewBox="0 0 460 150"
      preserveAspectRatio="xMaxYMid meet"
      fill="none"
      aria-hidden="true"
      className={cn(TONE[tone], className)}
      style={{ pointerEvents: "none" }}
    >
      {dynamic ? <GeneratedRuns width={460} height={150} pulse={pulse} seed={seed} branches={branches} speed={speed} /> : <>
      {}
      <Run d="M8 136 H120 L190 66 H260 L304 22" width={3} pulse={pulse} delay={0} dash={14} />
      {}
      <Run d="M60 144 H176 L240 80 H310 L364 26" width={2} opacity={0.45} pulse={pulse} delay={-2.6} dash={12} />
      <Run d="M120 150 H232 L288 94 H352 L404 42" width={1.5} opacity={0.3} pulse={pulse} delay={-4.8} dash={10} duration={9} />
      <Run d="M8 108 H84 L148 44 H200" width={1.5} opacity={0.22} pulse={pulse} delay={-6.2} dash={12} duration={9} />
      <Run d="M196 150 H260 L308 102 H370" width={1.5} opacity={0.16} pulse={pulse} delay={-7.4} dash={14} duration={7} />
      </>}
    </svg>
  );
}

export function DotMatrix({ className, tone = "bold" }: OrnamentProps) {
  const dots: React.ReactNode[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const t = col / 7;
      const size = 6 - t * 3.6;
      const opacity = 1 - t * 0.78;
      dots.push(
        <rect
          key={`${row}-${col}`}
          x={6 + col * 17 + (6 - size) / 2}
          y={6 + row * 17 + (6 - size) / 2}
          width={size}
          height={size}
          fill="currentColor"
          opacity={opacity}
        />,
      );
    }
  }
  return (
    <svg
      viewBox="0 0 140 92"
      fill="none"
      aria-hidden="true"
      className={cn(TONE[tone], className)}
      style={{ pointerEvents: "none" }}
    >
      {dots}
    </svg>
  );
}
