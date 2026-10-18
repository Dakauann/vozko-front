import type { Icon } from "@/components/icons";

import { SceneFrame, SceneTile, stagger, type SceneTone } from "./scene-kit";

export type FanOutNode = { icon: Icon; label: string; tone?: SceneTone };

const ROWS = [16, 50, 84];

export function FanOutScene({ source, targets, picked, label }: { source: FanOutNode; targets: FanOutNode[]; picked?: number; label: string }) {
  const shown = targets.slice(0, ROWS.length);
  return (
    <SceneFrame label={label}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
        <SceneTile icon={source.icon} label={source.label} tone={source.tone} index={0} />
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[7.5rem] w-full">
          {shown.map((_, index) => {
            const chosen = index === picked;
            return (
              <path
                key={index}
                className="vz-wave-pop"
                style={stagger(index + 1)}
                d={`M2 38 C 45 38, 55 ${ROWS[index]}, 98 ${ROWS[index]}`}
                fill="none"
                vectorEffect="non-scaling-stroke"
                stroke={chosen ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                strokeOpacity={chosen ? 1 : 0.45}
                strokeWidth={chosen ? 2 : 1.25}
                strokeDasharray={chosen ? undefined : "3 3"}
              />
            );
          })}
        </svg>
        <div className="flex h-[7.5rem] flex-col justify-between">
          {shown.map((target, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <SceneTile icon={target.icon} tone={index === picked ? "accent" : (target.tone ?? "neutral")} index={index + 2} size="sm" />
              <span className="vz-wave-pop max-w-[5.5rem] text-2xs font-medium leading-tight text-muted-foreground" style={stagger(index + 2)}>
                {target.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
}
