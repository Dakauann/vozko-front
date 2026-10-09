import { cepDigits, formatCep } from "@/lib/address/cep";
import { leadMapsKey } from "@/lib/leads/map-view";

import { MapContractError } from "./contracts";
import { isValidPosition } from "./geometry";
import { isPrecision } from "./precision";
import type { LatLng, Precision } from "./types";

export const REFERENCE_POINT_PATH = "/leads/map/reference-point";

const QUERY_FIELDS = ["zipCode", "district", "city", "state"] as const;

type QueryField = (typeof QUERY_FIELDS)[number];

export type ReferencePointQuery = Partial<Record<QueryField, string>>;

export interface ReferencePoint {
  position: LatLng;
  precision: Precision;
  attribution: string;
}

function filled(query: ReferencePointQuery): Array<[QueryField, string]> {
  return QUERY_FIELDS.flatMap((field) => {
    const value = query[field]?.trim() ?? "";
    return value ? [[field, value] as [QueryField, string]] : [];
  });
}

function searchOf(query: ReferencePointQuery): string {
  return new URLSearchParams(filled(query)).toString();
}

export function hasReferenceQuery(query: ReferencePointQuery): boolean {
  return filled(query).length > 0;
}

export function referencePointPath(query: ReferencePointQuery): string {
  return `${REFERENCE_POINT_PATH}?${searchOf(query)}`;
}

export function referencePointKey(workspaceId: string, query: ReferencePointQuery) {
  return [...leadMapsKey(workspaceId), "reference-point", searchOf(query)] as const;
}

export function cepReferenceQuery(zipCode: string): ReferencePointQuery | null {
  const digits = cepDigits(zipCode);
  return digits ? { zipCode: digits } : null;
}

export function referencePointName(query: ReferencePointQuery): string {
  const zipCode = query.zipCode?.trim() ?? "";
  if (zipCode) return formatCep(zipCode);
  const district = query.district?.trim() ?? "";
  const city = query.city?.trim() ?? "";
  const state = query.state?.trim().toUpperCase() ?? "";
  const place = [city, state].filter(Boolean).join("/");
  return [district, place].filter(Boolean).join(", ");
}

export function parseReferencePoint(value: unknown): ReferencePoint {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new MapContractError("reference point is not an object");
  }
  const raw = value as Record<string, unknown>;
  const { lat, lng, precision, attribution } = raw;
  if (typeof lat !== "number" || typeof lng !== "number" || !isValidPosition({ lat, lng })) {
    throw new MapContractError("reference point has no valid position");
  }
  if (!isPrecision(precision)) throw new MapContractError("reference point precision is unknown");
  if (typeof attribution !== "string" || attribution.trim() === "") {
    throw new MapContractError("reference point names no source");
  }
  return { position: { lat, lng }, precision, attribution };
}
