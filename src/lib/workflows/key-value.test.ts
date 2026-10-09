import { describe, expect, it } from "vitest";

import { normalizeKeyValueMap } from "./key-value";

describe("normalizeKeyValueMap", () => {
  it.each([
    [undefined, {}],
    ["", {}],
    ["not json", {}],
    [42, {}],
    ['{"a":1,"b":null}', { a: "1", b: "" }],
    [{ a: "x", b: 2, c: null }, { a: "x", b: "2", c: "" }],
  ])("reads %j", (value, expected) => {
    expect(normalizeKeyValueMap(value)).toEqual(expected);
  });
});
