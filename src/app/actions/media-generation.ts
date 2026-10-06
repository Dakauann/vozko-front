import { apiClient } from "@/lib/api/browser-client";
import type { ImageGenerationInput, ImageGenerationJob, ImageModel } from "@/lib/image-generation/types";

import { settleResult, type ActionResult } from "./action-result";

const GENERATIONS_PATH = "/images/generations";
const MODELS_PATH = "/images/models";

export async function listImageModelsAction(): Promise<ActionResult<ImageModel[]>> {
  return settleResult(await apiClient<ImageModel[]>(MODELS_PATH, { method: "GET" }));
}

export async function requestImageGenerationAction({
  model,
  prompt,
  aspect,
  referenceMediaIds = [],
}: ImageGenerationInput): Promise<ActionResult<ImageGenerationJob>> {
  return settleResult(
    await apiClient<ImageGenerationJob>(GENERATIONS_PATH, {
      method: "POST",
      body: JSON.stringify({ model, prompt, aspect, referenceMediaIds }),
    }),
  );
}

export async function getImageGenerationAction(id: string): Promise<ActionResult<ImageGenerationJob>> {
  return settleResult(
    await apiClient<ImageGenerationJob>(`${GENERATIONS_PATH}/${encodeURIComponent(id)}`, { method: "GET" }),
  );
}
