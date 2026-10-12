"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { formatLevel, meterFill, METER_FLOOR_DB, type StereoMeter } from "@/lib/studio/live-meter";
import { cn } from "@/lib/utils";

import { useVideoEditor } from "../editor-context";

const SIDES = [0, 1] as const;
const SCALE = "bg-[linear-gradient(var(--meter-direction),hsl(var(--healthy))_0%,hsl(var(--healthy))_70%,hsl(var(--warning))_70%,hsl(var(--warning))_90%,hsl(var(--destructive))_90%)]";

type Subscribe = (draw: (meter: StereoMeter) => void) => () => void;

interface MeterBarsProps {
  label: string;
  clipLabel: string;
  vertical: boolean;
  subscribe: Subscribe;
  className: string;
  barsClassName: string;
  lightClassName: string;
  children?: ReactNode;
}

function MeterBars({ label, clipLabel, vertical, subscribe, className, barsClassName, lightClassName, children }: MeterBarsProps) {
  const { meters } = useVideoEditor();
  const covers = useRef<(HTMLSpanElement | null)[]>([]);
  const holds = useRef<(HTMLSpanElement | null)[]>([]);
  const light = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      subscribe((meter) => {
        const sides = [
          { now: meter.leftDb, held: meter.left.db },
          { now: meter.rightDb, held: meter.right.db },
        ];
        sides.forEach((side, index) => {
          const cover = covers.current[index];
          const hold = holds.current[index];
          if (cover) cover.style.transform = vertical ? `scaleY(${1 - meterFill(side.now)})` : `scaleX(${1 - meterFill(side.now)})`;
          if (!hold) return;
          hold.style.opacity = side.held > METER_FLOOR_DB ? "1" : "0";
          hold.style[vertical ? "bottom" : "left"] = `${meterFill(side.held) * 100}%`;
        });
        if (light.current) light.current.hidden = !meter.clipped;
      }),
    [subscribe, vertical],
  );

  return (
    <span role="group" aria-label={label} className={className}>
      <button
        ref={light}
        type="button"
        hidden
        aria-label={clipLabel}
        title={clipLabel}
        onClick={(event) => {
          event.stopPropagation();
          meters.clearClips();
        }}
        className={cn("shrink-0 rounded-[1px] bg-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", lightClassName)}
      />
      <span aria-hidden className={cn("flex gap-px", vertical ? "h-full flex-row" : "flex-col", barsClassName)}>
        {SIDES.map((side) => (
          <span
            key={side}
            className={cn("relative overflow-hidden rounded-[1px]", SCALE, vertical ? "h-full w-[3px] [--meter-direction:to_top]" : "h-[3px] w-full [--meter-direction:to_right]")}
          >
            <span
              data-meter-cover
              ref={(node) => {
                covers.current[side] = node;
              }}
              className={cn("absolute inset-0 bg-muted", vertical ? "origin-top" : "origin-right")}
              style={{ transform: vertical ? "scaleY(1)" : "scaleX(1)" }}
            />
            <span
              ref={(node) => {
                holds.current[side] = node;
              }}
              className={cn("absolute bg-foreground opacity-0", vertical ? "inset-x-0 bottom-0 h-px" : "inset-y-0 left-0 w-px")}
            />
          </span>
        ))}
      </span>
      {children}
    </span>
  );
}

export function TrackMeter({ trackId, name }: { trackId: string; name: string }) {
  const t = useTranslations("studio.video.meters");
  const { meters } = useVideoEditor();
  const subscribe = useCallback<Subscribe>((draw) => meters.onTrack(trackId, draw), [meters, trackId]);
  return (
    <MeterBars
      label={t("track", { name })}
      clipLabel={t("trackClipped", { name })}
      vertical
      subscribe={subscribe}
      className="relative flex shrink-0 flex-col items-center self-stretch py-1.5"
      barsClassName=""
      lightClassName="absolute top-0.5 h-1 w-[7px]"
    />
  );
}

export function MasterMeter() {
  const t = useTranslations("studio.video.meters");
  const { meters } = useVideoEditor();
  const readout = useRef<HTMLOutputElement>(null);
  const subscribe = useCallback<Subscribe>(
    (draw) =>
      meters.onMaster((reading) => {
        draw(reading.meter);
        if (readout.current) readout.current.textContent = t("lufs", { value: formatLevel(reading.shortTermLufs) });
      }),
    [meters, t],
  );
  return (
    <MeterBars
      label={t("master")}
      clipLabel={t("masterClipped")}
      vertical={false}
      subscribe={subscribe}
      className="mr-2 flex shrink-0 items-center gap-1.5"
      barsClassName="order-1 w-20"
      lightClassName="order-2 h-[7px] w-[7px]"
    >
      <output ref={readout} aria-label={t("loudness")} className="order-3 min-w-[4.5rem] font-mono text-2xs tabular-nums text-muted-foreground" />
    </MeterBars>
  );
}
