import { describe, expect, it } from "vitest";

import { MapContractError } from "./contracts";
import {
  cepReferenceQuery,
  hasReferenceQuery,
  parseReferencePoint,
  referencePointKey,
  referencePointName,
  referencePointPath,
} from "./reference-point";

describe("referencePointPath", () => {
  it("sends only the filled fields, trimmed", () => {
    expect(referencePointPath({ zipCode: " 01310-100 ", district: "", city: "São Paulo", state: " SP" })).toBe(
      "/leads/map/reference-point?zipCode=01310-100&city=S%C3%A3o+Paulo&state=SP",
    );
  });
});

describe("hasReferenceQuery", () => {
  it("needs at least one filled field", () => {
    expect(hasReferenceQuery({ zipCode: "  ", city: "" })).toBe(false);
    expect(hasReferenceQuery({ district: "Bela Vista" })).toBe(true);
  });
});

describe("cepReferenceQuery", () => {
  it("asks by the CEP digits once the CEP is complete", () => {
    expect(cepReferenceQuery("01310-100")).toEqual({ zipCode: "01310100" });
  });

  it("asks nothing while the CEP is incomplete", () => {
    expect(cepReferenceQuery("01310")).toBeNull();
    expect(cepReferenceQuery("")).toBeNull();
  });
});

describe("referencePointKey", () => {
  it("is scoped to the workspace and the filled query", () => {
    expect(referencePointKey("ws-1", { zipCode: "01310100", city: " " })).toEqual(["lead-map", "ws-1", "reference-point", "zipCode=01310100"]);
  });
});

describe("referencePointName", () => {
  it("names a CEP query by the formatted CEP", () => {
    expect(referencePointName({ zipCode: "01310100", city: "São Paulo", state: "SP" })).toBe("01310-100");
  });

  it("names an address query by bairro, city and state", () => {
    expect(referencePointName({ district: "Bela Vista", city: "São Paulo", state: "sp" })).toBe("Bela Vista, São Paulo/SP");
    expect(referencePointName({ city: "Campinas", state: "SP" })).toBe("Campinas/SP");
  });
});

describe("parseReferencePoint", () => {
  it("reads the point, its precision and the source to cite", () => {
    expect(parseReferencePoint({ lat: -23.5614, lng: -46.6559, precision: "street", attribution: "IBGE, CNEFE 2022" })).toEqual({
      position: { lat: -23.5614, lng: -46.6559 },
      precision: "street",
      attribution: "IBGE, CNEFE 2022",
    });
  });

  it("refuses an answer without a valid position or a known precision", () => {
    expect(() => parseReferencePoint({ lat: 200, lng: 0, precision: "street", attribution: "x" })).toThrow(MapContractError);
    expect(() => parseReferencePoint({ lat: -23.5, lng: -46.6, precision: "roof", attribution: "x" })).toThrow(MapContractError);
    expect(() => parseReferencePoint({ lat: -23.5, lng: -46.6, precision: "city", attribution: " " })).toThrow(MapContractError);
    expect(() => parseReferencePoint(null)).toThrow(MapContractError);
  });
});
