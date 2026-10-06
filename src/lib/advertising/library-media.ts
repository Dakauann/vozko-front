import type { Media } from "@/lib/medias/types";

import type { MediaChoice } from "./draft";
import type { AdMediaKind } from "./draft-types";

const AD_MEDIA_KINDS: readonly AdMediaKind[] = ["image", "video"];

function adMediaKind(type: string): AdMediaKind | null {
  return AD_MEDIA_KINDS.find((kind) => kind === type) ?? null;
}

export function libraryChoices(medias: Media[], accept: AdMediaKind | "any"): MediaChoice[] {
  return medias.flatMap((media) => {
    const kind = adMediaKind(media.type);
    if (!kind || !media.url || (accept !== "any" && kind !== accept)) return [];
    return [{ kind, mediaId: media.id, url: media.url }];
  });
}
