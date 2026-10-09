import { starPolygon } from "@/lib/studio/paint";
import { scalePath } from "@/lib/studio/vector-path";
import { VECTOR_PRESETS, type VectorPresetId } from "@/lib/studio/vector-presets";

const VIEW = 40;
const ROOM = 30;

export function VectorGlyph({ id, className }: { id: VectorPresetId; className?: string }) {
  const preset = VECTOR_PRESETS[id];
  const width = preset.ratio >= 1 ? ROOM : ROOM * preset.ratio;
  const height = preset.ratio >= 1 ? ROOM / preset.ratio : ROOM;
  const left = (VIEW - width) / 2;
  const top = (VIEW - height) / 2;
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className={className} aria-hidden>
      <g transform={`translate(${left} ${top})`}>
        {preset.kind === "star" ? (
          <polygon points={starPolygon(preset, width, height).join(" ")} fill="currentColor" />
        ) : (
          <path
            d={scalePath(preset.data, width, height)}
            fill={preset.open ? "none" : "currentColor"}
            stroke={preset.open ? "currentColor" : undefined}
            strokeWidth={preset.open ? 2.5 : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
    </svg>
  );
}
