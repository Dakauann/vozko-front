/*
 * The trace lines — the Vozko board's signature ornament, drawn rather than
 * shipped as a PNG so they recolour with the theme and stay crisp at any size.
 *
 * The board's geometry, reproduced exactly (2026-08-24 correction against the
 * "Elementos Gráficos" panel): a BUNDLE of parallel traces rising at 45° like
 * a growth curve — each starts with a short horizontal run, climbs, and the
 * lead trace takes one horizontal step midway before climbing again. The lead
 * trace is full-strength; the flanking traces echo it thinner and fainter.
 *
 * What travels the bundle is CURRENT, not cargo (2026-09-04, user direction):
 * the static square trail, pads and vias are gone, and every run now carries
 * its own pulse instead — same geometry, staggered so the bundle reads as a
 * live circuit rather than a diagram of one. No glow, no gradient; colour is
 * component-owned via the `tone` prop, internal opacity is drawn into the art.
 *
 * These are IDENTITY, not information: always aria-hidden, always
 * pointer-events-none, never behind text an operator reads for a shift.
 * Legitimate homes: page-header periphery, empty states, auth surfaces,
 * marketing. The pulse is the one sanctioned motion, a user-directed exception
 * to "nothing in the periphery loops", and it self-removes under
 * prefers-reduced-motion (see .vz-trace-pulse), leaving the static bundle.
 */

import { cn } from "@/lib/utils";

interface OrnamentProps {
  className?: string;
  /** The slow current travelling the traces. On by default; it removes
   * itself under prefers-reduced-motion (see .vz-trace-pulse). */
  pulse?: boolean;
  /** Colour lives HERE, not at call sites: both tiers ride the themed
   * `--ornament` token (deep green in light so it survives the blend to
   * white, the board hex in dark). `bold` is the default identity register
   * (auth plates, empty states); `quiet` recedes into operator chrome (page
   * headers, working panels). A `text-*` class in className still wins via
   * cn/tailwind-merge for the rare one-off. */
  tone?: "bold" | "quiet";
}

const TONE: Record<NonNullable<OrnamentProps["tone"]>, string> = {
  // Lifted 2026-08-24 (user: "more vivid in both modes").
  bold: "text-ornament/75 dark:text-ornament/55",
  quiet: "text-ornament/50 dark:text-ornament/35",
};

type RunProps = {
  d: string;
  /** Stroke weight of the resting line. */
  width: number;
  /** How present the resting line is in the bundle. */
  opacity?: number;
  pulse: boolean;
  /** Negative seconds, so the bundle starts mid-cycle instead of all at once. */
  delay: number;
  /** Length of the travelling segment, in the path's own 0-100 units. */
  dash?: number;
  /** Seconds per lap. Longer runs read better slower. */
  duration?: number;
};

/**
 * One run of the bundle: the resting line, plus the current travelling it.
 * The pulse is drawn a touch heavier than its line and brightened, so it
 * reads as charge moving through the trace rather than a second trace.
 */
function Run({ d, width, opacity = 1, pulse, delay, dash = 14, duration = 8 }: RunProps) {
  return (
    <>
      <path d={d} stroke="currentColor" strokeWidth={width} opacity={opacity} />
      {pulse && (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={width + 0.6}
          strokeLinecap="round"
          pathLength={100}
          opacity={Math.min(1, opacity + 0.35)}
          className="vz-trace-pulse"
          style={{
            strokeDasharray: `${dash} ${100 - dash}`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
            filter: "brightness(1.5)",
          }}
        />
      )}
    </>
  );
}

/**
 * The rising trace bundle. ViewBox is 220×220; scale with width/height
 * classes. The lead line reads bottom-left → top-right, the board's
 * "results" gesture.
 */
export function CircuitTraces({
  className,
  pulse = true,
  tone = "bold",
}: OrnamentProps) {
  return (
    <svg
      viewBox="0 0 220 220"
      fill="none"
      aria-hidden="true"
      className={cn(TONE[tone], className)}
      style={{ pointerEvents: "none" }}
    >
      {/* Lead trace: horizontal run → 45° climb → step → 45° climb. */}
      <Run d="M8 202 H38 L94 146 H120 L190 76" width={3} pulse={pulse} delay={0} dash={16} />
      {/* Flanking traces: the same slope, thinner and fainter, each carrying
          its own current a beat behind the lead. */}
      <Run d="M8 178 H30 L86 122 H108 L174 56" width={2} opacity={0.45} pulse={pulse} delay={-2.4} dash={12} />
      <Run d="M24 216 H56 L120 152 H140 L208 84" width={1.5} opacity={0.3} pulse={pulse} delay={-4.6} dash={10} duration={9} />
      <Run d="M8 150 L64 94 H86 L142 38" width={1.5} opacity={0.22} pulse={pulse} delay={-6.1} dash={9} duration={9} />
      <Run d="M56 216 L118 154" width={1.5} opacity={0.16} pulse={pulse} delay={-7.2} dash={18} duration={7} />
    </svg>
  );
}

/**
 * The board's SECOND trace type: circuit-board routing. Where CircuitTraces
 * is the rising "results" bundle, this is the identity tile's PCB grammar —
 * long orthogonal runs connected by 45° chamfered bends and a branch splitting
 * off the main route. Same material rules: currentColor, tone prop, pulses.
 * ViewBox 220×220.
 */
export function CircuitBoard({
  className,
  pulse = true,
  tone = "bold",
}: OrnamentProps) {
  return (
    <svg
      viewBox="0 0 220 220"
      fill="none"
      aria-hidden="true"
      className={cn(TONE[tone], className)}
      style={{ pointerEvents: "none" }}
    >
      {/* Main route: up, chamfer, up, chamfer, out — PCB routing. */}
      <Run d="M28 214 V158 L56 130 V86 L92 50 H150 L178 22 H214" width={3} pulse={pulse} delay={0} dash={13} duration={9} />
      {/* Branch splitting off the main route at the second chamfer. */}
      <Run d="M56 108 H104 L132 80 V44" width={2} opacity={0.5} pulse={pulse} delay={-3.2} dash={16} duration={7} />
      {/* Parallel support routes, PCB-spaced. */}
      <Run d="M8 214 V166 L36 138 V94 L72 58 H142" width={1.5} opacity={0.3} pulse={pulse} delay={-5} dash={11} duration={9} />
      <Run d="M48 214 V170 L76 142 V110 H120 L148 82 H196" width={1.5} opacity={0.22} pulse={pulse} delay={-6.4} dash={10} duration={10} />
      <Run d="M96 214 V182 L124 154 H168" width={1.5} opacity={0.16} pulse={pulse} delay={-7.5} dash={16} duration={7} />
    </svg>
  );
}

/**
 * The trace bundle for WIDE, SHORT bands — page headers, strips, footers.
 * Same grammar as CircuitTraces (horizontal run → 45° climb → step → climb,
 * faint flankers, each with its own current) recomposed on a 460×150 canvas
 * so nothing has to bleed or clip in a band shorter than it is wide.
 *
 * `preserveAspectRatio="xMaxYMid meet"` makes the drawing self-fitting: give
 * the element the whole free region (any aspect) and the art letterboxes
 * against the RIGHT edge instead of distorting or being cut mid-stroke.
 */
export function CircuitTracesWide({
  className,
  pulse = true,
  tone = "bold",
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
      {/* Lead trace. */}
      <Run d="M8 136 H120 L190 66 H260 L304 22" width={3} pulse={pulse} delay={0} dash={14} />
      {/* Flanking traces. */}
      <Run d="M60 144 H176 L240 80 H310 L364 26" width={2} opacity={0.45} pulse={pulse} delay={-2.6} dash={12} />
      <Run d="M120 150 H232 L288 94 H352 L404 42" width={1.5} opacity={0.3} pulse={pulse} delay={-4.8} dash={10} duration={9} />
      <Run d="M8 108 H84 L148 44 H200" width={1.5} opacity={0.22} pulse={pulse} delay={-6.2} dash={12} duration={9} />
      <Run d="M196 150 H260 L308 102 H370" width={1.5} opacity={0.16} pulse={pulse} delay={-7.4} dash={14} duration={7} />
    </svg>
  );
}

/**
 * The board's dot matrix: a clean grid of SQUARE dots (the board draws
 * squares, not circles), solid at the left edge and dissolving toward the
 * right — size and opacity step down together. ViewBox 140×92.
 */
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
