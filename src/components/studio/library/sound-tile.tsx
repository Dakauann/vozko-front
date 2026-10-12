"use client";

import { useEffect } from "react";

import { Pause, Play } from "@/components/icons";
import { kindTile } from "@/components/studio/video/clip-tones";
import { formatRulerLabel } from "@/lib/studio/timeline-view";
import { cn } from "@/lib/utils";

import { useNearViewport } from "./item-preview";
import { playingSound, stopPreview, usePlayingSound } from "./sound-preview";
import { useSoundWave, WAVE_BARS } from "./sound-wave";

const BAR_STEP = 3;
const BAR_WIDTH = 2;
const WAVE_HEIGHT = 16;
const TENTHS_MS = 100;

function WaveBars({ bars }: { bars: readonly number[] | null }) {
  return (
    <svg aria-hidden viewBox={`0 0 ${WAVE_BARS * BAR_STEP} ${WAVE_HEIGHT}`} preserveAspectRatio="none" className="h-4 w-full" data-library-wave={bars ? "ready" : "loading"}>
      {(bars ?? new Array<number>(WAVE_BARS).fill(0)).map((value, index) => {
        const height = Math.max(1, value * WAVE_HEIGHT);
        return <rect key={index} x={index * BAR_STEP} y={(WAVE_HEIGHT - height) / 2} width={BAR_WIDTH} height={height} rx={0.5} className="fill-current" />;
      })}
    </svg>
  );
}

export function SoundTileBody({ assetId, name }: { assetId: string; name: string }) {
  const [ref, near] = useNearViewport<HTMLSpanElement>();
  const wave = useSoundWave(near ? assetId : null);
  const playing = usePlayingSound() === assetId;
  const Glyph = playing ? Pause : Play;

  useEffect(
    () => () => {
      if (playingSound() === assetId) stopPreview();
    },
    [assetId],
  );

  return (
    <span ref={ref} className="flex min-w-0 flex-1 items-center gap-2.5">
      <span aria-hidden className={cn(kindTile("audio"), "flex h-7 w-7 shrink-0 items-center justify-center")}>
        <Glyph className="h-3.5 w-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-baseline justify-between gap-2">
          <span className="truncate text-xs font-semibold">{name}</span>
          {wave ? <span className="readout shrink-0 text-2xs text-muted-foreground">{formatRulerLabel(wave.durationMs, TENTHS_MS)}</span> : null}
        </span>
        <span className={cn("block", playing ? "text-foreground" : "text-muted-foreground")}>
          <WaveBars bars={wave?.bars ?? null} />
        </span>
      </span>
    </span>
  );
}
