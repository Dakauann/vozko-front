import type { AdBudgetMinimum, AdLocationKind } from "@/lib/advertising/types";

export type AdObjective =
  "OUTCOME_AWARENESS" | "OUTCOME_TRAFFIC" | "OUTCOME_ENGAGEMENT" | "OUTCOME_LEADS" | "OUTCOME_SALES" | "OUTCOME_APP_PROMOTION";

export type AdDraftDestination =
  "WHATSAPP" | "MESSENGER" | "INSTAGRAM_DIRECT" | "WEBSITE" | "ON_AD" | "APP" | "ON_POST" | "CATALOG" | "NONE";

export type AdOptimizationGoal =
  | "REACH"
  | "IMPRESSIONS"
  | "AD_RECALL_LIFT"
  | "THRUPLAY"
  | "LINK_CLICKS"
  | "LANDING_PAGE_VIEWS"
  | "POST_ENGAGEMENT"
  | "CONVERSATIONS"
  | "LEAD_GENERATION"
  | "QUALITY_LEAD"
  | "OFFSITE_CONVERSIONS"
  | "VALUE"
  | "APP_INSTALLS";

export type AdDraftSpecialCategory = "NONE" | "HOUSING" | "EMPLOYMENT" | "FINANCIAL_PRODUCTS_SERVICES";

export type AdBudgetKind = "DAILY" | "LIFETIME";

export interface AdBudget {
  kind: AdBudgetKind;
  amount: number;
}

export type AdBidStrategy = "LOWEST_COST_WITHOUT_CAP" | "LOWEST_COST_WITH_BID_CAP" | "COST_CAP" | "LOWEST_COST_WITH_MIN_ROAS";

export interface AdBid {
  strategy: AdBidStrategy;
  amount?: number;
  roasFloor?: number;
}

export interface AdDayPart {
  days: number[];
  startMinute: number;
  endMinute: number;
}

export interface AdDraftGeoLocation {
  kind: AdLocationKind;
  key: string;
  name: string;
  radiusKm?: number;
}

export interface AdTargetRef {
  id: string;
  name: string;
}

export interface AdDraftTargeting {
  locations: AdDraftGeoLocation[];
  excludedLocations?: AdDraftGeoLocation[];
  ageMin: number;
  ageMax: number;
  genders?: number[];
  languages?: AdTargetRef[];
  interests?: AdTargetRef[];
  behaviors?: AdTargetRef[];
  customAudiences?: AdTargetRef[];
  excludedCustomAudiences?: AdTargetRef[];
  advantageAudience: boolean;
}

export type AdDevice = "mobile" | "desktop";

export interface AdPlacements {
  automatic: boolean;
  platforms?: string[];
  positions?: Record<string, string[]>;
  devices?: AdDevice[];
}

export type AdPixelEvent =
  "PURCHASE" | "LEAD" | "COMPLETE_REGISTRATION" | "ADD_TO_CART" | "INITIATE_CHECKOUT" | "CONTACT" | "SCHEDULE" | "SUBSCRIBE";

export type AdCreativeFormat = "IMAGE" | "VIDEO" | "CAROUSEL" | "EXISTING_POST" | "FLEXIBLE" | "CATALOG" | "COLLECTION";

export type AdMediaKind = "image" | "video";

export interface AdMediaRef {
  kind: AdMediaKind;
  mediaId: string;
}

export interface AdCarouselCard {
  media: AdMediaRef;
  headline?: string;
  description?: string;
  link?: string;
}

export interface AdCreativeDraftV2 {
  format: AdCreativeFormat;
  primaryText?: string;
  headline?: string;
  description?: string;
  media?: AdMediaRef;
  cards?: AdCarouselCard[];
  texts?: string[];
  headlines?: string[];
  descriptions?: string[];
  medias?: AdMediaRef[];
  postId?: string;
  instagramMediaId?: string;
  instantExperienceId?: string;
  link?: string;
  displayLink?: string;
  callToAction?: string;
  leadFormId?: string;
  greeting?: string;
  iceBreakers?: string[];
  enhancements?: boolean;
}

export interface AdItemDraft {
  name?: string;
  creative: AdCreativeDraftV2;
}

export interface AdIdentity {
  pageId: string;
  instagramUserId?: string;
}

export interface AdCampaignDraft {
  existingId?: string;
  name?: string;
  objective?: AdObjective;
  specialCategory?: AdDraftSpecialCategory;
  budget?: AdBudget;
  bid?: AdBid;
}

export interface AdSetDraft {
  existingId?: string;
  name?: string;
  destination?: AdDraftDestination;
  goal?: AdOptimizationGoal;
  whatsAppNumber?: string;
  pixelId?: string;
  pixelEvent?: AdPixelEvent;
  appId?: string;
  appStoreUrl?: string;
  catalogId?: string;
  productSetId?: string;
  budget?: AdBudget;
  bid?: AdBid;
  startAt?: string;
  endAt?: string;
  schedule?: AdDayPart[];
  targeting: AdDraftTargeting;
  placements: AdPlacements;
}

export interface MetaAdDraft {
  adAccountId: string;
  identity: AdIdentity;
  campaign: AdCampaignDraft;
  adSet: AdSetDraft;
  ads: AdItemDraft[];
  keepPaused?: boolean;
}

export interface AdObjectiveRoute {
  destination: AdDraftDestination;
  goals: AdOptimizationGoal[];
}

export interface AdObjectiveOption {
  objective: AdObjective;
  routes: AdObjectiveRoute[];
}

export interface AdsOptions {
  objectives: AdObjectiveOption[];
  callsToAction: string[];
  destinationCallsToAction: Partial<Record<AdDraftDestination, string[]>>;
  placements: Record<string, string[]>;
  breakdownGroups: string[][] | null;
  attributionWindows: string[] | null;
  pixelEvents: AdPixelEvent[];
  formats: AdCreativeFormat[];
  videoOnlyPositions: Record<string, string[]>;
  automaticPlatforms: string[];
}

export interface AdTargetingOption {
  id: string;
  name: string;
  path?: string[];
  audienceMin?: number;
  audienceMax?: number;
}

export type AdTargetingSearchKind = "interests" | "behaviors" | "languages";

export interface AdReachEstimate {
  lower: number;
  upper: number;
  ready: boolean;
}

export interface AdProductSet {
  id: string;
  name: string;
  productCount: number;
}

export interface AdCatalog {
  id: string;
  name: string;
  productSets: AdProductSet[] | null;
}

export interface AdApp {
  id: string;
  name: string;
  storeUrls: string[] | null;
  iconUrl?: string;
}

export type AdPostPlatform = "facebook" | "instagram";

export interface AdPagePost {
  id: string;
  platform: AdPostPlatform;
  message?: string;
  pictureUrl?: string;
  permalink?: string;
  createdTime?: string;
}

export interface AdInstantExperience {
  id: string;
  name: string;
}

export interface AdDraftFee {
  price: number;
  currency: string;
  total: number;
}

export interface AdDraftValidation {
  issues: { field: string; code: string }[] | null;
  fee?: AdDraftFee;
  budgetMinimum?: AdBudgetMinimum;
}
