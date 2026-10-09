import { describe, expect, it } from "vitest";

import { addressLocation, addressPositionSource } from "@/lib/leads/address-location";
import type { LeadAddress } from "@/lib/leads/types";

function address(overrides: Partial<LeadAddress> = {}): LeadAddress {
  return { id: "addr-1", label: "home", primary: true, geoStatus: "pending", ...overrides };
}

describe("addressLocation", () => {
  it.each([
    ["exact", "precision.exact", "healthy"],
    ["address", "precision.address", "healthy"],
    ["street", "precision.street", "healthy"],
    ["postal_code", "precision.postalCode", "muted"],
    ["district", "precision.district", "muted"],
    ["city", "precision.city", "muted"],
  ] as const)("labels a %s position with %s in the %s tone", (precision, key, tone) => {
    const status = precision === "exact" || precision === "address" || precision === "street" ? "located" : "approximate";
    expect(addressLocation(address({ precision, geoStatus: status }))).toEqual({
      label: { kind: "precision", key },
      tone,
      note: null,
    });
  });

  it.each([
    ["pending", "muted"],
    ["not_found", "warning"],
    ["unavailable", "warning"],
  ] as const)("labels a %s address without a position by its status, in the %s tone", (geoStatus, tone) => {
    expect(addressLocation(address({ geoStatus }))).toEqual({ label: { kind: "status", status: geoStatus }, tone, note: null });
  });

  it.each(["pending", "unavailable"] as const)(
    "keeps the position label and notes that a %s address is still queued when the server says so",
    (geoStatus) => {
      expect(addressLocation(address({ precision: "district", geoStatus, geoQueued: true }))).toEqual({
        label: { kind: "precision", key: "precision.district" },
        tone: "muted",
        note: geoStatus,
      });
    },
  );

  it("has no queued note when the server does not say the address is queued", () => {
    expect(addressLocation(address({ precision: "district", geoStatus: "pending" })).note).toBeNull();
    expect(addressLocation(address({ precision: "district", geoStatus: "unavailable", geoQueued: false })).note).toBeNull();
  });

  it("never shows a precision it does not know as a house", () => {
    expect(addressLocation(address({ geoStatus: "located", precision: "rooftop" as LeadAddress["precision"] }))).toEqual({
      label: { kind: "precision", key: "precision.unknown" },
      tone: "muted",
      note: null,
    });
  });

  it.each(["lost", "refused", "quota_exceeded", "ambiguous"])("falls back to the unknown label for the status %s the front does not know", (geoStatus) => {
    expect(addressLocation(address({ geoStatus: geoStatus as LeadAddress["geoStatus"] }))).toEqual({
      label: { kind: "precision", key: "precision.unknown" },
      tone: "muted",
      note: null,
    });
  });
});

describe("addressPositionSource", () => {
  it("names the source and the day the position was fixed", () => {
    expect(addressPositionSource(address({ positionSource: "manual", geocodedAt: "2026-10-02T12:00:00Z" }))).toEqual({
      sourceKey: "source.manual",
      fixedAt: new Date("2026-10-02T12:00:00Z"),
    });
  });

  it("drops an unreadable date", () => {
    expect(addressPositionSource(address({ positionSource: "import", geocodedAt: "yesterday" }))?.fixedAt).toBeNull();
  });

  it("has nothing to say for an address without a known source", () => {
    expect(addressPositionSource(address())).toBeNull();
    expect(addressPositionSource(address({ positionSource: "google" }))).toBeNull();
    expect(addressPositionSource(address({ positionSource: "provider" }))).toBeNull();
  });
});
