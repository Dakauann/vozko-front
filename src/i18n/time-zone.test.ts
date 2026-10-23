import { describe, expect, it } from "vitest";

import { DEFAULT_TIME_ZONE, knownTimeZone } from "./time-zone";

describe("knownTimeZone", () => {
  it("keeps a real time zone", () => {
    expect(knownTimeZone("Europe/Berlin")).toBe("Europe/Berlin");
  });

  it("falls back to Brasília when the cookie is missing or forged", () => {
    expect(knownTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(knownTimeZone("Mars/Olympus")).toBe(DEFAULT_TIME_ZONE);
  });
});
