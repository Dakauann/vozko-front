import { join } from "node:path";

import type { HarnessOptions } from "../studio-perf/harness";
import { benchPhotos, missingPhotos, writePhotoFixtures } from "./photos";
import { extendedCorpus } from "./references-extended";
import { sotaCorpus } from "./references-sota";

export interface LibraryPhoto {
  media_id: string;
  subject: string;
}

export const PHOTO_HARNESS: Pick<HarnessOptions, "overrides" | "fixtures"> = {
  overrides: { "@/app/actions/medias": join(import.meta.dir, "photo-medias.ts") },
  fixtures: writePhotoFixtures,
};

export function libraryPhotosOf(id: string): LibraryPhoto[] {
  const entry = [...extendedCorpus(), ...sotaCorpus()].find((candidate) => candidate.id === id);
  if (!entry) return [];
  const missing = new Set(missingPhotos().map((photo) => photo.slot));
  const catalog = new Map(benchPhotos().map((photo) => [photo.slot, photo]));
  return entry.photos.filter((slot) => !missing.has(slot)).map((slot) => ({ media_id: catalog.get(slot)!.asset, subject: catalog.get(slot)!.subject }));
}
