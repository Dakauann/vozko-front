import { describe, expect, it } from "vitest";

import { positionSourceKey } from "./position";

describe("positionSourceKey", () => {
  it.each([
    ["manual", "source.manual"],
    ["lead_pin", "source.lead_pin"],
    ["import", "source.import"],
    ["reference", "source.reference"],
  ])("labels %s with %s", (source, key) => {
    expect(positionSourceKey(source)).toBe(key);
  });

  it.each([undefined, null, "", "google", "provider", 3])("has no label for %s", (source) => {
    expect(positionSourceKey(source)).toBeNull();
  });
});
