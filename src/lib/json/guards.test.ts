import { describe, expect, it } from "vitest";

import { isCount, isJson, isText } from "./guards";

describe("json guards", () => {
  it("accepts only plain objects as json objects", () => {
    expect(isJson({})).toBe(true);
    expect([null, [], "x", 1].map(isJson)).toEqual([false, false, false, false]);
  });

  it("accepts only filled strings as text", () => {
    expect(isText("a")).toBe(true);
    expect(["", 1, null].map(isText)).toEqual([false, false, false]);
  });

  it("accepts only non-negative integers as counts", () => {
    expect([0, 3].map(isCount)).toEqual([true, true]);
    expect([-1, 1.5, "1"].map(isCount)).toEqual([false, false, false]);
  });
});
