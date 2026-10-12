import { describe, expect, it } from "vitest";

import type { ModelPricingInfo } from "@/lib/agents/types";

import { filterByCapabilities, hasCapabilities, missingCapabilities, modelCapabilitiesOf, offeredCapabilities, recommendModel } from "./capabilities";

const pricing: ModelPricingInfo[] = [
  { id: "lab/popular", name: "Popular", promptPrice: 1, completionPrice: 2, capabilities: ["tools", "reasoning"] },
  { id: "lab/seer", name: "Seer", promptPrice: 1, completionPrice: 2, capabilities: ["vision", "tools"] },
  { id: "lab/cheap-seer", name: "Cheap seer", promptPrice: 0, completionPrice: 0, capabilities: ["vision", "tools", "low_price", "free"] },
  { id: "lab/old", name: "Old", promptPrice: 1, completionPrice: 2 },
  { id: "lab/odd", name: "Odd", promptPrice: 1, completionPrice: 2, capabilities: ["vision", "telepathy"] },
];
const ids = ["lab/popular", "lab/seer", "lab/cheap-seer", "lab/old", "lab/odd", "lab/missing"];

describe("model capabilities", () => {
  it("reads only the capabilities the app knows", () => {
    expect(modelCapabilitiesOf(pricing[4])).toEqual(["vision"]);
    expect(modelCapabilitiesOf(undefined)).toEqual([]);
  });

  it("matches only what the catalog confirms", () => {
    expect(hasCapabilities(pricing[1], ["vision", "tools"])).toBe(true);
    expect(hasCapabilities(pricing[0], ["vision"])).toBe(false);
    expect(hasCapabilities(pricing[3], ["tools"])).toBe(false);
    expect(hasCapabilities(undefined, ["tools"])).toBe(false);
    expect(hasCapabilities(undefined, [])).toBe(true);
  });

  it("lists what a model lacks", () => {
    expect(missingCapabilities(pricing[0], ["tools", "vision"])).toEqual(["vision"]);
    expect(missingCapabilities(undefined, ["tools"])).toEqual(["tools"]);
  });

  it("filters with every chosen capability and keeps the popularity order", () => {
    expect(filterByCapabilities(ids, pricing, [])).toEqual(ids);
    expect(filterByCapabilities(ids, pricing, ["vision"])).toEqual(["lab/seer", "lab/cheap-seer", "lab/odd"]);
    expect(filterByCapabilities(ids, pricing, ["vision", "free"])).toEqual(["lab/cheap-seer"]);
    expect(filterByCapabilities(ids, pricing, ["image_output"])).toEqual([]);
  });

  it("recommends the most popular model that has what the surface needs", () => {
    expect(recommendModel(ids, pricing, ["vision", "tools"])).toBe("lab/seer");
    expect(recommendModel(ids, pricing, ["image_output"])).toBeNull();
  });

  it("offers a chip only for a capability some model has, in the surface order", () => {
    expect(offeredCapabilities(pricing, ["free", "vision", "tools", "image_output"])).toEqual(["free", "vision", "tools"]);
    expect(offeredCapabilities(pricing, ["tools"])).toEqual(["tools"]);
    expect(offeredCapabilities(undefined, ["tools"])).toEqual([]);
  });
});
