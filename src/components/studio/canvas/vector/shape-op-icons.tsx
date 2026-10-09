import type { ShapeOpKind } from "@/lib/studio/shape-ops";

const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const GHOST = { ...LINE, opacity: 0.4 };
const BACK = "M4 4 H15 V15 H4 Z";
const FRONT = "M9 9 H20 V20 H9 Z";

const FILLED: Partial<Record<ShapeOpKind, { d: string; evenOdd?: boolean }>> = {
  union: { d: "M4 4 H15 V9 H20 V20 H9 V15 H4 Z" },
  subtract: { d: "M4 4 H15 V9 H9 V15 H4 Z" },
  intersect: { d: "M9 9 H15 V15 H9 Z" },
  exclude: { d: `${BACK} ${FRONT}`, evenOdd: true },
};

const OUTLINED: Record<ShapeOpKind, { d: string; ghost?: boolean }[]> = {
  union: [],
  subtract: [{ d: FRONT, ghost: true }],
  intersect: [{ d: BACK, ghost: true }, { d: FRONT, ghost: true }],
  exclude: [],
  flatten: [{ d: `${BACK} ${FRONT}` }, { d: "M15 9 h0.01 M9 15 h0.01" }],
  release: [{ d: "M3 3 H11 V11 H3 Z" }, { d: "M13 13 H21 V21 H13 Z" }],
  reverse: [{ d: "M5 9 H19 M15 5 L19 9 L15 13" }, { d: "M19 15 H5 M9 11 L5 15 L9 19" }],
  simplify: [{ d: "M3 17 C7 4 12 4 13.5 11 C15 18 19 18 21 7" }, { d: "M3 17 h0.01 M13.5 11 h0.01 M21 7 h0.01" }],
  outline: [{ d: "M4 18 C8 6 16 6 20 18", ghost: true }, { d: "M3 16 C6.5 3 17.5 3 21 16 L18 19 C15 10 9 10 6 19 Z" }],
};

export function ShapeOpIcon({ kind, className }: { kind: ShapeOpKind; className?: string }) {
  const filled = FILLED[kind];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {OUTLINED[kind].map(({ d, ghost }) => (
        <path key={d} d={d} {...(ghost ? GHOST : LINE)} />
      ))}
      {filled ? <path d={filled.d} fill="currentColor" fillRule={filled.evenOdd ? "evenodd" : undefined} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" /> : null}
    </svg>
  );
}
