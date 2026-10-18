import type { Icon } from "@/components/icons";

import { SceneFrame, SceneTile, type SceneTone } from "./scene-kit";

type TimelineEvent = { at: number; icon: Icon; label: string; tone?: SceneTone };

export function TimelineScene({ events, start, end, label }: { events: TimelineEvent[]; start?: string; end?: string; label: string }) {
  return (
    <SceneFrame label={label}>
      <div className="relative h-[5.5rem]">
        <span aria-hidden className="absolute inset-x-0 top-4 h-[1.5px] bg-border-strong" />
        <span aria-hidden className="vz-timeline-run absolute top-[0.8rem] h-2 w-2 rounded-full bg-primary" />
        {events.map((event, index) => (
          <div key={index} className="absolute top-0 -translate-x-1/2" style={{ left: `${Math.min(90, Math.max(10, event.at * 100))}%` }}>
            <SceneTile icon={event.icon} label={event.label} tone={event.tone} index={index} size="sm" />
          </div>
        ))}
      </div>
      {start || end ? (
        <div className="flex justify-between text-2xs text-muted-foreground">
          <span>{start}</span>
          <span>{end}</span>
        </div>
      ) : null}
    </SceneFrame>
  );
}
