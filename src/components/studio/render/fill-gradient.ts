import { FillGradient } from "pixi.js";

import type { Gradient } from "@/lib/studio/document";
import { gradientPaint } from "@/lib/studio/paint";

export function fillGradient(gradient: Gradient, width: number, height: number): FillGradient {
  const paint = gradientPaint(gradient, { x: 0, y: 0, width, height });
  const colorStops = [];
  for (let i = 0; i < paint.stops.length; i += 2) colorStops.push({ offset: paint.stops[i] as number, color: paint.stops[i + 1] as string });
  if (paint.kind === "radial") {
    return new FillGradient({ type: "radial", center: paint.center, innerRadius: 0, outerCenter: paint.center, outerRadius: paint.radius, colorStops, textureSpace: "global" });
  }
  return new FillGradient({ type: "linear", start: paint.start, end: paint.end, colorStops, textureSpace: "global" });
}
