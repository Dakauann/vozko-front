import { describe, expect, it } from "vitest";

import { dealActorName } from "@/lib/crm/opportunities";

const labels = { ai: "Agente de IA", workflow: "Fluxo", system: "Sistema", unknownMember: "Atribuído" };
const members = new Map([["u-1", "Ana"]]);

describe("dealActorName", () => {
  it("names a person from the workspace members", () => {
    expect(dealActorName("u-1", members, labels)).toBe("Ana");
  });

  it("keeps a person missing from the list as assigned", () => {
    expect(dealActorName("u-9", members, labels)).toBe("Atribuído");
  });

  it("names automations by kind instead of looking them up as members", () => {
    expect(dealActorName("ai:agent-1", members, labels)).toBe("Agente de IA");
    expect(dealActorName("workflow:wf-1", members, labels)).toBe("Fluxo");
    expect(dealActorName("system", members, labels)).toBe("Sistema");
  });

  it("names an agent or a flow by its own name when the server resolved it", () => {
    expect(dealActorName("ai:agent-1", members, labels, "Sofia")).toBe("Sofia · Agente de IA");
    expect(dealActorName("workflow:wf-1", members, labels, "Boas-vindas")).toBe("Boas-vindas · Fluxo");
  });

  it("names a person who left the member list by the resolved name", () => {
    expect(dealActorName("u-9", members, labels, "Bruno")).toBe("Bruno");
    expect(dealActorName("u-1", members, labels, "Nome antigo")).toBe("Ana");
  });

  it("has no name for nobody", () => {
    expect(dealActorName(undefined, members, labels)).toBeNull();
    expect(dealActorName("  ", members, labels)).toBeNull();
  });
});
