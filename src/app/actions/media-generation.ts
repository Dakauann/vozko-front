import { apiClient } from "@/lib/api/browser-client";
import type { MediaGenerationInput, MediaGenerationJob, MediaModel, ModelKind } from "@/lib/media-generation/types";

import { settleResult, type ActionResult } from "./action-result";

const GENERATIONS_PATH = "/media/generations";
const MODELS_PATH = "/media/models";

export async function listMediaModelsAction(kind: ModelKind): Promise<ActionResult<MediaModel[]>> {
  return settleResult(await apiClient<MediaModel[]>(`${MODELS_PATH}?kind=${encodeURIComponent(kind)}`, { method: "GET" }));
}

export async function requestMediaGenerationAction(input: MediaGenerationInput): Promise<ActionResult<MediaGenerationJob>> {
  return settleResult(await apiClient<MediaGenerationJob>(GENERATIONS_PATH, { method: "POST", body: JSON.stringify(input) }));
}

export async function getMediaGenerationAction(id: string): Promise<ActionResult<MediaGenerationJob>> {
  return settleResult(await apiClient<MediaGenerationJob>(`${GENERATIONS_PATH}/${encodeURIComponent(id)}`, { method: "GET" }));
}
