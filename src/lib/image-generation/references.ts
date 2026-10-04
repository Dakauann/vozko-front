import { MAX_REFERENCE_IMAGES } from "./types";

export interface ImageReference {
  mediaId: string;
  url: string;
}

export function withReference<T extends ImageReference>(current: T[], next: T): T[] {
  if (current.length >= MAX_REFERENCE_IMAGES || current.some((item) => item.mediaId === next.mediaId)) return current;
  return [...current, next];
}
