"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";

import { addCurvePoint, CURVE_CHANNELS, CURVE_POINT_GAP, curveAt, curveOf, moveCurvePoint, removeCurvePoint, withCurve, type ColorCurves, type CurveChannel, type CurvePoint } from "@/lib/studio/color-curves";
import { cn } from "@/lib/utils";

const SIZE = 200;
const SAMPLES = 64;
const HIT = 10 / SIZE;
const BIG_STEP = 10;
const GRID = [0.25, 0.5, 0.75] as const;

const STROKES: Record<CurveChannel, string> = {
  master: "var(--foreground)",
  red: "#e5484d",
  green: "#30a46c",
  blue: "#3e63dd",
};

interface CurveEditorProps {
  curves: ColorCurves | undefined;
  disabled: boolean;
  onChange: (curves: ColorCurves | undefined) => void;
  onStart: () => void;
  onEnd: () => void;
}

function pathOf(points: readonly CurvePoint[]): string {
  return Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const x = i / SAMPLES;
    return `${i === 0 ? "M" : "L"}${(x * SIZE).toFixed(2)} ${((1 - curveAt(points, x)) * SIZE).toFixed(2)}`;
  }).join(" ");
}

function nearest(points: readonly CurvePoint[], x: number, y: number): number {
  let best = -1;
  let distance = HIT;
  points.forEach((point, i) => {
    const d = Math.hypot(point.x - x, point.y - y);
    if (d <= distance) {
      best = i;
      distance = d;
    }
  });
  return best;
}

export function CurveEditor({ curves, disabled, onChange, onStart, onEnd }: CurveEditorProps) {
  const t = useTranslations("studio.color.curves");
  const [channel, setChannel] = useState<CurveChannel>("master");
  const [active, setActive] = useState<number | null>(null);
  const surface = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  const points = curveOf(curves, channel);

  const place = (next: readonly CurvePoint[]) => onChange(withCurve(curves, channel, next));

  const locate = (event: PointerEvent<SVGSVGElement>) => {
    const rect = surface.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: 1 - (event.clientY - rect.top) / rect.height };
  };

  const down = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled || event.button !== 0) return;
    const at = locate(event);
    const hit = nearest(points, at.x, at.y);
    onStart();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (hit >= 0) {
      dragging.current = hit;
      setActive(hit);
      return;
    }
    const added = addCurvePoint(points, at.x, at.y);
    if (!added.ok) return;
    place(added.points);
    dragging.current = added.index;
    setActive(added.index);
  };

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging.current === null) return;
    const at = locate(event);
    const moved = moveCurvePoint(points, dragging.current, at.x, at.y);
    if (moved.ok) place(moved.points);
  };

  const up = () => {
    if (dragging.current === null) return;
    dragging.current = null;
    onEnd();
  };

  const remove = (index: number) => {
    const removed = removeCurvePoint(points, index);
    if (!removed.ok) return;
    onStart();
    place(removed.points);
    onEnd();
    setActive(removed.index);
  };

  const nudge = (event: KeyboardEvent<SVGCircleElement>, index: number) => {
    if (disabled) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove(index);
      return;
    }
    const step = CURVE_POINT_GAP * (event.shiftKey ? BIG_STEP : 1);
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const point = points[index];
    const moved = moveCurvePoint(points, index, point.x + delta[0], point.y + delta[1]);
    if (!moved.ok) return;
    onStart();
    place(moved.points);
    onEnd();
  };

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={t("channel")} className="flex gap-1">
        {CURVE_CHANNELS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={channel === option}
            disabled={disabled}
            onClick={() => {
              setChannel(option);
              setActive(null);
            }}
            className={cn(
              "inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-[--radius] border text-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              channel === option ? "border-foreground/40 bg-muted text-foreground" : "border-control-edge text-muted-foreground hover:text-foreground",
            )}
          >
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STROKES[option] }} />
            {t(`channels.${option}`)}
          </button>
        ))}
      </div>
      <svg
        ref={surface}
        role="group"
        aria-label={t("graph", { channel: t(`channels.${channel}`) })}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={cn("aspect-square w-full touch-none select-none rounded-[--radius] border border-control-edge bg-card", disabled ? "opacity-60" : "cursor-crosshair")}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {GRID.map((at) => (
          <g key={at} className="text-border" stroke="currentColor" strokeWidth={1}>
            <line x1={at * SIZE} y1={0} x2={at * SIZE} y2={SIZE} />
            <line x1={0} y1={at * SIZE} x2={SIZE} y2={at * SIZE} />
          </g>
        ))}
        <line x1={0} y1={SIZE} x2={SIZE} y2={0} className="text-muted-foreground/40" stroke="currentColor" strokeDasharray="3 3" />
        {CURVE_CHANNELS.filter((other) => other !== channel && curves?.[other]).map((other) => (
          <path key={other} d={pathOf(curveOf(curves, other))} fill="none" stroke={STROKES[other]} strokeOpacity={0.35} strokeWidth={1} />
        ))}
        <path d={pathOf(points)} fill="none" stroke={STROKES[channel]} strokeWidth={2} />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x * SIZE}
            cy={(1 - point.y) * SIZE}
            r={index === active ? 6 : 5}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-label={t("point", { number: index + 1 })}
            aria-valuemin={0}
            aria-valuemax={255}
            aria-valuenow={Math.round(point.y * 255)}
            aria-valuetext={t("pointValue", { input: Math.round(point.x * 255), output: Math.round(point.y * 255) })}
            className="fill-card focus-visible:outline-none"
            stroke={STROKES[channel]}
            strokeWidth={index === active ? 3 : 2}
            onFocus={() => setActive(index)}
            onKeyDown={(event) => nudge(event, index)}
            onDoubleClick={(event) => {
              event.stopPropagation();
              remove(index);
            }}
          />
        ))}
      </svg>
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
