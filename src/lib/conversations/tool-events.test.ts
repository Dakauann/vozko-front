import { describe, expect, it } from "vitest";

import type { AgentToolDefinition } from "@/lib/agents/types";

import { toolDisplayName, type ToolDefinitionByName } from "./tool-events";

function definition(name: string, displayName: string, bindingKey?: string): AgentToolDefinition {
  return { name, displayName, bindingKey } as AgentToolDefinition;
}

const definitions: ToolDefinitionByName = new Map([
  ["run_workflow", definition("run_workflow", "Executar fluxo", "workflow_id")],
  ["transfer_to_human", definition("transfer_to_human", "Transferir para humano")],
]);

describe("toolDisplayName", () => {
  it("names a tool by its catalog display name", () => {
    expect(toolDisplayName("transfer_to_human", definitions, "Ferramenta")).toBe("Transferir para humano");
  });

  it("names a bound tool by the display name of the tool it was bound from", () => {
    expect(toolDisplayName("run_workflow_6f1c-22", definitions, "Ferramenta")).toBe("Executar fluxo");
  });

  it("does not treat a tool bound once as a prefix of another name", () => {
    expect(toolDisplayName("transfer_to_human_now", definitions, "Ferramenta")).toBe("Transfer to human now");
  });

  it("humanises an unknown tool and falls back when there is no name", () => {
    expect(toolDisplayName("send_email", definitions, "Ferramenta")).toBe("Send email");
    expect(toolDisplayName(undefined, definitions, "Ferramenta")).toBe("Ferramenta");
  });
});
