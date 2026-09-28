import type { AgentToolDefinition } from "@/lib/agents/types";

export function hasToolSettings(tool: Pick<AgentToolDefinition, "requiresConfig" | "configSchema">): boolean {
  return tool.requiresConfig === true || Object.keys(tool.configSchema ?? {}).length > 0;
}

export const TRANSFER_TO_HUMAN_TOOL = "transfer_to_human";

export function handsOffToPeople(tool: Pick<AgentToolDefinition, "name">): boolean {
  return tool.name === TRANSFER_TO_HUMAN_TOOL;
}
