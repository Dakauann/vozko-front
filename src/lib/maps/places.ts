import type { CepAddress } from "@/lib/address/cep";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { emptyCrmFilter, encodeFilterParam, type CrmFilter } from "@/lib/crm/board";
import { LEAD_FILTER_FIELD, readSet, withSet } from "@/lib/leads/filters";
import { leadMapsKey, withDistrictPairs } from "@/lib/leads/map-view";

import { MapContractError } from "./contracts";
import { isValidPosition } from "./geometry";
import { isPrecision } from "./precision";
import type { BBox, LatLng, Precision } from "./types";

export const PLACE_KINDS = ["city", "district", "street", "cep"] as const;

export type PlaceKind = (typeof PLACE_KINDS)[number];

export type AddressPlaceKind = Exclude<PlaceKind, "cep">;

export const PLACE_SEARCH_PATH = "/leads/places/search";
export const PLACE_SUGGEST_PATH = "/leads/places/suggest";
export const PLACE_DEBOUNCE_MS = 250;
export const PLACE_QUERY_MIN = 2;
export const PLACE_QUERY_MAX = 60;
export const RECENT_PLACES_MAX = 5;

const CITY_SCOPED_KINDS: ReadonlySet<PlaceKind> = new Set(["district", "street"]);

export interface Place {
  kind: PlaceKind;
  label: string;
  name: string;
  zipCode: string;
  street: string;
  district: string;
  city: string;
  cityCode: string;
  cityKey: string;
  districtPair: string;
  state: string;
  position: LatLng;
  precision: Precision;
  bounds: BBox | null;
  addressCount: number;
  zipCount: number;
}

export interface PlaceAnswer {
  places: Place[];
  coveredStates: string[];
  attribution: string;
}

export interface PlaceRequest {
  kind: PlaceKind | null;
  text: string;
  state?: string;
  cityCode?: string;
}

export function foldPlaceText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function placeRequestReady(request: PlaceRequest): boolean {
  const length = Array.from(request.text.trim()).length;
  if (length < PLACE_QUERY_MIN || length > PLACE_QUERY_MAX || foldPlaceText(request.text) === "") return false;
  return !(request.kind && CITY_SCOPED_KINDS.has(request.kind) && !request.cityCode?.trim());
}

function scope(request: PlaceRequest): { state: string; cityCode: string } {
  return { state: request.state?.trim().toUpperCase() ?? "", cityCode: request.cityCode?.trim() ?? "" };
}

export function placeRequestPath(request: PlaceRequest): string {
  const { state, cityCode } = scope(request);
  const params = new URLSearchParams();
  if (request.kind) params.set("kind", request.kind);
  params.set("q", request.text.trim());
  if (state) params.set("state", state);
  if (cityCode) params.set("cityCode", cityCode);
  return `${request.kind ? PLACE_SUGGEST_PATH : PLACE_SEARCH_PATH}?${params.toString()}`;
}

export function placeQueryKey(workspaceId: string, request: PlaceRequest) {
  const { state, cityCode } = scope(request);
  return [...leadMapsKey(workspaceId), "places", request.kind ?? "all", state, cityCode, foldPlaceText(request.text)] as const;
}

function isPlaceKind(value: unknown): value is PlaceKind {
  return typeof value === "string" && (PLACE_KINDS as readonly string[]).includes(value);
}

function text(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  return typeof value === "string" ? value : "";
}

function count(raw: Record<string, unknown>, key: string): number {
  const value = raw[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function boundsOf(value: unknown): BBox | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new MapContractError("place bounds are not an object");
  const raw = value as Record<string, unknown>;
  const sides = ["south", "west", "north", "east"].map((side) => raw[side]);
  if (!sides.every((side) => typeof side === "number" && Number.isFinite(side))) {
    throw new MapContractError("place bounds have a side that is not a number");
  }
  const [south, west, north, east] = sides as number[];
  if (south > north || west > east) throw new MapContractError("place bounds are inverted");
  return { south, west, north, east };
}

function placeFrom(raw: Record<string, unknown>, position: unknown): Place {
  const { kind, precision } = raw;
  if (!isPlaceKind(kind)) throw new MapContractError("place kind is unknown");
  if (!isPrecision(precision)) throw new MapContractError("place precision is unknown");
  const point = position as LatLng;
  if (typeof point?.lat !== "number" || typeof point?.lng !== "number" || !isValidPosition(point)) {
    throw new MapContractError("place has no valid position");
  }
  const city = text(raw, "city");
  const state = text(raw, "state");
  if (!city || !state || !text(raw, "label")) throw new MapContractError("place names no city, state or label");
  return {
    kind,
    label: text(raw, "label"),
    name: text(raw, "name"),
    zipCode: text(raw, "zipCode"),
    street: text(raw, "street"),
    district: text(raw, "district"),
    city,
    cityCode: text(raw, "cityCode"),
    cityKey: text(raw, "cityKey"),
    districtPair: text(raw, "districtPair"),
    state,
    position: { lat: point.lat, lng: point.lng },
    precision,
    bounds: boundsOf(raw.bounds),
    addressCount: count(raw, "addressCount"),
    zipCount: count(raw, "zipCount"),
  };
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new MapContractError(`${what} is not an object`);
  return value as Record<string, unknown>;
}

export function parsePlaceAnswer(value: unknown): PlaceAnswer {
  const raw = record(value, "place answer");
  if (!Array.isArray(raw.items)) throw new MapContractError("place answer has no items");
  const places = raw.items.map((item) => {
    const row = record(item, "place");
    return placeFrom(row, { lat: row.lat, lng: row.lng });
  });
  const covered = Array.isArray(raw.coveredStates) ? raw.coveredStates.filter((state): state is string => typeof state === "string") : [];
  return { places, coveredStates: covered, attribution: text(raw, "attribution") };
}

export function coveredStatesOf(error: CodedRefusal | null | undefined): string[] {
  if (error?.code !== "reference_not_loaded") return [];
  const listed = error.expected?.coveredStates ?? "";
  return listed.split(",").map((state) => state.trim()).filter(Boolean);
}

export function placeFilterOf(place: Place, filter: CrmFilter = emptyCrmFilter): CrmFilter | null {
  if (place.kind === "city" && place.cityKey) {
    const current = readSet(filter, LEAD_FILTER_FIELD.city);
    return current.includes(place.cityKey) ? filter : withSet(filter, LEAD_FILTER_FIELD.city, [...current, place.cityKey]);
  }
  if (place.kind === "district" && place.districtPair) return withDistrictPairs(filter, [place.districtPair]);
  return null;
}

export function placeAddsFilter(place: Place, filter: CrmFilter): boolean {
  const next = placeFilterOf(place, filter);
  return next !== null && encodeFilterParam(next) !== encodeFilterParam(filter);
}

export function placeAsCepAddress(place: Place): CepAddress | null {
  if (!place.zipCode) return null;
  return {
    cep: place.zipCode,
    logradouro: place.street,
    complemento: "",
    bairro: place.district,
    localidade: place.city,
    uf: place.state,
    ...(place.cityCode ? { ibge: place.cityCode } : {}),
  };
}

export function placeId(place: Place): string {
  return [place.kind, place.cityCode, place.zipCode, foldPlaceText(place.district), foldPlaceText(place.name)].join("|");
}

export function withRecentPlace(list: readonly Place[], place: Place, max = RECENT_PLACES_MAX): Place[] {
  const id = placeId(place);
  return [place, ...list.filter((candidate) => placeId(candidate) !== id)].slice(0, max);
}

export function recentPlacesKey(workspaceId: string): string {
  return `vozko:recent-places:${workspaceId}`;
}

export function parseRecentPlaces(stored: string | null): Place[] {
  if (!stored) return [];
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    try {
      const row = record(item, "stored place");
      return [placeFrom(row, row.position)];
    } catch {
      return [];
    }
  });
}
