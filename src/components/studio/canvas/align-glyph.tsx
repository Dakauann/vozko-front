import type { Alignment, DistributeAxis } from "@/lib/studio/arrange";

type Bar = [number, number, number, number];

interface Glyph {
  line: string;
  bars: Bar[];
}

const GLYPHS: Record<Alignment | DistributeAxis, Glyph> = {
  left: { line: "M4 3 V21", bars: [[7, 6, 10, 4], [7, 14, 6, 4]] },
  center: { line: "M12 3 V21", bars: [[6, 6, 12, 4], [8, 14, 8, 4]] },
  right: { line: "M20 3 V21", bars: [[7, 6, 10, 4], [11, 14, 6, 4]] },
  top: { line: "M3 4 H21", bars: [[6, 7, 4, 10], [14, 7, 4, 6]] },
  middle: { line: "M3 12 H21", bars: [[6, 6, 4, 12], [14, 8, 4, 8]] },
  bottom: { line: "M3 20 H21", bars: [[6, 7, 4, 10], [14, 11, 4, 6]] },
  horizontal: { line: "M7 12 H9.5 M14.5 12 H17", bars: [[3, 5, 3, 14], [10.5, 7, 3, 10], [18, 4, 3, 16]] },
  vertical: { line: "M12 7 V9.5 M12 14.5 V17", bars: [[5, 3, 14, 3], [7, 10.5, 10, 3], [4, 18, 16, 3]] },
};

export function AlignGlyph({ kind, className }: { kind: Alignment | DistributeAxis; className?: string }) {
  const glyph = GLYPHS[kind];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d={glyph.line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      {glyph.bars.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={1} fill="currentColor" />
      ))}
    </svg>
  );
}
