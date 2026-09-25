import { describe, expect, it } from "vitest";

import { humanizeFieldKey, proposalRows } from "./proposal";

describe("humanizeFieldKey", () => {
  it("splits camelCase and snake_case into a sentence", () => {
    expect(humanizeFieldKey("messagingPrompt")).toBe("Messaging prompt");
    expect(humanizeFieldKey("scheduled_at")).toBe("Scheduled at");
    expect(humanizeFieldKey("name")).toBe("Name");
  });
});

describe("proposalRows", () => {
  const dict = {
    label: (key: string) => (key === "name" ? "Nome" : humanizeFieldKey(key)),
    yes: "Sim",
    no: "Não",
  };

  it("labels each field and translates booleans", () => {
    expect(
      proposalRows(
        [
          { key: "name", value: "Vendas" },
          { key: "isActive", value: "true" },
          { key: "useInitialMessage", value: "false" },
        ],
        dict,
      ),
    ).toEqual([
      { key: "name", label: "Nome", value: "Vendas" },
      { key: "isActive", label: "Is active", value: "Sim" },
      { key: "useInitialMessage", label: "Use initial message", value: "Não" },
    ]);
  });

  it("drops fields without a key or value", () => {
    expect(proposalRows([{ key: "", value: "x" }, { key: "name", value: "  " }], dict)).toEqual([]);
  });

  it("returns nothing when the proposal carries no fields", () => {
    expect(proposalRows(undefined, dict)).toEqual([]);
  });
});
