import { describe, expect, it } from "vitest";

import { delegationTargets, ownerOf } from "./delegation";

describe("delegation targets", () => {
  it("offers only active agents and active messaging workflows", () => {
    const targets = delegationTargets(
      [
        { id: "a1", name: "Ana IA", isActive: true },
        { id: "a2", name: "Desligado", isActive: false },
      ],
      [
        { id: "w1", name: "Triagem", status: "active", type: "messages" },
        { id: "w2", name: "Rascunho", status: "draft", type: "messages" },
        { id: "w3", name: "URA", status: "active", type: "voice" },
      ],
    );
    expect(targets).toEqual([
      { kind: "agent", id: "a1", name: "Ana IA" },
      { kind: "workflow", id: "w1", name: "Triagem" },
    ]);
  });

  it("names the owner id the backend assigns", () => {
    expect(ownerOf({ kind: "agent", id: "a1", name: "" })).toBe("ai:a1");
    expect(ownerOf({ kind: "workflow", id: "w1", name: "" })).toBe("workflow:w1");
  });
});
