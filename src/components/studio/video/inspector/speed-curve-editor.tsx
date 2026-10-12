"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { fitRange, graphTicks, graphX, graphY, GRAPH_HIT_PX, GRAPH_PAD_PX, msAtGraphX, valueAtGraphY, valueCurve, type GraphScale } from "@/lib/studio/graph-editor";
import { addSpeedPoint, curveKeys, moveSpeedPoint, removeSpeedPoint, type SpeedCurvePoint } from "@/lib/studio/speed-curve";
import { SPEED_LIMITS } from "@/lib/studio/speed-range";
import { cn } from "@/lib/utils";

const WIDTH = 280;
const HEIGHT = 140;
const MIN_SPAN = 0.5;
const TICKS = 3;
const SPEED_STEP = 0.05;
const BIG_SPEED_STEP = 0.25;
const AT_STEP = 0.01;
const BIG_AT_STEP = 0.05;
const MS = 1000;

export interface SpeedCurveEditorProps {
  points: readonly SpeedCurvePoint[];
  durationMs: number;
  smooth: boolean;
  disabled: boolean;
  onCommit: (points: SpeedCurvePoint[]) => void;
}

function rangeOf(points: readonly SpeedCurvePoint[]): readonly [number, number] {
  const [low, high] = fitRange([...points.map((point) => point.speed), 1], MIN_SPAN);
  return [Math.max(0, low), Math.min(SPEED_LIMITS[1] + MIN_SPAN, high)];
}

export function SpeedCurveEditor({ points, durationMs, smooth, disabled, onCommit }: SpeedCurveEditorProps) {
  const t = useTranslations("studio.video.speed.curve");
  const format = useFormatter();
  const [draft, setDraft] = useState<SpeedCurvePoint[]>([...points]);
  const [active, setActive] = useState<number | null>(null);
  const surface = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  const [frozen, setFrozen] = useState<readonly [number, number] | null>(null);
  const range = frozen ?? rangeOf(draft);
  const scale: GraphScale = { durationMs, widthPx: WIDTH, heightPx: HEIGHT, padPx: GRAPH_PAD_PX, low: range[0], high: range[1] };
  const curve = valueCurve(curveKeys(draft, durationMs, smooth), 0, durationMs);
  const line = curve.map((point, i) => `${i === 0 ? "M" : "L"}${graphX(scale, point.ms).toFixed(2)} ${graphY(scale, point.value).toFixed(2)}`).join(" ");

  const locate = (event: PointerEvent<SVGSVGElement>) => {
    const rect = surface.current!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    return { x, y, at: msAtGraphX(scale, x) / durationMs, speed: valueAtGraphY(scale, y) };
  };

  const hitAt = (x: number, y: number) => draft.findIndex((point) => Math.hypot(graphX(scale, point.at * durationMs) - x, graphY(scale, point.speed) - y) <= GRAPH_HIT_PX + 2);

  const down = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled || event.button !== 0) return;
    const at = locate(event);
    const hit = hitAt(at.x, at.y);
    event.currentTarget.setPointerCapture(event.pointerId);
    setFrozen(range);
    if (hit >= 0) {
      drag.current = hit;
      setActive(hit);
      return;
    }
    const added = addSpeedPoint(draft, at.at, at.speed);
    if (!added.ok) return;
    drag.current = added.index;
    setDraft(added.points);
    setActive(added.index);
  };

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current === null) return;
    const at = locate(event);
    const moved = moveSpeedPoint(draft, drag.current, at.at, at.speed);
    if (moved.ok) setDraft(moved.points);
  };

  const up = () => {
    setFrozen(null);
    if (drag.current === null) return;
    drag.current = null;
    onCommit(draft);
  };

  const remove = (index: number) => {
    const removed = removeSpeedPoint(draft, index);
    if (!removed.ok) return;
    setDraft(removed.points);
    setActive(removed.index);
    onCommit(removed.points);
  };

  const keys = (event: KeyboardEvent<SVGCircleElement>, index: number) => {
    if (disabled) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove(index);
      return;
    }
    const speed = event.shiftKey ? BIG_SPEED_STEP : SPEED_STEP;
    const at = event.shiftKey ? BIG_AT_STEP : AT_STEP;
    const delta = { ArrowUp: [0, speed], ArrowDown: [0, -speed], ArrowLeft: [-at, 0], ArrowRight: [at, 0] }[event.key];
    if (!delta) return;
    event.preventDefault();
    const point = draft[index];
    const moved = moveSpeedPoint(draft, index, point.at + delta[0], point.speed + delta[1]);
    if (!moved.ok) return;
    setDraft(moved.points);
    onCommit(moved.points);
  };

  const shown = active !== null ? draft[active] : null;

  return (
    <div className="space-y-1">
      <svg
        ref={surface}
        role="group"
        aria-label={t("graph")}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={cn("h-36 w-full touch-none select-none rounded-[--radius] border border-control-edge bg-card", disabled ? "opacity-60" : "cursor-crosshair")}
        preserveAspectRatio="none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {graphTicks(range[0], range[1], TICKS).map((tick) => (
          <g key={tick} className="text-muted-foreground">
            <line x1={0} x2={WIDTH} y1={graphY(scale, tick)} y2={graphY(scale, tick)} stroke="currentColor" strokeOpacity={0.2} vectorEffect="non-scaling-stroke" />
            <text x={4} y={graphY(scale, tick) - 2} fontSize={9} fill="currentColor">{`${format.number(tick)}×`}</text>
          </g>
        ))}
        <line x1={0} x2={WIDTH} y1={graphY(scale, 1)} y2={graphY(scale, 1)} className="text-muted-foreground" stroke="currentColor" strokeDasharray="4 3" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
        <path d={line} fill="none" className="text-foreground" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {draft.map((point, index) => (
          <circle
            key={index}
            cx={graphX(scale, point.at * durationMs)}
            cy={graphY(scale, point.speed)}
            r={index === active ? 5.5 : 4.5}
            tabIndex={disabled ? -1 : 0}
            role="slider"
            aria-label={t("point", { number: index + 1 })}
            aria-valuemin={SPEED_LIMITS[0]}
            aria-valuemax={SPEED_LIMITS[1]}
            aria-valuenow={point.speed}
            aria-valuetext={t("pointValue", { speed: format.number(point.speed, { maximumFractionDigits: 2 }), seconds: format.number((point.at * durationMs) / MS, { maximumFractionDigits: 2 }) })}
            className="fill-card text-foreground focus-visible:outline-none"
            stroke="currentColor"
            strokeWidth={index === active ? 3 : 2}
            vectorEffect="non-scaling-stroke"
            onFocus={() => setActive(index)}
            onKeyDown={(event) => keys(event, index)}
            onDoubleClick={(event) => {
              event.stopPropagation();
              remove(index);
            }}
          />
        ))}
      </svg>
      <p className="readout text-2xs text-muted-foreground" aria-live="polite">
        {shown ? t("pointValue", { speed: format.number(shown.speed, { maximumFractionDigits: 2 }), seconds: format.number((shown.at * durationMs) / MS, { maximumFractionDigits: 2 }) }) : t("hint")}
      </p>
    </div>
  );
}
