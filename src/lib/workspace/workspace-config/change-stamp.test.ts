import { describe, expect, it } from "vitest";

import { changeStampOf, readChangeStampFields } from "./change-stamp";

describe("readChangeStampFields", () => {
  it("reads who changed a setting and when, under the setting's prefix", () => {
    expect(
      readChangeStampFields({ providerChangedBy: "u-1", providerChangedByName: "Ana", providerChangedAt: "2026-10-08T12:00:00Z" }, "provider"),
    ).toEqual({ providerChangedBy: "u-1", providerChangedByName: "Ana", providerChangedAt: "2026-10-08T12:00:00Z" });
  });

  it("reads missing, null and empty fields as absent", () => {
    expect(readChangeStampFields({ providerChangedBy: "", providerChangedByName: null }, "provider")).toEqual({
      providerChangedBy: undefined,
      providerChangedByName: undefined,
      providerChangedAt: undefined,
    });
  });

  it("refuses a field of the wrong type and a date that is not a date", () => {
    expect(readChangeStampFields({ providerChangedByName: 7 }, "provider")).toBeNull();
    expect(readChangeStampFields({ providerChangedAt: "ontem" }, "provider")).toBeNull();
  });
});

describe("changeStampOf", () => {
  it("answers the name and the instant of the last change", () => {
    expect(changeStampOf({ ceilingChangedByName: "Suporte", ceilingChangedAt: "2026-10-08T12:00:00Z" }, "ceiling")).toEqual({
      by: "Suporte",
      at: "2026-10-08T12:00:00Z",
    });
  });

  it("keeps an instant without a name", () => {
    expect(changeStampOf({ ceilingChangedAt: "2026-10-08T12:00:00Z" }, "ceiling")).toEqual({ by: null, at: "2026-10-08T12:00:00Z" });
  });

  it("has no stamp for a setting nobody changed", () => {
    expect(changeStampOf({ ceilingChangedByName: "Suporte" }, "ceiling")).toBeNull();
  });
});
