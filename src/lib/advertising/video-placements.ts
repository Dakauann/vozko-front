import type { AdCreativeFormat, AdPlacements, AdsOptions } from "@/lib/advertising/draft-types";
import type { AdForm } from "@/lib/advertising/draft";

export interface SkippedPlacement {
  platform: string;
  position: string;
}

type CreativeMedia = Pick<AdForm, "format" | "media" | "medias"> & { cards: Pick<AdForm["cards"][number], "media">[] };

type VideoCatalog = Partial<Pick<AdsOptions, "videoOnlyPositions" | "automaticPlatforms">>;

const FORMATS_WITHOUT_VIDEO_UNLESS_ADDED: AdCreativeFormat[] = ["IMAGE", "CAROUSEL", "FLEXIBLE"];

function hasVideo(ad: CreativeMedia): boolean {
  return ad.media?.kind === "video" || ad.medias.some((m) => m.kind === "video") || ad.cards.some((card) => card.media?.kind === "video");
}

export function videoOnlyPlacementsSkipped(placements: AdPlacements, ad: CreativeMedia, catalog: VideoCatalog): SkippedPlacement[] {
  if (!FORMATS_WITHOUT_VIDEO_UNLESS_ADDED.includes(ad.format) || hasVideo(ad)) return [];
  const videoOnly = catalog.videoOnlyPositions ?? {};
  const platforms = placements.automatic ? (catalog.automaticPlatforms ?? []) : (placements.platforms ?? []);
  return platforms.flatMap((platform) => {
    const chosen = placements.automatic ? null : placements.positions?.[platform];
    return (videoOnly[platform] ?? [])
      .filter((position) => !chosen?.length || chosen.includes(position))
      .map((position) => ({ platform, position }));
  });
}
