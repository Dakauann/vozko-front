import { LEAD_GEO_STATUSES } from "@/lib/leads/filters";
import type { LeadAddress, LeadGeoStatus } from "@/lib/leads/types";
import { isPrecision, precisionCategory, precisionLabelKey } from "@/lib/maps/precision";
import { positionProviderKey, positionSourceKey } from "@/lib/maps/position";

export type AddressLocationTone = "healthy" | "muted" | "warning";

export type AddressLocationLabel = { kind: "precision"; key: string } | { kind: "status"; status: LeadGeoStatus };

export interface AddressLocation {
  label: AddressLocationLabel;
  tone: AddressLocationTone;
  note: LeadGeoStatus | null;
}

const STATUS_TONE: Partial<Record<LeadGeoStatus, AddressLocationTone>> = {
  pending: "muted",
  not_found: "warning",
  ambiguous: "warning",
  unavailable: "warning",
  quota_exceeded: "warning",
  refused: "warning",
};

const UNKNOWN: AddressLocation = { label: { kind: "precision", key: precisionLabelKey(null) }, tone: "muted", note: null };

export function addressLocation(address: Pick<LeadAddress, "geoStatus" | "geoQueued" | "precision">): AddressLocation {
  const status = LEAD_GEO_STATUSES.includes(address.geoStatus) ? address.geoStatus : null;
  if (address.precision !== undefined && address.precision !== null) {
    if (!isPrecision(address.precision)) return UNKNOWN;
    return {
      label: { kind: "precision", key: precisionLabelKey(address.precision) },
      tone: precisionCategory(address.precision) === "house" ? "healthy" : "muted",
      note: status && address.geoQueued === true ? status : null,
    };
  }
  const tone = status ? STATUS_TONE[status] : undefined;
  if (!status || !tone) return UNKNOWN;
  return { label: { kind: "status", status }, tone, note: null };
}

export interface AddressPositionSource {
  sourceKey: string;
  providerKey: string | null;
  fixedAt: Date | null;
}

export function addressPositionSource(
  address: Pick<LeadAddress, "positionSource" | "positionProvider" | "geocodedAt">,
): AddressPositionSource | null {
  const sourceKey = positionSourceKey(address.positionSource);
  if (!sourceKey) return null;
  const fixedAt = address.geocodedAt ? new Date(address.geocodedAt) : null;
  return {
    sourceKey,
    providerKey: address.positionSource === "provider" ? positionProviderKey(address.positionProvider) : null,
    fixedAt: fixedAt && !Number.isNaN(fixedAt.getTime()) ? fixedAt : null,
  };
}
