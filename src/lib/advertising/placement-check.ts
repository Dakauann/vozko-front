import type { AdForm, MediaChoice } from "./draft";
import type { PixelSize, PlacementPlan } from "./placement-frames";

type CreativeMedia = Pick<AdForm, "format" | "media" | "medias"> & { cards: Pick<AdForm["cards"][number], "media">[] };

const LIBRARY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function creativeImages(ad: CreativeMedia): MediaChoice[] {
  const all = [ad.media, ...ad.cards.map((card) => card.media), ...ad.medias];
  const seen = new Set<string>();
  return all.filter((media): media is MediaChoice => {
    if (!media || media.kind !== "image" || !media.url || seen.has(media.mediaId)) return false;
    seen.add(media.mediaId);
    return true;
  });
}

export function studioSizesFor(plan: PlacementPlan): PixelSize[] {
  const sizes: PixelSize[] = [];
  for (const { frame } of plan.frames) {
    if (!sizes.some((s) => s.width === frame.recommended.width && s.height === frame.recommended.height)) sizes.push({ ...frame.recommended });
  }
  return sizes;
}

export function libraryMedia(media: MediaChoice): boolean {
  return LIBRARY_ID.test(media.mediaId);
}
