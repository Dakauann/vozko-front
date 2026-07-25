import type { AgentToolDefinition, ToolConfig } from "./types";

function cloneConfigValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneConfigValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        cloneConfigValue(nestedValue),
      ]),
    );
  }

  return value;
}

export function buildToolDefaultConfig(
  tool: Pick<AgentToolDefinition, "configSchema"> | null | undefined,
): ToolConfig {
  const defaults: ToolConfig = {};

  for (const [key, schema] of Object.entries(tool?.configSchema ?? {})) {
    if (schema.defaultValue !== undefined) {
      defaults[key] = cloneConfigValue(schema.defaultValue);
    }
  }

  return defaults;
}

export function buildInitialToolConfig(
  tool: Pick<AgentToolDefinition, "configSchema"> | null | undefined,
  existingConfig?: ToolConfig,
): ToolConfig {
  return {
    ...buildToolDefaultConfig(tool),
    ...(existingConfig ?? {}),
  };
}