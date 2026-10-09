import { describe, expect, it } from "vitest";

import { decodeFilterParam, emptyCrmFilter, encodeBase64, encodeFilterParam, parseFilterParam, type CrmFilter } from "../board";

const STAGE: CrmFilter = {
  groups: [{ conjunction: "and", predicates: [{ field: "stage", operator: "in", values: ["s-1"] }] }],
};

describe("parseFilterParam", () => {
  it("reads a missing param as the empty filter", () => {
    expect(parseFilterParam(null)).toEqual({ status: "empty", filter: emptyCrmFilter });
    expect(parseFilterParam("")).toEqual({ status: "empty", filter: emptyCrmFilter });
  });

  it("round trips an encoded filter", () => {
    expect(parseFilterParam(encodeFilterParam(STAGE))).toEqual({ status: "valid", filter: STAGE });
  });

  it("keeps a predicate key", () => {
    const keyed: CrmFilter = {
      groups: [{ conjunction: "and", predicates: [{ field: "custom", key: "interesse", operator: "in", values: ["a"] }] }],
    };
    expect(parseFilterParam(encodeFilterParam(keyed))).toEqual({ status: "valid", filter: keyed });
  });

  it("tells a broken link apart from an empty filter", () => {
    expect(parseFilterParam("%%%not-base64")).toEqual({ status: "invalid" });
    expect(parseFilterParam(encodeBase64("not json"))).toEqual({ status: "invalid" });
  });

  it("refuses a decoded value that is not a filter", () => {
    const shapes = [
      { groups: "x" },
      { groups: [{ conjunction: "xor", predicates: [] }] },
      { groups: [{ conjunction: "and", predicates: [{ field: "stage", operator: "in", values: "s-1" }] }] },
      { groups: [{ conjunction: "and", predicates: [{ field: 3, operator: "in", values: [] }] }] },
      { groups: [{ conjunction: "and", predicates: [{ field: "stage", operator: "in", values: [1] }] }] },
      { groups: [{ conjunction: "and", predicates: [{ field: "stage", key: 2, operator: "in", values: [] }] }] },
      [],
      null,
    ];
    for (const shape of shapes) {
      expect(parseFilterParam(encodeBase64(JSON.stringify(shape))), JSON.stringify(shape)).toEqual({ status: "invalid" });
    }
  });

  it("refuses a group without its conjunction instead of guessing one the server reads differently", () => {
    const loose = { groups: [{ predicates: [{ field: "stage", operator: "in", values: ["s-1"] }] }] };
    expect(parseFilterParam(encodeBase64(JSON.stringify(loose)))).toEqual({ status: "invalid" });
  });

  it("keeps decodeFilterParam reading a broken link as the empty filter", () => {
    expect(decodeFilterParam("%%%not-base64")).toEqual(emptyCrmFilter);
    expect(decodeFilterParam(encodeFilterParam(STAGE))).toEqual(STAGE);
  });
});
