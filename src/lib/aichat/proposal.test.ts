import { describe, expect, it } from "vitest";

import { expireOpen, humanizeFieldKey, isOpenProposal, pendingFromStored, proposalRows } from "./proposal";

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

describe("proposal lifecycle", () => {
  it("rebuilds the card from a stored proposal", () => {
    expect(
      pendingFromStored({ id: "a1", toolName: "create_label", fields: [{ key: "label", value: "VIP" }], status: "pending" }),
    ).toEqual({ id: "a1", toolName: "create_label", fields: [{ key: "label", value: "VIP" }], status: "pending" });
    expect(pendingFromStored(undefined)).toBeNull();
    const preview = { kind: "whatsapp_template", data: { name: "refiliacao" } };
    expect(pendingFromStored({ id: "a2", toolName: "create_template", fields: [], preview, status: "pending" })?.preview).toEqual(preview);
  });

  it("only an open proposal can still be decided", () => {
    expect(isOpenProposal({ id: "a", toolName: "x" })).toBe(true);
    expect(isOpenProposal({ id: "a", toolName: "x", status: "pending" })).toBe(true);
    expect(isOpenProposal({ id: "a", toolName: "x", status: "approved" })).toBe(false);
    expect(isOpenProposal(null)).toBe(false);
  });

  it("closes open proposals when the conversation moves on", () => {
    const open = { id: "a", toolName: "x" };
    const done = { id: "b", toolName: "y", status: "approved" as const };
    expect(expireOpen(open)).toEqual({ ...open, status: "expired" });
    expect(expireOpen(done)).toBe(done);
    expect(expireOpen(null)).toBeNull();
  });
});
