import { describe, expect, it } from "vitest";

import { configText } from "./config-text";

describe("configText", () => {
  it.each([
    ["  registrar ", "registrar"],
    ["", ""],
    [undefined, ""],
    [3, ""],
    [null, ""],
  ])("reads %j as %j", (value, expected) => {
    expect(configText(value)).toBe(expected);
  });
});
