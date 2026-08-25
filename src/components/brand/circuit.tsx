/*
 * The trace lines — the Vozko board's signature ornament, drawn rather than
 * shipped as a PNG so they recolour with the theme and stay crisp at any size.
 *
 * The board's geometry, reproduced exactly (2026-08-24 correction against the
 * "Elementos Gráficos" panel): a BUNDLE of parallel traces rising at 45° like
 * a growth curve — each starts with a short horizontal run, climbs, and the
 * lead trace takes one horizontal step midway before climbing again. The lead
 * trace is full-strength; the flanking traces echo it thinner and fainter. A
 * diagonal trail of shrinking square dots continues past the lead trace's
 * end, and a few faint runs terminate in small square pads. No glow, no
 * gradient — colour is component-owned via the `tone` prop (see below),
 * internal opacity is drawn into the artwork.
 *
 * These are IDENTITY, not information: always aria-hidden, always
 * pointer-events-none, never behind text an operator reads for a shift.
 * Legitimate homes: page-header periphery, empty states, auth surfaces,
 * marketing. The one sanctioned motion is the slow pulse (`.vz-trace-pulse`),
 * a user-directed exception to "nothing in the periphery loops" that
 * self-removes under prefers-reduced-motion.
 */

import { cn } from "@/lib/utils";

interface OrnamentProps {
  className?: string;
  /** The slow current travelling the lead traces. On by default; it removes
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
      <path
        d="M8 202 H38 L94 146 H120 L190 76"
        stroke="currentColor"
        strokeWidth="3"
      />
      {pulse && (
        <>
          {/* The current: the same geometry, dashed and swept. */}
          <path
            d="M8 202 H38 L94 146 H120 L190 76"
            stroke="currentColor"
            strokeWidth="3.5"
            pathLength={100}
            className="vz-trace-pulse"
            style={{ filter: "brightness(1.5)" }}
          />
          <path
            d="M8 178 H30 L86 122 H108 L174 56"
            stroke="currentColor"
            strokeWidth="2.5"
            pathLength={100}
            opacity="0.6"
            className="vz-trace-pulse"
            style={{ animationDelay: "-4.5s" }}
          />
        </>
      )}
      {/* Dotted diagonal trail continuing the lead trace's climb. */}
      <rect x="195" y="66" width="4.5" height="4.5" fill="currentColor" opacity="0.9" />
      <rect x="203" y="58" width="4" height="4" fill="currentColor" opacity="0.65" />
      <rect x="210" y="51" width="3.5" height="3.5" fill="currentColor" opacity="0.45" />
      <rect x="216" y="45" width="3" height="3" fill="currentColor" opacity="0.28" />

      {/* Flanking traces: the same slope, thinner and fainter. */}
      <path
        d="M8 178 H30 L86 122 H108 L174 56"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.45"
      />
      <path
        d="M24 216 H56 L120 152 H140 L208 84"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.3"
      />
      <path
        d="M8 150 L64 94 H86 L142 38"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.22"
      />
      <path
        d="M56 216 L118 154"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.16"
      />

      {/* Small square pads terminating the faint runs. */}
      <rect x="172" y="53" width="4" height="4" fill="currentColor" opacity="0.45" />
      <rect x="140" y="35" width="3.5" height="3.5" fill="currentColor" opacity="0.25" />
      <rect x="206" y="81" width="3.5" height="3.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/**
 * The board's SECOND trace type: circuit-board routing. Where CircuitTraces
 * is the rising "results" bundle, this is the identity tile's PCB grammar —
 * long orthogonal runs connected by 45° chamfered bends, a branch splitting
 * off the main route, small square vias at the junctions and pads at the
 * ends. Same material rules: currentColor, tone prop, sanctioned pulse.
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
      <path
        d="M28 214 V158 L56 130 V86 L92 50 H150 L178 22 H214"
        stroke="currentColor"
        strokeWidth="3"
      />
      {pulse && (
        <path
          d="M28 214 V158 L56 130 V86 L92 50 H150 L178 22 H214"
          stroke="currentColor"
          strokeWidth="3.5"
          pathLength={100}
          className="vz-trace-pulse"
          style={{ filter: "brightness(1.5)" }}
        />
      )}

      {/* Branch splitting off the main route at the second chamfer. */}
      <path
        d="M56 108 H104 L132 80 V44"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.5"
      />
      {/* Parallel support routes, PCB-spaced. */}
      <path
        d="M8 214 V166 L36 138 V94 L72 58 H142"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.3"
      />
      <path
        d="M48 214 V170 L76 142 V110 H120 L148 82 H196"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.22"
      />
      <path
        d="M96 214 V182 L124 154 H168"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.16"
      />

      {/* Vias at the junctions of the main route. */}
      <rect x="53" y="127" width="6" height="6" fill="currentColor" opacity="0.85" />
      <rect x="89" y="47" width="6" height="6" fill="currentColor" opacity="0.85" />

      {/* Pads terminating the runs. */}
      <rect x="128" y="38" width="7" height="7" fill="currentColor" opacity="0.6" />
      <rect x="140" y="54" width="6" height="6" fill="currentColor" opacity="0.35" />
      <rect x="166" y="150" width="6" height="6" fill="currentColor" opacity="0.3" />
      <rect x="194" y="78" width="6" height="6" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/**
 * The trace bundle for WIDE, SHORT bands — page headers, strips, footers.
 * Same grammar as CircuitTraces (horizontal run → 45° climb → step → climb,
 * dotted trail, faint flankers) recomposed on a 460×150 canvas so nothing
 * has to bleed or clip in a band shorter than it is wide.
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
      <path
        d="M8 136 H120 L190 66 H260 L304 22"
        stroke="currentColor"
        strokeWidth="3"
      />
      {pulse && (
        <>
          <path
            d="M8 136 H120 L190 66 H260 L304 22"
            stroke="currentColor"
            strokeWidth="3.5"
            pathLength={100}
            className="vz-trace-pulse"
            style={{ filter: "brightness(1.5)" }}
          />
          <path
            d="M60 144 H176 L240 80 H310 L364 26"
            stroke="currentColor"
            strokeWidth="2.5"
            pathLength={100}
            opacity="0.6"
            className="vz-trace-pulse"
            style={{ animationDelay: "-4.5s" }}
          />
        </>
      )}
      {/* Dotted diagonal trail continuing the lead trace's climb. */}
      <rect x="310" y="12" width="4.5" height="4.5" fill="currentColor" opacity="0.9" />
      <rect x="319" y="4" width="4" height="4" fill="currentColor" opacity="0.6" />
      <rect x="327" y="-2" width="3.5" height="3.5" fill="currentColor" opacity="0.4" />

      {/* Flanking traces. */}
      <path
        d="M60 144 H176 L240 80 H310 L364 26"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.45"
      />
      <path
        d="M120 150 H232 L288 94 H352 L404 42"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.3"
      />
      <path
        d="M8 108 H84 L148 44 H200"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.22"
      />
      <path
        d="M196 150 H260 L308 102 H370"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.16"
      />

      {/* Square pads terminating the faint runs. */}
      <rect x="362" y="22" width="4" height="4" fill="currentColor" opacity="0.45" />
      <rect x="200" y="40" width="3.5" height="3.5" fill="currentColor" opacity="0.25" />
      <rect x="370" y="98" width="3.5" height="3.5" fill="currentColor" opacity="0.25" />
      <rect x="404" y="38" width="3.5" height="3.5" fill="currentColor" opacity="0.3" />
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
