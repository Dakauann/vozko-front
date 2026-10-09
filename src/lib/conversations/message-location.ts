import { isValidPosition } from "@/lib/maps/geometry";

import type { MessageLocation } from "./types";

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function readMessageLocation(raw: unknown): MessageLocation | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const candidate = raw as Record<string, unknown>;
  const { latitude, longitude } = candidate;
  if (typeof latitude !== "number" || typeof longitude !== "number") return undefined;
  if (!isValidPosition({ lat: latitude, lng: longitude })) return undefined;
  const name = text(candidate.name);
  const address = text(candidate.address);
  return {
    latitude,
    longitude,
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
    candidate: candidate.candidate === true,
  };
}

export function messageLocation(message: Record<string, unknown>): { location?: MessageLocation } {
  const location = readMessageLocation(message.location);
  return location ? { location } : {};
}

export function locationPlace(location: MessageLocation): string {
  return [location.name, location.address].filter(Boolean).join(", ");
}
