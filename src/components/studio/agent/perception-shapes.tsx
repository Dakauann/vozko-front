"use client";

import { guideTicks, PERCEPTION_AREA_ALPHA, PERCEPTION_GUIDE_DASH, PERCEPTION_GUIDE_TICK, PERCEPTION_INKS, PERCEPTION_LINE_SHARE, type PerceptionShape, type UnitPoint } from "@/lib/studio/agent/perception";
import type { CanvasSize } from "@/lib/studio/document";

function head(from: [number, number], to: [number, number], size: number): string {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const side = (turn: number) => `${to[0] - size * Math.cos(angle + turn)},${to[1] - size * Math.sin(angle + turn)}`;
  return `${to[0]},${to[1]} ${side(-Math.PI / 6)} ${side(Math.PI / 6)}`;
}

export function PerceptionShapes({ shapes, size }: { shapes: readonly PerceptionShape[]; size: CanvasSize }) {
  const line = Math.min(size.width, size.height) * PERCEPTION_LINE_SHARE;
  const at = ([x, y]: UnitPoint): [number, number] => [x * size.width, y * size.height];
  return (
    <svg aria-hidden data-perception-overlay viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      {shapes.map((shape, index) => {
        const ink = PERCEPTION_INKS[shape.tone];
        if (shape.kind === "area") return <polygon key={index} points={shape.points.map((point) => at(point).join(",")).join(" ")} fill={ink} fillOpacity={PERCEPTION_AREA_ALPHA} stroke={ink} strokeWidth={line} strokeDasharray={`${line * 3} ${line * 2}`} />;
        if (shape.kind === "ring") {
          const [cx, cy] = at(shape.at);
          return <circle key={index} cx={cx} cy={cy} r={line * 6} fill="none" stroke={ink} strokeWidth={line} />;
        }
        const from = at(shape.from);
        const to = at(shape.to);
        if (shape.kind === "guide") {
          const [dash, gap] = PERCEPTION_GUIDE_DASH;
          return (
            <g key={index}>
              <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={ink} strokeWidth={line} strokeDasharray={`${line * dash} ${line * gap}`} />
              {guideTicks(from, to, line * PERCEPTION_GUIDE_TICK).map(([start, end], tick) => (
                <line key={tick} x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} stroke={ink} strokeWidth={line} strokeLinecap="round" />
              ))}
            </g>
          );
        }
        return (
          <g key={index}>
            <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={ink} strokeWidth={shape.kind === "segment" ? line * 1.5 : line} strokeLinecap="round" />
            {shape.kind === "arrow" ? <polygon points={head(from, to, line * 5)} fill={ink} /> : null}
          </g>
        );
      })}
    </svg>
  );
}
