import type {
  AdCreativeFormat,
  AdDraftDestination,
  AdObjective,
  AdObjectiveRoute,
  AdOptimizationGoal,
  AdPlacements,
  AdsOptions,
} from "@/lib/advertising/draft-types";

export const OBJECTIVES: AdObjective[] = [
  "OUTCOME_AWARENESS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
  "OUTCOME_APP_PROMOTION",
];

export const MESSAGING_DESTINATIONS: AdDraftDestination[] = ["WHATSAPP", "MESSENGER", "INSTAGRAM_DIRECT"];

export const ALL_FORMATS: AdCreativeFormat[] = ["IMAGE", "VIDEO", "CAROUSEL", "EXISTING_POST", "FLEXIBLE", "CATALOG", "COLLECTION"];

export const MAX_ADS = 10;

export function isObjective(value: string | undefined | null): value is AdObjective {
  return !!value && (OBJECTIVES as string[]).includes(value);
}

export function routesFor(options: AdsOptions | null, objective: AdObjective | ""): AdObjectiveRoute[] {
  if (!options || !objective) return [];
  return options.objectives.find((candidate) => candidate.objective === objective)?.routes ?? [];
}

export function goalsFor(routes: AdObjectiveRoute[], destination: AdDraftDestination | ""): AdOptimizationGoal[] {
  return routes.find((route) => route.destination === destination)?.goals ?? [];
}

export function isMessaging(destination: AdDraftDestination | ""): boolean {
  return destination !== "" && MESSAGING_DESTINATIONS.includes(destination);
}

export function needsPixel(goal: AdOptimizationGoal | "", destination: AdDraftDestination | ""): boolean {
  return (goal === "OFFSITE_CONVERSIONS" || goal === "VALUE") && destination !== "CATALOG";
}

export function usesAssetGroups(objective: AdObjective | ""): boolean {
  return objective === "OUTCOME_SALES" || objective === "OUTCOME_APP_PROMOTION";
}

export function formatsFor(destination: AdDraftDestination | ""): AdCreativeFormat[] {
  switch (destination) {
    case "ON_POST":
      return ["EXISTING_POST"];
    case "CATALOG":
      return ["CATALOG", "COLLECTION"];
    case "ON_AD":
    case "WEBSITE":
    case "APP":
    case "NONE":
      return ["IMAGE", "VIDEO", "CAROUSEL", "FLEXIBLE", "EXISTING_POST"];
  }
  return ["IMAGE", "VIDEO", "CAROUSEL", "FLEXIBLE"];
}

export function showsLink(destination: AdDraftDestination | ""): boolean {
  return destination === "WEBSITE" || destination === "CATALOG";
}

export function linkRequired(destination: AdDraftDestination | "", format: AdCreativeFormat): boolean {
  return showsLink(destination) && format !== "EXISTING_POST" && format !== "CAROUSEL";
}

export function showsCallToAction(destination: AdDraftDestination | ""): boolean {
  return destination === "WEBSITE" || destination === "APP" || destination === "CATALOG" || destination === "ON_AD";
}

export function callsToActionFor(
  destination: AdDraftDestination | "",
  byDestination: AdsOptions["destinationCallsToAction"],
): string[] {
  if (destination === "" || !showsCallToAction(destination)) return [];
  return byDestination[destination] ?? [];
}

export function defaultCallToAction(destination: AdDraftDestination | ""): string {
  switch (destination) {
    case "WHATSAPP":
      return "WHATSAPP_MESSAGE";
    case "MESSENGER":
      return "MESSAGE_PAGE";
    case "INSTAGRAM_DIRECT":
      return "INSTAGRAM_MESSAGE";
    case "APP":
      return "INSTALL_MOBILE_APP";
    case "ON_AD":
      return "SIGN_UP";
    case "CATALOG":
      return "SHOP_NOW";
  }
  return "LEARN_MORE";
}

export function resolvedCallToAction(destination: AdDraftDestination | "", chosen: string): string {
  if (isMessaging(destination)) return defaultCallToAction(destination);
  return chosen || defaultCallToAction(destination);
}

export function dynamicCreative(objective: AdObjective | "", formats: AdCreativeFormat[]): boolean {
  return !usesAssetGroups(objective) && formats.includes("FLEXIBLE");
}

export function flexibleAllowed(objective: AdObjective | "", newAdSet: boolean, adCount: number): boolean {
  return usesAssetGroups(objective) || (newAdSet && adCount <= 1);
}

export function canAddAd(objective: AdObjective | "", formats: AdCreativeFormat[]): boolean {
  return formats.length < MAX_ADS && !dynamicCreative(objective, formats);
}

export const POSITIONS_NEEDING_FEED = ["marketplace", "search", "profile_feed", "notification"];

const FEED_POSITION: Record<string, string> = { facebook: "feed" };

export function positionNeedsFeed(platform: string, position: string): boolean {
  return platform === "facebook" && POSITIONS_NEEDING_FEED.includes(position);
}

export function togglePlatform(placements: AdPlacements, platform: string, positions: string[], on: boolean): AdPlacements {
  const platforms = placements.platforms ?? [];
  const nextPositions = { ...(placements.positions ?? {}) };
  if (on) {
    nextPositions[platform] = [...positions];
    return { ...placements, platforms: platforms.includes(platform) ? platforms : [...platforms, platform], positions: nextPositions };
  }
  delete nextPositions[platform];
  return { ...placements, platforms: platforms.filter((candidate) => candidate !== platform), positions: nextPositions };
}

export function togglePosition(placements: AdPlacements, platform: string, position: string, on: boolean): AdPlacements {
  const current = placements.positions?.[platform] ?? [];
  let next = on ? (current.includes(position) ? current : [...current, position]) : current.filter((p) => p !== position);
  if (!on && FEED_POSITION[platform] === position) next = next.filter((p) => !positionNeedsFeed(platform, p));
  if (next.length === 0) return togglePlatform(placements, platform, [], false);
  const platforms = placements.platforms ?? [];
  return {
    ...placements,
    platforms: platforms.includes(platform) ? platforms : [...platforms, platform],
    positions: { ...(placements.positions ?? {}), [platform]: next },
  };
}

export type PlacementWarning = "story_alone" | "audience_network_alone" | "instagram_required" | "facebook_required" | "platforms_required";

export function placementWarnings(placements: AdPlacements, destination: AdDraftDestination | ""): PlacementWarning[] {
  if (placements.automatic) return [];
  const platforms = placements.platforms ?? [];
  const warnings: PlacementWarning[] = [];
  if (platforms.length === 0) warnings.push("platforms_required");
  if (platforms.length === 1 && platforms[0] === "audience_network") warnings.push("audience_network_alone");
  if (Object.values(placements.positions ?? {}).some((positions) => positions.length === 1 && positions[0] === "story")) {
    warnings.push("story_alone");
  }
  if (destination === "INSTAGRAM_DIRECT" && !platforms.includes("instagram")) warnings.push("instagram_required");
  if (destination === "MESSENGER" && !platforms.includes("facebook") && !platforms.includes("messenger")) {
    warnings.push("facebook_required");
  }
  return warnings;
}
