import type { MediaModel } from "./types";

export function preselectedModel(models: MediaModel[], preferred?: string): string | null {
  const recommended = models.find((model) => model.id === preferred) ?? models.find((model) => model.default) ?? models[0];
  return recommended?.id ?? null;
}
