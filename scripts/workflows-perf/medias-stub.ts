import type { Media } from "@/lib/medias/types";

import { IMAGE_FIXTURE_MEDIA } from "./image-fixture";

const LATENCY_MS = 40;

export const mediaReads = { count: 0 };

export async function getMediaAction(mediaId: string): Promise<Media | null> {
  mediaReads.count += 1;
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  return IMAGE_FIXTURE_MEDIA.get(mediaId) ?? null;
}

export async function listLibraryAction() {
  return { data: [...IMAGE_FIXTURE_MEDIA.values()] };
}

export async function listMediasAction() {
  return { medias: [...IMAGE_FIXTURE_MEDIA.values()] };
}

export async function uploadMediaAction() {
  return { mediaId: null, mediaUrl: null, error: "harness" };
}

export async function fetchMediaFileAction() {
  return { data: null, error: "harness" };
}
