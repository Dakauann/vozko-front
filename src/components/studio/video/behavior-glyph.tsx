import type { BehaviorKind } from "@/lib/studio/behaviors";
import { cn } from "@/lib/utils";

const PATHS: Record<BehaviorKind, string> = {
  wiggle: "M1 8 L3 4 L5 10 L7 3 L9 11 L11 5 L13 9 L15 6",
  loop: "M1 11 L5 4 L5 11 L9 4 L9 11 L13 4 L13 11",
  drift: "M1 12 L15 3",
  overshoot: "M1 12 C4 12 5 3 8 3 C10 3 10 6 11.5 6 C13 6 13 4.5 15 4.5",
  audioReact: "M2 10 V6 M5 12 V3 M8 9 V7 M11 13 V2 M14 10 V6",
};

export function BehaviorGlyph({ kind, className }: { kind: BehaviorKind; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 14" className={cn("shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[kind]} />
    </svg>
  );
}
