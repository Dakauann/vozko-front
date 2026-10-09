import { describe, expect, it } from "vitest";

import { isNewerVersion } from "./version";

describe("isNewerVersion", () => {
  it.each([
    [5, 4, true],
    [5, 5, false],
    [4, 5, false],
    [1, undefined, true],
    [undefined, 3, false],
    [undefined, undefined, false],
  ])("reads %s as newer than %s: %s", (candidate, than, expected) => {
    expect(isNewerVersion(candidate, than)).toBe(expected);
  });
});
