import { describe, expect, it } from "vitest";

import { emptyCrmFilter } from "@/lib/crm/board";
import { LEAD_FILTER_FIELD, readSet } from "@/lib/leads/filters";

import { MapContractError } from "./contracts";
import {
  coveredStatesOf,
  foldPlaceText,
  parsePlaceAnswer,
  parseRecentPlaces,
  placeAddsFilter,
  placeAsCepAddress,
  placeFilterOf,
  placeId,
  placeQueryKey,
  placeRequestPath,
  placeRequestReady,
  withRecentPlace,
  type Place,
} from "./places";

const recife: Place = {
  kind: "city",
  label: "Recife, PE",
  name: "Recife",
  zipCode: "",
  street: "",
  district: "",
  city: "Recife",
  cityCode: "2611606",
  cityKey: "pe:recife",
  districtPair: "",
  state: "PE",
  position: { lat: -8.05, lng: -34.9 },
  precision: "city",
  bounds: { south: -8.15, west: -35.0, north: -7.93, east: -34.85 },
  addressCount: 700000,
  zipCount: 0,
};

const pina: Place = {
  ...recife,
  kind: "district",
  label: "Pina, Recife, PE",
  name: "Pina",
  district: "Pina",
  districtPair: "pe:recife/pina",
  precision: "district",
  bounds: null,
};

const boaHora: Place = {
  ...pina,
  kind: "street",
  label: "Rua Boa Hora, Pina, Recife, PE",
  name: "Rua Boa Hora",
  street: "Rua Boa Hora",
  zipCode: "51030300",
  zipCount: 1,
  precision: "street",
};

const wire = {
  items: [
    {
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
      lat: -8.09,
      lng: -34.88,
      precision: "street",
      addressCount: 30,
      zipCount: 1,
    },
    {
      kind: "city",
      label: "Recife, PE",
      name: "Recife",
      city: "Recife",
      cityCode: "2611606",
      cityKey: "pe:recife",
      state: "PE",
      lat: -8.05,
      lng: -34.9,
      precision: "city",
      bounds: { south: -8.15, west: -35.0, north: -7.93, east: -34.85 },
      addressCount: 700000,
    },
  ],
  coveredStates: ["DF", "PE"],
  attribution: "IBGE, CNEFE 2022",
};

describe("foldPlaceText", () => {
  it("folds accents, case and spaces so one prefix shares one cache entry", () => {
    expect(foldPlaceText("  São   PAULO ")).toBe("sao paulo");
    expect(foldPlaceText("Jd. Floresta")).toBe("jd. floresta");
  });
});

describe("placeRequestReady", () => {
  it("waits for two characters and at most sixty", () => {
    expect(placeRequestReady({ kind: "city", text: "r" })).toBe(false);
    expect(placeRequestReady({ kind: "city", text: "re" })).toBe(true);
    expect(placeRequestReady({ kind: "city", text: "a".repeat(61) })).toBe(false);
  });

  it("asks bairros and streets only inside a city", () => {
    expect(placeRequestReady({ kind: "district", text: "boa" })).toBe(false);
    expect(placeRequestReady({ kind: "street", text: "boa", cityCode: "2611606" })).toBe(true);
  });
});

describe("placeRequestPath", () => {
  it("uses the map search without a kind and the form suggestions with one", () => {
    expect(placeRequestPath({ kind: null, text: " recife ", state: "pe" })).toBe("/leads/places/search?q=recife&state=PE");
    expect(placeRequestPath({ kind: "street", text: "Av. Boa", cityCode: "2611606" })).toBe(
      "/leads/places/suggest?kind=street&q=Av.+Boa&cityCode=2611606",
    );
  });
});

describe("placeQueryKey", () => {
  it("keys by workspace, kind, scope and folded prefix", () => {
    const a = placeQueryKey("ws-1", { kind: "city", text: "São", state: "pe" });
    const b = placeQueryKey("ws-1", { kind: "city", text: "sao ", state: "PE" });
    expect(a).toEqual(b);
    expect(placeQueryKey("ws-2", { kind: "city", text: "sao", state: "PE" })).not.toEqual(a);
    expect(placeQueryKey("ws-1", { kind: null, text: "sao", state: "PE" })).not.toEqual(a);
  });
});

describe("parsePlaceAnswer", () => {
  it("reads every place with its point, bounds and filter keys", () => {
    const answer = parsePlaceAnswer(wire);
    expect(answer.coveredStates).toEqual(["DF", "PE"]);
    expect(answer.places[0]).toMatchObject({ kind: "street", zipCode: "51030300", district: "Pina", position: { lat: -8.09, lng: -34.88 }, bounds: null });
    expect(answer.places[1]).toMatchObject({ kind: "city", cityKey: "pe:recife", districtPair: "", bounds: { south: -8.15 } });
  });

  it("refuses an answer outside the contract", () => {
    expect(() => parsePlaceAnswer({ items: [{ ...wire.items[0], kind: "planet" }], coveredStates: [] })).toThrow(MapContractError);
    expect(() => parsePlaceAnswer({ items: [{ ...wire.items[0], lat: 120 }], coveredStates: [] })).toThrow(MapContractError);
    expect(() => parsePlaceAnswer({ items: null, coveredStates: [] })).toThrow(MapContractError);
  });
});

describe("coveredStatesOf", () => {
  it("reads the loaded states from a reference_not_loaded refusal", () => {
    expect(coveredStatesOf({ code: "reference_not_loaded", expected: { coveredStates: "DF,PE" } })).toEqual(["DF", "PE"]);
    expect(coveredStatesOf({ code: "reference_not_loaded", expected: { coveredStates: "" } })).toEqual([]);
    expect(coveredStatesOf({ code: "reference_unavailable" })).toEqual([]);
  });
});

describe("placeFilterOf", () => {
  it("filters a city by its city key and a bairro by its pair", () => {
    const byCity = placeFilterOf(recife);
    expect(byCity && readSet(byCity, LEAD_FILTER_FIELD.city)).toEqual(["pe:recife"]);
    const byDistrict = placeFilterOf(pina, emptyCrmFilter);
    expect(byDistrict && readSet(byDistrict, LEAD_FILTER_FIELD.district)).toEqual(["pe:recife/pina"]);
  });

  it("adds to the filter already applied", () => {
    const both = placeFilterOf(pina, placeFilterOf(recife) ?? emptyCrmFilter);
    expect(both && readSet(both, LEAD_FILTER_FIELD.city)).toEqual(["pe:recife"]);
    expect(both && readSet(both, LEAD_FILTER_FIELD.district)).toEqual(["pe:recife/pina"]);
  });

  it("has no lead filter for a street or a CEP", () => {
    expect(placeFilterOf(boaHora)).toBeNull();
    expect(placeFilterOf({ ...boaHora, kind: "cep" })).toBeNull();
  });
});

describe("placeAddsFilter", () => {
  it("offers to filter by a city or bairro that the filter does not hold yet", () => {
    expect(placeAddsFilter(recife, emptyCrmFilter)).toBe(true);
    expect(placeAddsFilter(pina, placeFilterOf(recife) ?? emptyCrmFilter)).toBe(true);
  });

  it("stops offering once that place is already in the filter", () => {
    expect(placeAddsFilter(recife, placeFilterOf(recife) ?? emptyCrmFilter)).toBe(false);
    expect(placeAddsFilter(pina, placeFilterOf(pina) ?? emptyCrmFilter)).toBe(false);
  });

  it("never offers a street or a CEP", () => {
    expect(placeAddsFilter(boaHora, emptyCrmFilter)).toBe(false);
  });
});

describe("placeAsCepAddress", () => {
  it("turns a place with a CEP into the CEP lookup shape", () => {
    expect(placeAsCepAddress(boaHora)).toEqual({
      cep: "51030300",
      logradouro: "Rua Boa Hora",
      complemento: "",
      bairro: "Pina",
      localidade: "Recife",
      uf: "PE",
      ibge: "2611606",
    });
    expect(placeAsCepAddress(recife)).toBeNull();
  });
});

describe("recent places", () => {
  it("keeps the newest first without repeats, bounded", () => {
    let list: Place[] = [];
    list = withRecentPlace(list, recife);
    list = withRecentPlace(list, pina);
    list = withRecentPlace(list, recife);
    expect(list.map(placeId)).toEqual([placeId(recife), placeId(pina)]);
    for (let i = 0; i < 10; i++) list = withRecentPlace(list, { ...boaHora, zipCode: String(51030300 + i) });
    expect(list).toHaveLength(5);
  });

  it("reads stored places leniently, dropping what no longer parses", () => {
    expect(parseRecentPlaces(JSON.stringify([recife, { kind: "planet" }]))).toEqual([recife]);
    expect(parseRecentPlaces("not json")).toEqual([]);
    expect(parseRecentPlaces(null)).toEqual([]);
  });
});
