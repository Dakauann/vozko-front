"use client";

import type { Media } from "@/lib/medias/types";
import type { LottieLookup, LottieSource } from "@/lib/studio/agent/lottie-ops";
import { LOTTIE_MEDIA_TYPE, readLottieFile } from "@/lib/studio/lottie/lottie-file";

import { loadMediaFile } from "../canvas/media-files";
import type { AssetCatalog } from "./asset-catalog";

export function isLottieMedia(media: Pick<Media, "type">): boolean {
  return media.type === LOTTIE_MEDIA_TYPE;
}

export async function lottieSource(media: Pick<Media, "id" | "description">): Promise<LottieSource> {
  const name = media.description.trim() || media.id;
  const file = await loadMediaFile(media.id);
  if (!file) return { name, animation: null, fault: "notLottie" };
  const read = await readLottieFile(new Uint8Array(await file.blob.arrayBuffer()));
  return read.ok ? { name, animation: read.animation } : { name, animation: null, fault: read.fault };
}

export async function lottieLookupFor(mediaIds: readonly string[], assets: AssetCatalog): Promise<LottieLookup> {
  const sources = new Map<string, LottieSource>();
  await Promise.all(
    [...new Set(mediaIds)].map(async (id) => {
      const entry = await assets.ensure(id);
      if (entry.media && isLottieMedia(entry.media)) sources.set(id, await lottieSource(entry.media));
    }),
  );
  return (id) => sources.get(id);
}
