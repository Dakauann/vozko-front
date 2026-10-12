import type { KeySides, SideShape } from "@/lib/studio/keyframe-ease";
import { cn } from "@/lib/utils";

const HALVES: Record<Exclude<SideShape, "none">, readonly [string, string]> = {
  linear: ["M5 0.8 0.8 5 5 9.2Z", "M5 0.8 9.2 5 5 9.2Z"],
  eased: ["M5 0.8 1.4 0.8 3.6 5 1.4 9.2 5 9.2Z", "M5 0.8 8.6 0.8 6.4 5 8.6 9.2 5 9.2Z"],
  hold: ["M5 1.4 1.4 1.4 1.4 8.6 5 8.6Z", "M5 1.4 8.6 1.4 8.6 8.6 5 8.6Z"],
  smooth: ["M5 1 A4 4 0 0 0 5 9Z", "M5 1 A4 4 0 0 1 5 9Z"],
};

function half(shape: SideShape, side: 0 | 1): string {
  return HALVES[shape === "none" ? "linear" : shape][side];
}

export function KeyDiamond({ filled, sides, className }: { filled: boolean; sides?: KeySides; className?: string }) {
  if (sides) {
    return (
      <svg viewBox="0 0 10 10" aria-hidden className={cn("h-2.5 w-2.5", className)} data-key-in={sides.in} data-key-out={sides.out}>
        {[half(sides.in, 0), half(sides.out, 1)].map((d, i) => (
          <path key={i} d={d} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 10 10" aria-hidden className={cn("h-2.5 w-2.5", className)}>
      <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
