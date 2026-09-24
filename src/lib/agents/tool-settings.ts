import type { AgentToolDefinition } from "@/lib/agents/types";

/** Whether a tool has settings an admin can open, required or optional. */
export function hasToolSettings(tool: Pick<AgentToolDefinition, "requiresConfig" | "configSchema">): boolean {
  return tool.requiresConfig === true || Object.keys(tool.configSchema ?? {}).length > 0;
}

/** The agent tool that hands the conversation to a person (transfer_to_human_tool.go). */
export const TRANSFER_TO_HUMAN_TOOL = "transfer_to_human";

/** Whether the tool hands conversations off, so its settings explain who receives them. */
export function handsOffToPeople(tool: Pick<AgentToolDefinition, "name">): boolean {
  return tool.name === TRANSFER_TO_HUMAN_TOOL;
}
