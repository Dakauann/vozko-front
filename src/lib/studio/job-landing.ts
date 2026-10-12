import type { MediaGenerationInput, MediaGenerationJob } from "@/lib/media-generation/types";

export type JobLanding = "inPlace" | "targetChanged";

export function jobStartAsset(start: MediaGenerationInput | MediaGenerationJob | null | undefined): string | null {
  if (!start) return null;
  if ("sourceMediaId" in start && start.sourceMediaId) return start.sourceMediaId;
  return ("referenceMediaIds" in start ? start.referenceMediaIds?.[0] : undefined) || null;
}

export function jobLanding(startedFrom: string | null | undefined, current: string | null | undefined): JobLanding {
  return startedFrom && current === startedFrom ? "inPlace" : "targetChanged";
}
