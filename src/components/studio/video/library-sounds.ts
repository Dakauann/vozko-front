"use client";

import { useMemo } from "react";

import type { Media } from "@/lib/medias/types";
import { mediaSoundItem } from "@/lib/studio/library/builtin/sounds";
import type { LibraryItem } from "@/lib/studio/library/model";
import { clipTypeForMedia } from "@/lib/studio/media-clips";

import type { AssetCatalog } from "./asset-catalog";
import { useAssetState, useVideoEditor } from "./editor-context";

export function workspaceSounds(medias: readonly Media[], assets: AssetCatalog): LibraryItem[] {
  const measured = (id: string) => assets.store.getState().assets[id]?.durationMs;
  return medias
    .filter((media) => clipTypeForMedia(media.type) === "audio")
    .flatMap(
      (media) =>
        mediaSoundItem(media, {
          durationMs: () => measured(media.id),
          assets: { loaded: () => measured(media.id) !== undefined, load: () => assets.sourceDuration(media.id).then(() => undefined) },
        }) ?? [],
    );
}

export function useWorkspaceSounds(): readonly LibraryItem[] {
  const { assets } = useVideoEditor();
  const medias = useAssetState((s) => s.library.medias);
  return useMemo(() => workspaceSounds(medias, assets), [medias, assets]);
}
