import { SceneFrame } from "@/components/explainers/scenes/scene-kit";

const MIN_WINDOW_PERCENT = 12;

export function PeriodLimitScene({
  share,
  chosenLabel,
  windowLabel,
  label,
}: {
  share: number;
  chosenLabel: string;
  windowLabel: string;
  label: string;
}) {
  const percent = Math.max(MIN_WINDOW_PERCENT, Math.min(100, share * 100));
  return (
    <SceneFrame label={label}>
      <div className="space-y-2">
        <div className="flex justify-between gap-3 text-2xs font-medium text-muted-foreground">
          <span>{chosenLabel}</span>
          <span className="text-foreground">{windowLabel}</span>
        </div>
        <div aria-hidden className="relative h-3 overflow-hidden rounded-full border border-dashed border-border-strong">
          <span className="absolute inset-y-0 right-0 rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </SceneFrame>
  );
}
