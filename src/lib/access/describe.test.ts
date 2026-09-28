import { describe, expect, it } from "vitest";

import { describePermission } from "./describe";

describe("describePermission", () => {
  const catalog = [{ resource: "stages" as const, actions: ["assign" as const], actionDescriptions: { assign: "Atribuir etapas" } }];

  it("uses the catalog description", () => {
    expect(describePermission(catalog, { resource: "stages", action: "assign" })).toBe("Atribuir etapas");
  });

  it("falls back to the permission key", () => {
    expect(describePermission(catalog, { resource: "leads", action: "read" })).toBe("leads:read");
  });
});
