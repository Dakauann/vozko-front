import { emptyCrmFilter, encodeFilterParam, type CrmFilter } from "@/lib/crm/board";
import { wizardHref as emailWizardHref } from "@/lib/email-campaigns/status";
import { areaIdsOf, withAreaSelection, type AreaSelection } from "@/lib/leads/map-view";
import { screenPaths } from "@/lib/navigation/routes";
import { wizardHref as unofficialWizardHref } from "@/lib/unofficial-whatsapp-campaigns/wizard";
import { wizardHref as whatsappWizardHref } from "@/lib/whatsapp-campaigns/wizard";

import type { AudienceDraft, LeadsPickDraft } from "./draft";
import type { AudienceSpec } from "./types";

export const MAP_TRIP_CHANNELS = ["whatsapp", "unofficial", "email"] as const;

export type MapTripChannel = (typeof MAP_TRIP_CHANNELS)[number];

export interface MapTrip {
  channel: MapTripChannel;
  draftId: string;
}

interface QueryParams {
  get(name: string): string | null;
  toString(): string;
}

const TRIP_CHANNEL_PARAM = "audienceChannel";
const TRIP_DRAFT_PARAM = "audienceDraft";
const AREAS_PARAM = "areas";
const AREAS_EXACT_PARAM = "areasExact";
const AUDIENCE_STEP = "audience";

const WIZARD_HREFS: Record<MapTripChannel, (draftId: string) => string> = {
  whatsapp: (draftId) => whatsappWizardHref(draftId, AUDIENCE_STEP),
  unofficial: (draftId) => unofficialWizardHref(draftId, AUDIENCE_STEP),
  email: (draftId) => emailWizardHref(draftId, AUDIENCE_STEP),
};

function isTripChannel(value: string | null): value is MapTripChannel {
  return (MAP_TRIP_CHANNELS as readonly (string | null)[]).includes(value);
}

export function audienceAreaIdsOf(spec: AudienceSpec | null): string[] {
  const filter = spec?.source === "leads" ? spec.selection?.filter : undefined;
  return filter ? areaIdsOf(filter) : [];
}

export function audienceMapSpecOf(spec: AudienceSpec | null): AudienceSpec | null {
  return spec?.source === "leads" && spec.selection ? { source: "leads", selection: spec.selection } : null;
}

export function mapTripHref(trip: MapTrip, pick: Pick<LeadsPickDraft, "filter" | "search">): string {
  const query = new URLSearchParams({ view: "map", [TRIP_CHANNEL_PARAM]: trip.channel, [TRIP_DRAFT_PARAM]: trip.draftId });
  const filter = encodeFilterParam(pick.filter);
  if (filter) query.set("filter", filter);
  const search = pick.search.trim();
  if (search) query.set("q", search);
  return `${screenPaths.leads}?${query.toString()}`;
}

export function mapTripOf(params: Pick<QueryParams, "get">): MapTrip | null {
  const channel = params.get(TRIP_CHANNEL_PARAM);
  const draftId = params.get(TRIP_DRAFT_PARAM)?.trim() ?? "";
  if (!isTripChannel(channel) || draftId === "") return null;
  return { channel, draftId };
}

export function tripReturnHref(trip: MapTrip, selection: AreaSelection | null): string {
  const href = WIZARD_HREFS[trip.channel](trip.draftId);
  if (!selection) return href;
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set(AREAS_PARAM, [...new Set(selection.ids)].join(","));
  if (selection.exactOnly && selection.ids.length > 0) params.set(AREAS_EXACT_PARAM, "1");
  return `${path}?${params.toString()}`;
}

export function returnedAreasOf(params: Pick<QueryParams, "get">): AreaSelection | null {
  const raw = params.get(AREAS_PARAM);
  if (raw === null) return null;
  const ids = [...new Set(raw.split(",").map((id) => id.trim()).filter((id) => id !== ""))];
  return { ids, exactOnly: ids.length > 0 && params.get(AREAS_EXACT_PARAM) === "1" };
}

export function withReturnedAreas<T extends Partial<AudienceDraft>>(draft: T, selection: AreaSelection | null): T {
  if (!selection) return draft;
  const filter: CrmFilter = withAreaSelection(draft.filter ?? emptyCrmFilter, selection);
  return { ...draft, source: "leads", pick: draft.pick === "first_n" ? "first_n" : "filter", filter };
}
