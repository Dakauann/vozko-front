import type { Artboard, VideoDocument } from "@/lib/studio/document";

import type { PhotoSlot } from "../photos";

export interface CorpusSource {
  url: string;
  title: string;
  platform: string;
}

export interface CorpusEntry {
  id: string;
  title: string;
  useCase: string;
  sources: CorpusSource[];
  intent: string;
  brief: string;
  photos: PhotoSlot[];
  make: () => Artboard | VideoDocument;
}

export function source(platform: string, title: string, url: string): CorpusSource {
  return { platform, title, url };
}
