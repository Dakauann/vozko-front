import { PRECISIONS, type Precision } from "./types";

export type PrecisionCategory = "house" | "approximate" | "unknown";

const CATEGORY: Record<Precision, PrecisionCategory> = {
  exact: "house",
  address: "house",
  street: "house",
  postal_code: "approximate",
  district: "approximate",
  city: "approximate",
};

const LABEL_KEY: Record<Precision, string> = {
  exact: "precision.exact",
  address: "precision.address",
  street: "precision.street",
  postal_code: "precision.postalCode",
  district: "precision.district",
  city: "precision.city",
};

const FRAMING_ZOOM: Record<Precision, number> = {
  exact: 16,
  address: 16,
  street: 15,
  postal_code: 14,
  district: 13,
  city: 11,
};

const FALLBACK_ZOOM = 11;

export function isPrecision(value: unknown): value is Precision {
  return typeof value === "string" && (PRECISIONS as readonly string[]).includes(value);
}

export function precisionCategory(value: unknown): PrecisionCategory {
  return isPrecision(value) ? CATEGORY[value] : "unknown";
}

export function precisionLabelKey(value: unknown): string {
  return isPrecision(value) ? LABEL_KEY[value] : "precision.unknown";
}

export function zoomForPrecision(value: unknown): number {
  return isPrecision(value) ? FRAMING_ZOOM[value] : FALLBACK_ZOOM;
}
