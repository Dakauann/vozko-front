import { describe, expect, it } from "vitest";

import { riskBadges } from "./permission-risk";
import type { AvailablePermission } from "./types";

const campaigns: AvailablePermission = {
  resource: "whatsapp_campaigns",
  actions: ["read", "start"],
  risks: {
    start: [
      { kind: "contacts_customers", level: "high", description: "fala com clientes" },
      { kind: "sensitive_data", level: "medium", description: "vê dados sensíveis" },
      { kind: "spends_balance", level: "high", description: "consome saldo" },
    ],
  },
};

describe("riskBadges", () => {
  it("lists high risks first and keeps the backend order inside a level", () => {
    expect(riskBadges(campaigns, "start").map((b) => b.kind)).toEqual(["contacts_customers", "spends_balance", "sensitive_data"]);
  });

  it("shows nothing for a permission without notable risk", () => {
    expect(riskBadges(campaigns, "read")).toEqual([]);
    expect(riskBadges({ resource: "labels", actions: ["read"] }, "read")).toEqual([]);
  });
});
