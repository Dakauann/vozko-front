import { addDays, zonedDayStart } from "@/lib/advertising/date-range";
import type {
  AdBid,
  AdBidStrategy,
  AdBudget,
  AdBudgetKind,
  AdCarouselCard,
  AdCreativeDraftV2,
  AdCreativeFormat,
  AdDayPart,
  AdDraftDestination,
  AdDraftGeoLocation,
  AdDraftSpecialCategory,
  AdDraftTargeting,
  AdMediaKind,
  AdMediaRef,
  AdObjective,
  AdObjectiveRoute,
  AdOptimizationGoal,
  AdPixelEvent,
  AdPlacements,
  AdPagePost,
  AdPostPlatform,
  AdSetDraft,
  MetaAdDraft,
} from "@/lib/advertising/draft-types";
import { inputToMinor } from "@/lib/advertising/money";
import { formatsFor, goalsFor, isMessaging, linkRequired, needsPixel, showsCallToAction, showsLink } from "@/lib/advertising/wizard-routes";

export const MIN_AGE = 13;
export const MAX_AGE = 65;
export const RESTRICTED_MIN_AGE = 18;
export const ADVANTAGE_MAX_AGE_MIN = 25;
export const RESTRICTED_RADIUS_KM = 25;
export const MIN_CITY_RADIUS_KM = 17;
export const MAX_CITY_RADIUS_KM = 80;
export const MAX_GREETING = 300;
export const MAX_ICE_BREAKERS = 3;
export const MAX_ICE_BREAKER = 80;
export const MAX_PRIMARY_TEXT = 2200;
export const MAX_HEADLINE = 255;
export const MAX_NAME = 400;
export const MIN_CAROUSEL_CARDS = 2;
export const MAX_CAROUSEL_CARDS = 10;
export const MAX_FLEXIBLE_TEXTS = 5;
export const MAX_FLEXIBLE_MEDIAS = 10;
export const MAX_ROAS_FLOOR = 1000;

export const SPECIAL_CATEGORIES: AdDraftSpecialCategory[] = ["NONE", "HOUSING", "EMPLOYMENT", "FINANCIAL_PRODUCTS_SERVICES"];
export const BID_STRATEGIES: AdBidStrategy[] = [
  "LOWEST_COST_WITHOUT_CAP",
  "LOWEST_COST_WITH_BID_CAP",
  "COST_CAP",
  "LOWEST_COST_WITH_MIN_ROAS",
];
export const LOWEST_COST: AdBidStrategy = "LOWEST_COST_WITHOUT_CAP";

export type WizardMode = "new" | "campaign" | "adSet" | "creative";
export type StartMode = "now" | "date";

export interface BudgetInput {
  kind: AdBudgetKind;
  input: string;
}

export interface BidInput {
  strategy: AdBidStrategy;
  amountInput: string;
  roasInput: string;
}

export interface ParentSummary {
  metaId: string;
  name: string;
  campaignId?: string;
  objective?: string;
  goal?: string;
  destination?: string;
  dailyBudget: number;
  lifetimeBudget: number;
}

export interface MediaChoice {
  kind: AdMediaKind;
  mediaId: string;
  url: string;
}

export interface CardForm {
  media: MediaChoice | null;
  headline: string;
  description: string;
  link: string;
}

export interface PostChoice {
  id: string;
  platform: AdPostPlatform;
  message?: string;
  pictureUrl?: string;
}

export interface AdForm {
  id: string;
  name: string;
  format: AdCreativeFormat;
  primaryText: string;
  headline: string;
  description: string;
  media: MediaChoice | null;
  cards: CardForm[];
  texts: string[];
  headlines: string[];
  descriptions: string[];
  medias: MediaChoice[];
  post: PostChoice | null;
  instantExperienceId: string;
  link: string;
  displayLink: string;
  callToAction: string;
  leadFormId: string;
  greeting: string;
  iceBreakers: string[];
  enhancements: boolean;
}

export interface WizardForm {
  accountId: string;
  mode: WizardMode;
  campaignParent: ParentSummary | null;
  adSetParent: ParentSummary | null;
  editAdId: string;
  objective: AdObjective | "";
  campaignName: string;
  specialCategory: AdDraftSpecialCategory;
  campaignBudgetOn: boolean;
  campaignBudget: BudgetInput;
  campaignBid: BidInput;
  pageId: string;
  instagramUserId: string;
  adSetName: string;
  destination: AdDraftDestination | "";
  goal: AdOptimizationGoal | "";
  whatsAppNumber: string;
  pixelId: string;
  pixelEvent: AdPixelEvent | "";
  appId: string;
  appStoreUrl: string;
  catalogId: string;
  productSetId: string;
  adSetBudget: BudgetInput;
  adSetBid: BidInput;
  startMode: StartMode;
  startDay: string;
  endDay: string;
  scheduleOn: boolean;
  schedule: AdDayPart[];
  targeting: AdDraftTargeting;
  placements: AdPlacements;
  ads: AdForm[];
  keepPaused: boolean;
}

export interface DraftContext {
  timezone: string;
  currency: string;
}

export function newAdId(): string {
  return `ad-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCard(): CardForm {
  return { media: null, headline: "", description: "", link: "" };
}

export function emptyAdForm(id = newAdId()): AdForm {
  return {
    id,
    name: "",
    format: "IMAGE",
    primaryText: "",
    headline: "",
    description: "",
    media: null,
    cards: [emptyCard(), emptyCard()],
    texts: [""],
    headlines: [""],
    descriptions: [],
    medias: [],
    post: null,
    instantExperienceId: "",
    link: "",
    displayLink: "",
    callToAction: "",
    leadFormId: "",
    greeting: "",
    iceBreakers: [],
    enhancements: false,
  };
}

const emptyBid = (): BidInput => ({ strategy: LOWEST_COST, amountInput: "", roasInput: "" });

export function emptyTargeting(): AdDraftTargeting {
  return { locations: [], ageMin: RESTRICTED_MIN_AGE, ageMax: MAX_AGE, advantageAudience: true };
}

export function emptyWizardForm(accountId = ""): WizardForm {
  return {
    accountId,
    mode: "new",
    campaignParent: null,
    adSetParent: null,
    editAdId: "",
    objective: "",
    campaignName: "",
    specialCategory: "NONE",
    campaignBudgetOn: false,
    campaignBudget: { kind: "DAILY", input: "" },
    campaignBid: emptyBid(),
    pageId: "",
    instagramUserId: "",
    adSetName: "",
    destination: "",
    goal: "",
    whatsAppNumber: "",
    pixelId: "",
    pixelEvent: "",
    appId: "",
    appStoreUrl: "",
    catalogId: "",
    productSetId: "",
    adSetBudget: { kind: "DAILY", input: "" },
    adSetBid: emptyBid(),
    startMode: "now",
    startDay: "",
    endDay: "",
    scheduleOn: false,
    schedule: [],
    targeting: emptyTargeting(),
    placements: { automatic: true },
    ads: [emptyAdForm()],
    keepPaused: false,
  };
}

export function isRestrictedCategory(category: AdDraftSpecialCategory): boolean {
  return category !== "NONE";
}

export function minCityRadius(category: AdDraftSpecialCategory): number {
  return isRestrictedCategory(category) ? RESTRICTED_RADIUS_KM : MIN_CITY_RADIUS_KM;
}

function restrictedLocation(location: AdDraftGeoLocation): AdDraftGeoLocation {
  if (location.kind !== "city") return location;
  return { ...location, radiusKm: Math.max(location.radiusKm ?? RESTRICTED_RADIUS_KM, RESTRICTED_RADIUS_KM) };
}

export function withSpecialCategory(form: WizardForm, category: AdDraftSpecialCategory): WizardForm {
  if (!isRestrictedCategory(category)) return { ...form, specialCategory: category };
  return {
    ...form,
    specialCategory: category,
    targeting: {
      ...form.targeting,
      ageMin: RESTRICTED_MIN_AGE,
      ageMax: MAX_AGE,
      genders: undefined,
      locations: form.targeting.locations.map(restrictedLocation),
      excludedLocations: undefined,
      excludedCustomAudiences: undefined,
    },
  };
}

export function ageMinOptions(targeting: AdDraftTargeting, category: AdDraftSpecialCategory): number[] {
  const from = targeting.advantageAudience || isRestrictedCategory(category) ? RESTRICTED_MIN_AGE : MIN_AGE;
  const to = targeting.advantageAudience ? ADVANTAGE_MAX_AGE_MIN : MAX_AGE;
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

export function withAdvantageAudience(targeting: AdDraftTargeting, on: boolean): AdDraftTargeting {
  if (!on) return { ...targeting, advantageAudience: false };
  return {
    ...targeting,
    advantageAudience: true,
    ageMin: Math.min(ADVANTAGE_MAX_AGE_MIN, Math.max(RESTRICTED_MIN_AGE, targeting.ageMin)),
    ageMax: MAX_AGE,
  };
}

function firstGoal(
  routes: AdObjectiveRoute[],
  destination: AdDraftDestination | "",
  current: AdOptimizationGoal | "",
): AdOptimizationGoal | "" {
  const goals = goalsFor(routes, destination);
  if (current && goals.includes(current)) return current;
  return goals[0] ?? "";
}

function fitAdsToDestination(ads: AdForm[], destination: AdDraftDestination | ""): AdForm[] {
  const allowed = formatsFor(destination);
  return ads.map((ad) => (allowed.includes(ad.format) ? ad : { ...ad, format: allowed[0] }));
}

export function withGoal(form: WizardForm, goal: AdOptimizationGoal | ""): WizardForm {
  const roasLost = form.adSetBid.strategy === "LOWEST_COST_WITH_MIN_ROAS" && goal !== "VALUE";
  return { ...form, goal, adSetBid: roasLost ? { ...form.adSetBid, strategy: LOWEST_COST } : form.adSetBid };
}

export function withDestination(form: WizardForm, destination: AdDraftDestination | "", routes: AdObjectiveRoute[]): WizardForm {
  return withGoal({ ...form, destination, ads: fitAdsToDestination(form.ads, destination) }, firstGoal(routes, destination, form.goal));
}

export function withObjective(form: WizardForm, objective: AdObjective, routes: AdObjectiveRoute[]): WizardForm {
  const keep = routes.some((route) => route.destination === form.destination);
  const destination = keep ? form.destination : (routes[0]?.destination ?? "");
  return withDestination({ ...form, objective }, destination, routes);
}

export function campaignBudgetActive(form: WizardForm): boolean {
  if (form.mode === "new") return form.campaignBudgetOn;
  const parent = form.campaignParent;
  return !!parent && (parent.dailyBudget > 0 || parent.lifetimeBudget > 0);
}

export function effectiveBudgetKind(form: WizardForm): AdBudgetKind | null {
  if (form.mode === "new") return form.campaignBudgetOn ? form.campaignBudget.kind : form.adSetBudget.kind;
  const parent = form.campaignParent;
  if (parent && parent.lifetimeBudget > 0) return "LIFETIME";
  if (parent && parent.dailyBudget > 0) return "DAILY";
  return form.adSetBudget.kind;
}

export function scheduleAvailable(form: WizardForm): boolean {
  return effectiveBudgetKind(form) === "LIFETIME";
}

export function budgetFromInput(budget: BudgetInput, currency: string): AdBudget {
  return { kind: budget.kind, amount: inputToMinor(budget.input, currency) ?? 0 };
}

export function parseRoas(raw: string): number | null {
  const value = Number(raw.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 && value <= MAX_ROAS_FLOOR ? value : null;
}

export function bidFromInput(bid: BidInput, currency: string): AdBid {
  switch (bid.strategy) {
    case "LOWEST_COST_WITH_BID_CAP":
    case "COST_CAP":
      return { strategy: bid.strategy, amount: inputToMinor(bid.amountInput, currency) ?? 0 };
    case "LOWEST_COST_WITH_MIN_ROAS":
      return { strategy: bid.strategy, roasFloor: parseRoas(bid.roasInput) ?? 0 };
  }
  return { strategy: LOWEST_COST };
}

export function bidStrategiesFor(level: "campaign" | "adSet", goal: AdOptimizationGoal | ""): AdBidStrategy[] {
  return BID_STRATEGIES.filter((strategy) => strategy !== "LOWEST_COST_WITH_MIN_ROAS" || (level === "adSet" && goal === "VALUE"));
}

function trimmed(value: string): string | undefined {
  const text = value.trim();
  return text === "" ? undefined : text;
}

function nonBlank(values: string[]): string[] | undefined {
  const kept = values.map((value) => value.trim()).filter(Boolean);
  return kept.length > 0 ? kept : undefined;
}

function mediaRef(media: MediaChoice | null): AdMediaRef | undefined {
  return media ? { kind: media.kind, mediaId: media.mediaId } : undefined;
}

function cardDraft(card: CardForm, destination: AdDraftDestination | ""): AdCarouselCard {
  return {
    media: mediaRef(card.media) ?? { kind: "image", mediaId: "" },
    headline: trimmed(card.headline),
    description: trimmed(card.description),
    link: destination === "WEBSITE" ? trimmed(card.link) : undefined,
  };
}

export function buildCreative(ad: AdForm, destination: AdDraftDestination | ""): AdCreativeDraftV2 {
  const creative: AdCreativeDraftV2 = { format: ad.format };
  const textual = ad.format !== "EXISTING_POST" && ad.format !== "FLEXIBLE";
  if (textual) {
    creative.primaryText = ad.primaryText.trim();
    creative.headline = trimmed(ad.headline);
    creative.description = trimmed(ad.description);
  }
  switch (ad.format) {
    case "IMAGE":
    case "VIDEO":
      creative.media = mediaRef(ad.media);
      break;
    case "CAROUSEL":
      creative.cards = ad.cards.map((card) => cardDraft(card, destination));
      break;
    case "FLEXIBLE":
      creative.texts = nonBlank(ad.texts);
      creative.headlines = nonBlank(ad.headlines);
      creative.descriptions = nonBlank(ad.descriptions);
      creative.medias = ad.medias.map((media) => ({ kind: media.kind, mediaId: media.mediaId }));
      break;
    case "EXISTING_POST":
      if (ad.post?.platform === "instagram") creative.instagramMediaId = ad.post.id;
      else if (ad.post) creative.postId = ad.post.id;
      break;
    case "COLLECTION":
      creative.instantExperienceId = trimmed(ad.instantExperienceId);
      creative.media = mediaRef(ad.media);
      break;
  }
  if (showsLink(destination) && (linkRequired(destination, ad.format) || ad.format === "CAROUSEL")) {
    creative.link = trimmed(ad.link);
    creative.displayLink = trimmed(ad.displayLink);
  }
  if (showsCallToAction(destination)) creative.callToAction = trimmed(ad.callToAction);
  if (destination === "ON_AD") creative.leadFormId = trimmed(ad.leadFormId);
  if (isMessaging(destination)) {
    creative.greeting = trimmed(ad.greeting);
    creative.iceBreakers = nonBlank(ad.iceBreakers);
  }
  if (ad.enhancements) creative.enhancements = true;
  return creative;
}

function flightDates(form: WizardForm, timezone: string): Pick<AdSetDraft, "startAt" | "endAt"> {
  const startAt = form.startMode === "date" && form.startDay ? zonedDayStart(form.startDay, timezone) : null;
  const endAt = form.endDay ? zonedDayStart(addDays(form.endDay, 1), timezone) : null;
  return { startAt: startAt ?? undefined, endAt: endAt ?? undefined };
}

export function cleanTargeting(targeting: AdDraftTargeting, category: AdDraftSpecialCategory): AdDraftTargeting {
  const restricted = isRestrictedCategory(category);
  const list = <T>(values: T[] | undefined) => (values && values.length > 0 ? values : undefined);
  return {
    locations: targeting.locations,
    excludedLocations: restricted ? undefined : list(targeting.excludedLocations),
    ageMin: targeting.ageMin,
    ageMax: targeting.ageMax,
    genders: restricted ? undefined : list(targeting.genders),
    languages: list(targeting.languages),
    interests: list(targeting.interests),
    behaviors: list(targeting.behaviors),
    customAudiences: list(targeting.customAudiences),
    excludedCustomAudiences: restricted ? undefined : list(targeting.excludedCustomAudiences),
    advantageAudience: targeting.advantageAudience,
  };
}

export function cleanPlacements(placements: AdPlacements): AdPlacements {
  if (placements.automatic) return { automatic: true };
  const platforms = placements.platforms ?? [];
  const positions = Object.fromEntries(
    Object.entries(placements.positions ?? {}).filter(([platform, list]) => platforms.includes(platform) && list.length > 0),
  );
  return {
    automatic: false,
    platforms,
    positions: Object.keys(positions).length > 0 ? positions : undefined,
    devices: placements.devices && placements.devices.length > 0 ? placements.devices : undefined,
  };
}

function buildAdSet(form: WizardForm, context: DraftContext): MetaAdDraft["adSet"] {
  if (form.mode === "adSet" && form.adSetParent) {
    return {
      existingId: form.adSetParent.metaId,
      destination: form.destination || undefined,
      goal: form.goal || undefined,
      targeting: emptyTargeting(),
      placements: { automatic: true },
    };
  }
  const destination = form.destination;
  const ownBudget = !campaignBudgetActive(form);
  const adSet: AdSetDraft = {
    name: trimmed(form.adSetName),
    destination: destination || undefined,
    goal: form.goal || undefined,
    ...flightDates(form, context.timezone),
    targeting: cleanTargeting(form.targeting, form.specialCategory),
    placements: cleanPlacements(form.placements),
  };
  if (ownBudget) {
    adSet.budget = budgetFromInput(form.adSetBudget, context.currency);
    adSet.bid = bidFromInput(form.adSetBid, context.currency);
  } else {
    adSet.bid = { strategy: LOWEST_COST };
  }
  if (destination === "WHATSAPP") adSet.whatsAppNumber = trimmed(form.whatsAppNumber);
  if (needsPixel(form.goal, destination)) {
    adSet.pixelId = trimmed(form.pixelId);
    adSet.pixelEvent = form.pixelEvent || undefined;
  }
  if (destination === "APP") {
    adSet.appId = trimmed(form.appId);
    adSet.appStoreUrl = trimmed(form.appStoreUrl);
  }
  if (destination === "CATALOG") {
    adSet.catalogId = trimmed(form.catalogId);
    adSet.productSetId = trimmed(form.productSetId);
  }
  if (scheduleAvailable(form) && form.scheduleOn && form.schedule.length > 0) adSet.schedule = form.schedule;
  return adSet;
}

function buildCampaign(form: WizardForm, context: DraftContext): MetaAdDraft["campaign"] {
  if (form.mode !== "new") {
    return { existingId: form.campaignParent?.metaId ?? form.adSetParent?.campaignId, objective: form.objective || undefined };
  }
  return {
    name: form.campaignName.trim(),
    objective: form.objective || undefined,
    specialCategory: form.specialCategory,
    budget: form.campaignBudgetOn ? budgetFromInput(form.campaignBudget, context.currency) : undefined,
    bid: form.campaignBudgetOn ? bidFromInput(form.campaignBid, context.currency) : { strategy: LOWEST_COST },
  };
}

export function buildDraft(form: WizardForm, context: DraftContext): MetaAdDraft {
  return {
    adAccountId: form.accountId,
    identity: { pageId: form.pageId, instagramUserId: trimmed(form.instagramUserId) },
    campaign: buildCampaign(form, context),
    adSet: buildAdSet(form, context),
    ads: form.ads.map((ad) => ({ name: trimmed(ad.name), creative: buildCreative(ad, form.destination) })),
    keepPaused: form.keepPaused || undefined,
  };
}

export function duplicateAd(ad: AdForm, suffix: string): AdForm {
  return { ...structuredClone(ad), id: newAdId(), name: ad.name.trim() ? `${ad.name.trim()} ${suffix}` : "" };
}

export function parentFromRow(row: {
  metaId: string;
  name: string;
  campaignId?: string;
  objective?: string;
  optimizationGoal?: string;
  destinationType?: string;
  dailyBudget: number;
  lifetimeBudget: number;
}): ParentSummary {
  return {
    metaId: row.metaId,
    name: row.name,
    campaignId: row.campaignId,
    objective: row.objective,
    goal: row.optimizationGoal,
    destination: row.destinationType,
    dailyBudget: row.dailyBudget ?? 0,
    lifetimeBudget: row.lifetimeBudget ?? 0,
  };
}

export function withParents(form: WizardForm, campaign: ParentSummary | null, adSet: ParentSummary | null): WizardForm {
  const mode: WizardMode = adSet ? "adSet" : campaign ? "campaign" : "new";
  const next: WizardForm = { ...form, mode, campaignParent: campaign, adSetParent: adSet };
  if (campaign?.objective) next.objective = campaign.objective as AdObjective;
  if (campaign) next.campaignName = campaign.name;
  if (adSet) {
    next.destination = (adSet.destination || "NONE") as AdDraftDestination;
    next.goal = (adSet.goal ?? "") as AdOptimizationGoal | "";
    next.adSetName = adSet.name;
    next.ads = fitAdsToDestination(next.ads, next.destination);
  }
  return next;
}

export interface CreativeSource {
  metaId: string;
  name: string;
  creative: AdCreativeDraftV2;
  previewUrl?: string;
  mediaUrls?: Record<string, string>;
  posts?: Record<string, AdPagePost>;
  pageId?: string;
  instagramUserId?: string;
}

function choice(media: AdMediaRef | undefined, url = ""): MediaChoice | null {
  return media?.mediaId ? { kind: media.kind, mediaId: media.mediaId, url } : null;
}

function postChoice(id: string, platform: AdPostPlatform, source: CreativeSource): PostChoice {
  const post = source.posts?.[id];
  return { id, platform, message: post?.message, pictureUrl: post?.pictureUrl ?? source.previewUrl };
}

export function adFormFromCreative(source: CreativeSource): AdForm {
  const creative = source.creative;
  const base = emptyAdForm();
  const urls = source.mediaUrls ?? {};
  const resolved = (media: AdMediaRef | undefined, fallback = "") => choice(media, (media && urls[media.mediaId]) || fallback);
  const listOr = (values: string[] | undefined, fallback: string[]) => (values && values.length > 0 ? [...values] : fallback);
  const postId = creative.instagramMediaId || creative.postId;
  return {
    ...base,
    name: source.name,
    format: creative.format,
    primaryText: creative.primaryText ?? "",
    headline: creative.headline ?? "",
    description: creative.description ?? "",
    media: resolved(creative.media, source.previewUrl),
    cards:
      creative.cards && creative.cards.length > 0
        ? creative.cards.map((card) => ({
            media: resolved(card.media),
            headline: card.headline ?? "",
            description: card.description ?? "",
            link: card.link ?? "",
          }))
        : base.cards,
    texts: listOr(creative.texts, base.texts),
    headlines: listOr(creative.headlines, base.headlines),
    descriptions: listOr(creative.descriptions, base.descriptions),
    medias: (creative.medias ?? []).map((media) => resolved(media)).filter((media): media is MediaChoice => media !== null),
    post: postId ? postChoice(postId, creative.instagramMediaId ? "instagram" : "facebook", source) : null,
    instantExperienceId: creative.instantExperienceId ?? "",
    link: creative.link ?? "",
    displayLink: creative.displayLink ?? "",
    callToAction: creative.callToAction ?? "",
    leadFormId: creative.leadFormId ?? "",
    greeting: creative.greeting ?? "",
    iceBreakers: creative.iceBreakers ?? [],
    enhancements: creative.enhancements ?? false,
  };
}

export function withCreativeEdit(
  form: WizardForm,
  campaign: ParentSummary | null,
  adSet: ParentSummary | null,
  source: CreativeSource,
): WizardForm {
  return {
    ...withParents(form, campaign, adSet),
    mode: "creative",
    editAdId: source.metaId,
    pageId: source.pageId ?? form.pageId,
    instagramUserId: source.instagramUserId ?? form.instagramUserId,
    ads: [adFormFromCreative(source)],
  };
}
