import type { LineCap, LineJoin } from "@/lib/studio/document";

const CAPS: Record<LineCap, { cap: "butt" | "round" | "square" }> = { butt: { cap: "butt" }, round: { cap: "round" }, square: { cap: "square" } };
const JOINS: Record<LineJoin, "miter" | "round" | "bevel"> = { miter: "miter", round: "round", bevel: "bevel" };

export function CapIcon({ cap, className }: { cap: LineCap; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M5 12 H15" stroke="currentColor" strokeWidth={7} strokeLinecap={CAPS[cap].cap} fill="none" opacity={0.85} />
      <path d="M15 6 V18" stroke="currentColor" strokeWidth={1} strokeDasharray="1.5 1.5" fill="none" />
    </svg>
  );
}

export function JoinIcon({ join, className }: { join: LineJoin; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M5 19 V7 H19" stroke="currentColor" strokeWidth={6} strokeLinejoin={JOINS[join]} strokeLinecap="butt" fill="none" opacity={0.85} />
    </svg>
  );
}
