"use client";

import { useTranslations } from "next-intl";

import { EASINGS, ease, type Easing } from "@/lib/studio/keyframes";
import { cn } from "@/lib/utils";

const CURVE_STEPS = 16;
const SIZE = 20;
const PAD = 2;

function curvePath(easing: Easing): string {
  const span = SIZE - PAD * 2;
  if (easing === "hold") return `M${PAD} ${SIZE - PAD}H${PAD + span}V${PAD}`;
  const points = Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
    const p = i / CURVE_STEPS;
    return [PAD + p * span, SIZE - PAD - ease(easing, p) * span] as const;
  });
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
}

export const EASING_PATHS: Record<Easing, string> = Object.fromEntries(EASINGS.map((easing) => [easing, curvePath(easing)])) as Record<Easing, string>;

interface EasingPickerProps {
  label: string;
  value: Easing | null;
  disabled: boolean;
  onPick: (easing: Easing) => void;
}

export function EasingPicker({ label, value, disabled, onPick }: EasingPickerProps) {
  const t = useTranslations("studio.video.keyframes");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-2xs">
        <span className="text-muted-foreground">{label}</span>
        {value ? <span className="text-foreground">{t(`easings.${value}`)}</span> : null}
      </div>
      <div role="group" aria-label={label} className="grid grid-cols-5 gap-1">
        {EASINGS.map((easing) => {
          const active = value === easing;
          return (
            <button
              key={easing}
              type="button"
              aria-pressed={active}
              aria-label={t(`easings.${easing}`)}
              disabled={disabled}
              title={`${t(`easings.${easing}`)}: ${t(`easingHints.${easing}`)}`}
              onClick={() => onPick(easing)}
              className={cn(
                "flex h-8 min-w-0 items-center justify-center rounded-[--radius] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
                active ? "bg-primary text-primary-foreground shadow-button-primary hover:bg-[hsl(var(--primary-hover))]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="h-5 w-5">
                <rect x={PAD} y={PAD} width={SIZE - PAD * 2} height={SIZE - PAD * 2} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.75" />
                <path d={EASING_PATHS[easing]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
