/**
 * GuideRails, Stripe-style "graph-paper" framing.
 *
 * Two faint vertical hairlines pinned to the edges of the content column,
 * spanning the full height of the positioned parent. The rails emerge with a
 * whisper of Signal Blue in the hero, settle to a neutral hairline down the
 * body, and dissolve at the very top and bottom so they never hard-cut. Small
 * "+" ticks mark the four corners of the frame for the engineered, instrument
 * feel.
 *
 * Structural chrome only, neutral by design so it never competes with the One
 * Voice (Signal Blue drives action; these merely frame). Purely decorative, so
 * it is aria-hidden and pointer-events-none, and fully static (nothing to gate
 * behind prefers-reduced-motion).
 *
 * Drop it in as the last child of a `relative` container (e.g. the landing
 * `<main>`); it aligns to `max-w-6xl` to match the page's content columns.
 */

type GuideRailsProps = {
  /** Extra classes for the outer overlay (e.g. to clip or offset the frame). */
  className?: string;
};

const RAIL_BACKGROUND =
  "linear-gradient(" +
  "to bottom," +
  "transparent 0," +
  "hsl(var(--primary) / 0.38) 5rem," +
  "hsl(var(--primary) / 0.14) 13rem," +
  "hsl(var(--foreground) / 0.08) 26rem," +
  "hsl(var(--foreground) / 0.08) calc(100% - 8rem)," +
  "transparent 100%)";

/** A small "+" tick that straddles a rail at one corner of the frame. */
function CornerTick({
  edge,
  side,
}: {
  edge: "left" | "right";
  side: "top" | "bottom";
}) {
  return (
    <span
      className={[
        "pointer-events-none absolute h-[9px] w-[9px]",
        edge === "left" ? "left-0" : "right-0",
        // Keep ticks on the visible stretch of the rail: clear of the fixed
        // navbar up top, clear of the bottom fade below.
        side === "top" ? "top-28" : "bottom-40",
      ].join(" ")}
      // Center the tick on the rail (and on its own vertical anchor) regardless
      // of which edge it sits on.
      style={{
        transform: `translate(${edge === "right" ? "50%" : "-50%"}, -50%)`,
      }}
    >
      {/* horizontal stroke */}
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-foreground/25" />
      {/* vertical stroke */}
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-foreground/25" />
    </span>
  );
}

export default function GuideRails({ className = "" }: GuideRailsProps) {
  return (
    <div
      aria-hidden="true"
      // z-[1] lifts the rails above the sections' opaque backgrounds (which are
      // z-auto) while staying well under the fixed navbar (z-50).
      className={`pointer-events-none absolute inset-0 z-[1] overflow-hidden ${className}`}
    >
      {/* Centered frame: caps at the content column width, insets from the
          viewport edge on small screens so the rails never hug the bezel. */}
      <div className="relative mx-auto h-full w-[calc(100%-2rem)] max-w-6xl sm:w-[calc(100%-3rem)]">
        {/* Left rail */}
        <span
          className="absolute inset-y-0 left-0 w-px"
          style={{ backgroundImage: RAIL_BACKGROUND }}
        />
        {/* Right rail */}
        <span
          className="absolute inset-y-0 right-0 w-px"
          style={{ backgroundImage: RAIL_BACKGROUND }}
        />

        <CornerTick edge="left" side="top" />
        <CornerTick edge="right" side="top" />
        <CornerTick edge="left" side="bottom" />
        <CornerTick edge="right" side="bottom" />
      </div>
    </div>
  );
}
