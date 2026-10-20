import type { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { SceneFrame, SceneTile, stagger, type SceneTone } from "./scene-kit";

type FanOutNode = { icon: Icon; label: string; tone?: SceneTone };

type FanOutTarget = FanOutNode & { note?: string };

const ROWS = [16, 50, 84];

export function FanOutScene({ source, targets, picked, label }: { source: FanOutNode; targets: FanOutTarget[]; picked?: number; label: string }) {
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
              <span className="vz-wave-pop flex max-w-[6.5rem] flex-col text-2xs leading-tight" style={stagger(index + 2)}>
                <span className="font-medium text-muted-foreground">{target.label}</span>
                {target.note ? (
                  <span className={cn("tabular-nums", index === picked ? "font-semibold text-foreground" : "text-muted-foreground")}>{target.note}</span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
}
