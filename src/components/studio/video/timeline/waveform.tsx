"use client";

import { useEffect, useRef } from "react";

import { waveformBars } from "@/lib/studio/filmstrip";
import type { Span } from "@/lib/studio/timeline-view";
import type { Clip } from "@/lib/studio/document";
import { peakGain, waveformSlice } from "@/lib/studio/waveform";

import { usePeaks } from "../use-asset";

const BAR_PX = 2;

interface WaveformProps {
  assetId: string;
  clip: Pick<Clip, "type" | "durationMs" | "trimInMs" | "speed" | "reverse" | "freeze">;
  widthPx: number;
  heightPx: number;
  span: Span;
  colorVar?: string;
}

export function Waveform({ assetId, clip, widthPx, heightPx, span, colorVar = "--plate-1" }: WaveformProps) {
  const peaks = usePeaks(assetId);
  const canvas = useRef<HTMLCanvasElement>(null);
  const spanWidth = Math.max(1, Math.round(span.toPx - span.fromPx));

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context || !peaks || widthPx <= 0) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = spanWidth * ratio;
    element.height = Math.max(1, heightPx) * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, spanWidth, heightPx);
    const token = getComputedStyle(element).getPropertyValue(colorVar).trim();
    context.fillStyle = token ? `hsl(${token})` : getComputedStyle(element).color;
    const bars = waveformSlice(peaks, clip, span.fromPx, spanWidth, widthPx, waveformBars(spanWidth, BAR_PX));
    const middle = heightPx / 2;
    const gain = peakGain(peaks);
    bars.forEach((value, index) => {
      const half = Math.max(0.5, Math.min(1, value * gain) * (heightPx / 2 - 1));
      context.fillRect(index * BAR_PX, middle - half, BAR_PX - 0.5, half * 2);
    });
  }, [peaks, clip, widthPx, heightPx, span.fromPx, spanWidth, colorVar]);

  if (!peaks) return null;
  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute top-0" style={{ left: span.fromPx, width: spanWidth, height: heightPx }} />;
}
