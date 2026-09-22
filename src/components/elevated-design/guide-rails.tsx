
type GuideRailsProps = {
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
        side === "top" ? "top-28" : "bottom-40",
      ].join(" ")}
      style={{
        transform: `translate(${edge === "right" ? "50%" : "-50%"}, -50%)`,
      }}
    >
      {}
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-foreground/25" />
      {}
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-foreground/25" />
    </span>
  );
}

export default function GuideRails({ className = "" }: GuideRailsProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-[1] overflow-hidden ${className}`}
    >
      {
}
      <div className="relative mx-auto h-full w-[calc(100%-2rem)] max-w-6xl sm:w-[calc(100%-3rem)]">
        {}
        <span
          className="absolute inset-y-0 left-0 w-px"
          style={{ backgroundImage: RAIL_BACKGROUND }}
        />
        {}
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
