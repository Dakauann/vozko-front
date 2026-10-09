"use client";

import { useTranslations } from "next-intl";

import { BEZIER_Y_RANGE, bezierEasing, bezierOf, EASINGS, ease, easingReach, isNamedEasing, type Bezier, type Easing, type NamedEasing } from "@/lib/studio/keyframes";
import { cn } from "@/lib/utils";

import { NumberField } from "./fields";

const CURVE_STEPS = 32;
const SIZE = 20;
const PAD = 2;
const DEFAULT_CURVE: Bezier = [0.2, 0, 0, 1];

const HANDLES = [
  { index: 0, key: "x1", range: [0, 1] },
  { index: 1, key: "y1", range: BEZIER_Y_RANGE },
  { index: 2, key: "x2", range: [0, 1] },
  { index: 3, key: "y2", range: BEZIER_Y_RANGE },
] as const;

function curvePath(easing: Easing): string {
  const span = SIZE - PAD * 2;
  if (easing === "hold") return `M${PAD} ${SIZE - PAD}H${PAD + span}V${PAD}`;
  const [low, high] = easingReach(easing);
  const reach = high - low;
  const points = Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
    const p = i / CURVE_STEPS;
    return [PAD + p * span, SIZE - PAD - ((ease(easing, p) - low) / reach) * span] as const;
  });
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
}

export const EASING_PATHS: Record<NamedEasing, string> = Object.fromEntries(EASINGS.map((easing) => [easing, curvePath(easing)])) as Record<NamedEasing, string>;

function withHandle(curve: Bezier, index: number, value: number): Bezier {
  return [0, 1, 2, 3].map((i) => (i === index ? value : curve[i])) as unknown as Bezier;
}

function CurveIcon({ path }: { path: string }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="h-5 w-5">
      <rect x={PAD} y={PAD} width={SIZE - PAD * 2} height={SIZE - PAD * 2} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.75" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const BUTTON_CLASS =
  "flex h-8 min-w-0 items-center justify-center rounded-[--radius] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";
const ACTIVE_CLASS = "bg-primary text-primary-foreground shadow-button-primary hover:bg-[hsl(var(--primary-hover))]";
const IDLE_CLASS = "text-muted-foreground hover:bg-muted hover:text-foreground";

interface EasingPickerProps {
  label: string;
  value: Easing | null;
  disabled: boolean;
  onPick: (easing: Easing) => void;
}

export function EasingPicker({ label, value, disabled, onPick }: EasingPickerProps) {
  const t = useTranslations("studio.video.keyframes");
  const curve = value ? bezierOf(value) : null;
  const name = value === null ? null : isNamedEasing(value) ? t(`easings.${value}`) : t("customCurve");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-2xs">
        <span className="text-muted-foreground">{label}</span>
        {name ? <span className="text-foreground">{name}</span> : null}
      </div>
      <div role="group" aria-label={label} className="grid grid-cols-6 gap-1">
        {EASINGS.map((easing) => (
          <button
            key={easing}
            type="button"
            aria-pressed={value === easing}
            aria-label={t(`easings.${easing}`)}
            disabled={disabled}
            title={`${t(`easings.${easing}`)}: ${t(`easingHints.${easing}`)}`}
            onClick={() => onPick(easing)}
            className={cn(BUTTON_CLASS, value === easing ? ACTIVE_CLASS : IDLE_CLASS)}
          >
            <CurveIcon path={EASING_PATHS[easing]} />
          </button>
        ))}
        <button
          type="button"
          aria-pressed={curve !== null}
          aria-label={t("customCurve")}
          disabled={disabled}
          title={`${t("customCurve")}: ${t("customCurveHint")}`}
          onClick={() => onPick(curve ? bezierEasing(curve) : bezierEasing(DEFAULT_CURVE))}
          className={cn(BUTTON_CLASS, curve ? ACTIVE_CLASS : IDLE_CLASS)}
        >
          <CurveIcon path={curvePath(bezierEasing(curve ?? DEFAULT_CURVE))} />
        </button>
      </div>
      {curve ? (
        <div className="grid grid-cols-4 gap-1">
          {HANDLES.map((handle) => (
            <NumberField
              key={handle.key}
              label={t(`curve.${handle.key}`)}
              value={curve[handle.index]}
              min={handle.range[0]}
              max={handle.range[1]}
              step={0.01}
              decimals={2}
              disabled={disabled}
              onCommit={(next) => onPick(bezierEasing(withHandle(curve, handle.index, next)))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
