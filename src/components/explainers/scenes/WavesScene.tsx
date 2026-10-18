import type { CSSProperties } from "react";

import { SceneFrame } from "./scene-kit";

const BASELINE = 100;
const BAR_WIDTH = 26;

const TONE = {
  healthy: "hsl(var(--primary))",
  alert: "hsl(var(--warning))",
  alertInk: "hsl(var(--warning-ink))",
  risk: "hsl(var(--destructive))",
  quiet: "hsl(var(--muted-foreground))",
  line: "hsl(var(--border))",
} as const;

type Tone = keyof typeof TONE;

const BARS: {
  x: number;
  height: number;
  tone: Tone;
  opacity: number;
  delay: number;
}[] = [
  { x: 20, height: 16, tone: "healthy", opacity: 0.5, delay: 0 },
  { x: 68, height: 32, tone: "healthy", opacity: 0.75, delay: 0.35 },
  { x: 116, height: 60, tone: "healthy", opacity: 1, delay: 0.7 },
  { x: 164, height: 30, tone: "alert", opacity: 1, delay: 1.25 },
];

const CHECKS: { from: number; to: number; tone: Tone; delay: number }[] = [
  { from: 46, to: 68, tone: "healthy", delay: 0.3 },
  { from: 94, to: 116, tone: "healthy", delay: 0.65 },
  { from: 142, to: 164, tone: "alert", delay: 1.15 },
  { from: 190, to: 212, tone: "risk", delay: 1.65 },
];

const delay = (seconds: number): CSSProperties => ({
  animationDelay: `${seconds}s`,
});

export function WavesScene({
  labels,
  label,
}: {
  labels: { grow: string; slow: string; hold: string };
  label: string;
}) {
  return (
    <SceneFrame label={label}>
      <svg aria-hidden viewBox="0 0 320 124" className="block h-auto w-full">
        <line
          x1="10"
          x2="310"
          y1={BASELINE}
          y2={BASELINE}
          stroke={TONE.line}
          strokeWidth="1.5"
        />
        {BARS.map((bar) => (
          <rect
            key={bar.x}
            className="vz-wave-rise"
            style={delay(bar.delay)}
            x={bar.x}
            y={BASELINE - bar.height}
            width={BAR_WIDTH}
            height={bar.height}
            rx="5"
            fill={TONE[bar.tone]}
            fillOpacity={bar.opacity}
          />
        ))}
        {CHECKS.map((check) => {
          const middle = (check.from + check.to) / 2;
          return (
            <g
              key={check.from}
              className="vz-wave-pop"
              style={delay(check.delay)}
            >
              <path
                d={`M${check.from + 2} ${BASELINE - 4} Q${middle} ${BASELINE - 26} ${check.to - 2} ${BASELINE - 4}`}
                stroke={TONE.quiet}
                strokeOpacity="0.5"
                strokeWidth="1.25"
                strokeDasharray="2 3"
                fill="none"
              />
              <circle
                cx={middle}
                cy={BASELINE - 16}
                r="4"
                fill={TONE[check.tone]}
              />
            </g>
          );
        })}
        <g className="vz-wave-pop" style={delay(1.85)}>
          <rect
            x="215"
            y={BASELINE - 24}
            width="6"
            height="24"
            rx="2"
            fill={TONE.risk}
          />
          <rect
            x="225"
            y={BASELINE - 24}
            width="6"
            height="24"
            rx="2"
            fill={TONE.risk}
          />
        </g>
        <rect
          className="vz-wave-pop"
          style={delay(2.05)}
          x="262"
          y={BASELINE - 30}
          width={BAR_WIDTH}
          height="30"
          rx="5"
          fill="none"
          stroke={TONE.quiet}
          strokeOpacity="0.55"
          strokeWidth="1.25"
          strokeDasharray="3 3"
        />
        <g
          fontSize="10"
          fontWeight="600"
          textAnchor="middle"
          fontFamily="inherit"
        >
          <text
            className="vz-wave-pop"
            style={delay(0.95)}
            x={129}
            y={BASELINE - 68}
            fill={TONE.healthy}
          >
            {labels.grow}
          </text>
          <text
            className="vz-wave-pop"
            style={delay(1.45)}
            x={177}
            y={BASELINE - 38}
            fill={TONE.alertInk}
          >
            {labels.slow}
          </text>
          <text
            className="vz-wave-pop"
            style={delay(1.95)}
            x={223}
            y={BASELINE - 32}
            fill={TONE.risk}
          >
            {labels.hold}
          </text>
        </g>
        <g
          fontSize="9"
          textAnchor="middle"
          fontFamily="inherit"
          fill={TONE.quiet}
        >
          {[...BARS.map((bar) => bar.x), 262].map((x, index) => (
            <text key={x} x={x + BAR_WIDTH / 2} y={BASELINE + 14}>
              {index + 1}
            </text>
          ))}
        </g>
      </svg>
    </SceneFrame>
  );
}
