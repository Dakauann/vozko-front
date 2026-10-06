import { describe, expect, it } from "vitest";

import { preselectedModel } from "./models";

const catalog = [
  { id: "google/lyria-3-pro", name: "Lyria 3 Pro", default: false },
  { id: "google/lyria-3-clip-preview", name: "Lyria 3 Clip", default: true },
  { id: "acme/tune-1", name: "Tune 1", default: false },
];

describe("preselectedModel", () => {
  it("starts on the model the approval card recommends", () => {
    expect(preselectedModel(catalog, "acme/tune-1")).toBe("acme/tune-1");
  });

  it("starts on the model the catalog marks as recommended", () => {
    expect(preselectedModel(catalog)).toBe("google/lyria-3-clip-preview");
  });

  it("ignores a recommendation the catalog no longer offers", () => {
    expect(preselectedModel(catalog, "gone/model")).toBe("google/lyria-3-clip-preview");
  });

  it("falls back to the most used model when none is marked", () => {
    expect(preselectedModel(catalog.map((model) => ({ ...model, default: false })))).toBe("google/lyria-3-pro");
  });

  it("picks nothing from an empty catalog", () => {
    expect(preselectedModel([], "acme/tune-1")).toBeNull();
  });
});
