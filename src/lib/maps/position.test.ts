import { describe, expect, it } from "vitest";

import { positionProviderKey, positionSourceKey } from "./position";

describe("positionSourceKey", () => {
  it.each([
    ["manual", "source.manual"],
    ["lead_pin", "source.lead_pin"],
    ["import", "source.import"],
    ["reference", "source.reference"],
    ["provider", "source.provider"],
  ])("labels %s with %s", (source, key) => {
    expect(positionSourceKey(source)).toBe(key);
  });

  it.each([undefined, null, "", "google", 3])("has no label for %s", (source) => {
    expect(positionSourceKey(source)).toBeNull();
  });
});

describe("positionProviderKey", () => {
  it("names a provider the front knows", () => {
    expect(positionProviderKey("opencage")).toBe("providers.opencage");
  });

  it.each([undefined, "", "mapbox", 1])("has no name for %s", (provider) => {
    expect(positionProviderKey(provider)).toBeNull();
  });
});
