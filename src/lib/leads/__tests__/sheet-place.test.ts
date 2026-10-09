import { describe, expect, it } from "vitest";

import type { Place } from "@/lib/maps/places";

import {
  addAddress,
  applyPlace,
  createLeadBody,
  emptyLeadDraft,
  leadDraftIssues,
  shownPinOf,
  updateLeadBody,
  withAddressZip,
  withMovedPin,
  type AddressDraft,
} from "../sheet";
import type { LeadRecord } from "../types";

function blankAddress(): AddressDraft {
  return addAddress(emptyLeadDraft()).addresses[0];
}

const street: Place = {
  kind: "street",
  label: "Rua Boa Hora, Pina, Recife, PE",
  name: "Rua Boa Hora",
  zipCode: "51030300",
  street: "Rua Boa Hora",
  district: "Pina",
  city: "Recife",
  cityCode: "2611606",
  cityKey: "pe:recife",
  districtPair: "pe:recife/pina",
  state: "PE",
  position: { lat: -8.09, lng: -34.88 },
  precision: "street",
  bounds: null,
  addressCount: 30,
  zipCount: 1,
};

const city: Place = { ...street, kind: "city", label: "Recife, PE", name: "Recife", zipCode: "", street: "", district: "", districtPair: "", precision: "city", zipCount: 0 };

describe("applyPlace", () => {
  it("fills CEP, bairro, city and UF from a street with one CEP, keeping the number", () => {
    const address = { ...blankAddress(), number: "120", complement: "apto 2" };
    const filled = applyPlace(address, street);
    expect(filled).toMatchObject({
      zipCode: "51030-300",
      street: "Rua Boa Hora",
      district: "Pina",
      city: "Recife",
      state: "PE",
      cityCode: "2611606",
      number: "120",
      complement: "apto 2",
    });
    expect(filled.placePoint).toEqual({ position: street.position, precision: "street" });
  });

  it("never guesses the CEP of a street that has several", () => {
    const filled = applyPlace({ ...blankAddress(), zipCode: "51030-000" }, { ...street, zipCode: "", zipCount: 4 });
    expect(filled).toMatchObject({ zipCode: "51030-000", street: "Rua Boa Hora", district: "Pina", city: "Recife", state: "PE" });
  });

  it("fills only the city, its UF and code from a city", () => {
    const filled = applyPlace({ ...blankAddress(), street: "Rua A", district: "Centro" }, city);
    expect(filled).toMatchObject({ street: "Rua A", district: "Centro", city: "Recife", state: "PE", cityCode: "2611606" });
  });

  it("never moves a pin the person placed by hand", () => {
    const moved = withMovedPin(blankAddress(), { lat: -8.1, lng: -34.9 });
    const filled = applyPlace(moved, street);
    expect(shownPinOf(filled, null)).toEqual({ position: { lat: -8.1, lng: -34.9 }, precision: "exact", moved: true });
  });
});

describe("shownPinOf", () => {
  it("shows the hand pin, then the chosen place, then the CEP point", () => {
    const reference = { position: { lat: -8.2, lng: -34.95 }, precision: "postal_code" as const, attribution: "IBGE" };
    const address = blankAddress();
    expect(shownPinOf(address, null)).toBeNull();
    expect(shownPinOf(address, reference)).toEqual({ position: reference.position, precision: "postal_code", moved: false });
    const picked = applyPlace(address, street);
    expect(shownPinOf(picked, reference)).toEqual({ position: street.position, precision: "street", moved: false });
  });

  it("follows a CEP typed after a pick", () => {
    const picked = applyPlace(blankAddress(), street);
    const retyped = withAddressZip(picked, "50030-230");
    expect(retyped.placePoint).toBeUndefined();
    expect(retyped.zipCode).toBe("50030-230");
  });
});

describe("pins in the bodies", () => {
  it("sends a hand pin with a new lead and counts it as an address", () => {
    const draft = { ...emptyLeadDraft(), name: "Maria", addresses: [withMovedPin(blankAddress(), { lat: -8.1, lng: -34.9 })] };
    expect(leadDraftIssues(draft)).toEqual([]);
    expect(createLeadBody(draft).addresses?.[0]).toEqual({ label: "home", primary: true, pin: { latitude: -8.1, longitude: -34.9 } });
  });

  it("never sends the preview point of a picked place", () => {
    const draft = { ...emptyLeadDraft(), addresses: [applyPlace(blankAddress(), street)] };
    expect(createLeadBody(draft).addresses?.[0]).not.toHaveProperty("pin");
  });

  it("sends a hand pin placed on a new address of a saved lead", () => {
    const base = { id: "l-1", version: 3, addresses: [] } as unknown as LeadRecord;
    const draft = { ...emptyLeadDraft(), addresses: [withMovedPin(applyPlace(blankAddress(), street), { lat: -8.1, lng: -34.9 })] };
    expect(updateLeadBody(base, draft, { addresses: true }).addresses?.[0]).toMatchObject({ zipCode: "51030-300", pin: { latitude: -8.1, longitude: -34.9 } });
  });
});
