import type { VectorTool } from "@/lib/studio/vector-tools";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const PATHS: Record<VectorTool, string[]> = {
  select: ["M6 4 L18 12 L12.5 13.2 L15.8 19.5 L13.6 20.6 L10.3 14.3 L6 18 Z"],
  pen: ["M12 3 L17.5 11 L14 17 H10 L6.5 11 Z", "M12 3 V10", "M10 17 V20.5 H14 V17", "M12 10 a1.2 1.2 0 1 0 0.01 0"],
  draw: ["M4 17 C6 11 8.5 9 10.5 11.5 C12.5 14 14 14.5 16 10.5 C17.2 8 18.6 7 20 7.5", "M4 20.5 H20"],
};

export function VectorToolIcon({ tool, className }: { tool: VectorTool; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {PATHS[tool].map((d) => (
        <path key={d} d={d} {...STROKE} />
      ))}
    </svg>
  );
}
