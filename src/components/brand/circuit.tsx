"use client";

import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from "react";
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
};

const GlowContext = createContext("");

const SPARK_SECONDS = 0.6;
const QUIET_MS = { min: 800, spread: 2200 };

const ONCE = { begin: "indefinite", dur: `${SPARK_SECONDS}s` } as const;
const TRAVEL = { keyTimes: "0;0.75;1", calcMode: "spline", keySplines: "0.45 0 0.9 0.55;0 0 1 1" } as const;

const TRAILS = [
  { length: 30, grow: 0.4, className: "vz-spark-trail vz-spark-trail-far" },
  { length: 10, grow: 0.6, className: "vz-spark-trail" },
];

function Spark({ d, width }: { d: string; width: number }) {
  const glow = useContext(GlowContext);
  return (
    <g className="vz-spark" opacity={0}>
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.72;1" {...ONCE} />
      {TRAILS.map((trail) => (
        <path key={trail.length} d={d} pathLength={100} strokeWidth={width + trail.grow} strokeLinecap="round" strokeDasharray={`${trail.length} 300`} strokeDashoffset={trail.length} className={trail.className}>
          <animate attributeName="stroke-dashoffset" values={`${trail.length};${trail.length - 100};${trail.length - 100}`} {...TRAVEL} {...ONCE} />
        </path>
      ))}
      <g>
        <animateMotion path={d} keyPoints="0;1;1" {...TRAVEL} {...ONCE} />
        <circle r={width * 4.5} fill={`url(#${glow})`} className="vz-spark-bloom" />
        <circle r={width * 1.6} fill={`url(#${glow})`} className="vz-spark-halo" />
        <circle r={width * 0.7} className="vz-spark-core" />
      </g>
    </g>
  );
}

function Run({ d, width, opacity = 1, pulse }: RunProps) {
  return (
    <>
      <path d={d} stroke="currentColor" strokeWidth={width} opacity={opacity} />
      {pulse && <Spark d={d} width={width} />}
    </>
  );
}

function discharge(spark: Element) {
  spark.querySelectorAll("animate, animateMotion").forEach((animation) => (animation as unknown as { beginElement: () => void }).beginElement());
}

function CircuitSvg({ viewBox, preserveAspectRatio, tone = "bold", className, pulse, speed = 1, children }: {
  viewBox: string;
  preserveAspectRatio?: string;
  tone?: OrnamentProps["tone"];
  className?: string;
  pulse: boolean;
  speed?: number;
  children: ReactNode;
}) {
  const root = useRef<SVGSVGElement>(null);
  const glow = `vz-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  useEffect(() => {
    const svg = root.current;
    if (!pulse || !svg) return;
    const pace = Math.max(0.25, Math.min(2, speed));
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let timer = 0;
    let last: Element | null = null;
    const running = () => visible && !motion.matches && !document.hidden;
    const schedule = () => {
      window.clearTimeout(timer);
      if (running()) timer = window.setTimeout(fire, (QUIET_MS.min + Math.random() * QUIET_MS.spread) / pace);
    };
    const fire = () => {
      const sparks = Array.from(svg.querySelectorAll(".vz-spark"));
      const choices = sparks.length > 1 ? sparks.filter((spark) => spark !== last) : sparks;
      const spark = choices[Math.floor(Math.random() * choices.length)];
      if (spark) {
        last = spark;
        discharge(spark);
      }
      schedule();
    };
    const sync = () => {
      svg.toggleAttribute("data-paused", !running());
      schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(svg);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [pulse, speed]);
  return (
    <svg
      ref={root}
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      fill="none"
      aria-hidden="true"
      className={cn(TONE[tone], className)}
      style={{ pointerEvents: "none" }}
    >
      {pulse && (
        <defs>
          <radialGradient id={glow}>
            <stop offset="0" className="vz-glow-hot" />
            <stop offset="0.35" className="vz-glow-mid" />
            <stop offset="1" className="vz-glow-edge" />
          </radialGradient>
        </defs>
      )}
      <GlowContext.Provider value={glow}>{children}</GlowContext.Provider>
    </svg>
  );
}

function GeneratedRuns({ width, height, pulse, seed, branches = 7 }: OrnamentProps & { width: number; height: number; pulse: boolean }) {
  const id = useId();
  const routeSeed = seed ?? Array.from(id).reduce((n, c) => Math.imul(n, 31) + c.charCodeAt(0), 17);
  return <>
    {createCircuitRoutes({ width, height, seed: routeSeed, branches }).map((route, index) => (
      <Run key={index} d={circuitPath(route.points)} width={index < 2 ? 2.2 : 1.4} opacity={index < 2 ? 0.6 : 0.26} pulse={pulse} />
    ))}
  </>;
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
    <CircuitSvg viewBox="0 0 220 220" tone={tone} className={className} pulse={pulse} speed={speed}>
      {dynamic ? <GeneratedRuns width={220} height={220} pulse={pulse} seed={seed} branches={branches} /> : <>
      <Run d="M8 202 H38 L94 146 H120 L190 76" width={3} pulse={pulse} />
      <Run d="M8 178 H30 L86 122 H108 L174 56" width={2} opacity={0.45} pulse={pulse} />
      <Run d="M24 216 H56 L120 152 H140 L208 84" width={1.5} opacity={0.3} pulse={pulse} />
      <Run d="M8 150 L64 94 H86 L142 38" width={1.5} opacity={0.22} pulse={pulse} />
      <Run d="M56 216 L118 154" width={1.5} opacity={0.16} pulse={pulse} />
      </>}
    </CircuitSvg>
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
    <CircuitSvg viewBox="0 0 220 220" tone={tone} className={className} pulse={pulse} speed={speed}>
      {dynamic ? <GeneratedRuns width={220} height={220} pulse={pulse} seed={seed} branches={branches} /> : <>
      <Run d="M28 214 V158 L56 130 V86 L92 50 H150 L178 22 H214" width={3} pulse={pulse} />
      <Run d="M56 108 H104 L132 80 V44" width={2} opacity={0.5} pulse={pulse} />
      <Run d="M8 214 V166 L36 138 V94 L72 58 H142" width={1.5} opacity={0.3} pulse={pulse} />
      <Run d="M48 214 V170 L76 142 V110 H120 L148 82 H196" width={1.5} opacity={0.22} pulse={pulse} />
      <Run d="M96 214 V182 L124 154 H168" width={1.5} opacity={0.16} pulse={pulse} />
      </>}
    </CircuitSvg>
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
    <CircuitSvg viewBox="0 0 460 150" preserveAspectRatio="xMaxYMid meet" tone={tone} className={className} pulse={pulse} speed={speed}>
      {dynamic ? <GeneratedRuns width={460} height={150} pulse={pulse} seed={seed} branches={branches} /> : <>
      <Run d="M8 136 H120 L190 66 H260 L304 22" width={3} pulse={pulse} />
      <Run d="M60 144 H176 L240 80 H310 L364 26" width={2} opacity={0.45} pulse={pulse} />
      <Run d="M120 150 H232 L288 94 H352 L404 42" width={1.5} opacity={0.3} pulse={pulse} />
      <Run d="M8 108 H84 L148 44 H200" width={1.5} opacity={0.22} pulse={pulse} />
      <Run d="M196 150 H260 L308 102 H370" width={1.5} opacity={0.16} pulse={pulse} />
      </>}
    </CircuitSvg>
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
