import type { LineProperty } from "@/lib/studio/line-properties";

interface LineUnit {
  scale: number;
  unit: string;
  decimals: number;
  step: number;
}

const PERCENT: LineUnit = { scale: 100, unit: "%", decimals: 1, step: 1 };
const DEGREES: LineUnit = { scale: 1, unit: "°", decimals: 1, step: 5 };
const PIXELS: LineUnit = { scale: 1, unit: "px", decimals: 1, step: 1 };
const PER_SECOND: LineUnit = { scale: 1, unit: "/s", decimals: 2, step: 0.1 };

export const LINE_UNITS: Record<LineProperty, LineUnit> = {
  trimStart: PERCENT,
  trimEnd: PERCENT,
  trimOffset: DEGREES,
  waveAmount: PIXELS,
  waveLength: { ...PIXELS, decimals: 0, step: 5 },
  waveSpeed: PER_SECOND,
  wavePhase: DEGREES,
  wiggleSize: PIXELS,
  wiggleDetail: { scale: 1, unit: "", decimals: 2, step: 0.1 },
  wiggleRate: PER_SECOND,
  taperStartLength: PERCENT,
  taperEndLength: PERCENT,
  taperStartWidth: PERCENT,
  taperEndWidth: PERCENT,
  taperStartEase: PERCENT,
  taperEndEase: PERCENT,
};

export function formatLineValue(property: LineProperty, value: number): string {
  const { scale, unit, decimals } = LINE_UNITS[property];
  const shown = (value * scale).toFixed(decimals);
  return unit === "" ? shown : unit === "°" || unit === "%" ? `${shown}${unit}` : `${shown} ${unit}`;
}
