import type { LookReports, PerceptionLayers, VideoLookReports } from "@/lib/studio/agent/look-reports";
import type { PerceptionShape } from "@/lib/studio/agent/perception";

export type { LookReports, PerceptionLayers, VideoLookReports };

export function perceptionShapes(): PerceptionShape[] {
  return [];
}

export function lookReports(): LookReports {
  return { data: {}, shapes: [] };
}

export function videoLookReports(_view: unknown, _doc: unknown, times: readonly number[]): VideoLookReports {
  return { data: {}, shapes: times.map(() => []) };
}
