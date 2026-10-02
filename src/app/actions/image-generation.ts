import { apiClient } from "@/lib/api/browser-client";
import type { ImageAspect, ImageGenerationJob } from "@/lib/image-generation/types";

import { settleResult, type ActionResult } from "./action-result";

const GENERATIONS_PATH = "/images/generations";

export async function requestImageGenerationAction(
  prompt: string,
  aspect: ImageAspect,
  referenceMediaIds: string[] = [],
): Promise<ActionResult<ImageGenerationJob>> {
  return settleResult(
    await apiClient<ImageGenerationJob>(GENERATIONS_PATH, {
      method: "POST",
      body: JSON.stringify({ prompt, aspect, referenceMediaIds }),
    }),
  );
}

export async function getImageGenerationAction(id: string): Promise<ActionResult<ImageGenerationJob>> {
  return settleResult(
    await apiClient<ImageGenerationJob>(`${GENERATIONS_PATH}/${encodeURIComponent(id)}`, { method: "GET" }),
  );
}
