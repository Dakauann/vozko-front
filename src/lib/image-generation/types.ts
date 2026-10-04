export type ImageAspect = "square" | "portrait" | "story";

export const MAX_REFERENCE_IMAGES = 16;

export interface ImageModel {
  id: string;
  name: string;
}

export interface ImageGenerationInput {
  model: string;
  prompt: string;
  aspect: ImageAspect;
  referenceMediaIds?: string[];
}

export type ImageJobStatus = "queued" | "running" | "done" | "failed";

export type ImageJobFailureCode = "generation_failed" | "storage_failed" | "timed_out" | "enqueue_failed" | "insufficient_funds" | "reference_unavailable";

export interface ImageGenerationJob {
  id: string;
  status: ImageJobStatus;
  prompt: string;
  aspect: ImageAspect;
  referenceMediaIds: string[];
  mediaId?: string;
  mediaUrl?: string;
  model?: string;
  failureCode?: ImageJobFailureCode;
  createdAt: string;
  updatedAt: string;
}
