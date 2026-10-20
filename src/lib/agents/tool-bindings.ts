import type { AgentToolDefinition, ToolBinding } from "./types";

const MAX_TOOL_NAME_LENGTH = 64;

export const RUN_WORKFLOW_TOOL = "run_workflow";

export function toolBindingKey(tool: Pick<AgentToolDefinition, "name" | "bindingKey">): string | undefined {
  return tool.bindingKey || undefined;
}

export function boundKeyOf(toolName: string, base: string): string | null {
  const prefix = `${base.trim().toLowerCase()}_`;
  const name = toolName.trim().toLowerCase();
  if (name.length <= prefix.length || !name.startsWith(prefix)) return null;
  return name.slice(prefix.length);
}

function boundToolName(base: string, key: string): string {
  const safeKey = key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
  if (safeKey === "") return "";
  return `${base.trim().toLowerCase()}_${safeKey}`.slice(0, MAX_TOOL_NAME_LENGTH);
}

function bindingValue(binding: ToolBinding, key: string): string {
  const value = binding.config?.[key];
  return typeof value === "string" ? value : "";
}

export function bindingIdentity(binding: Pick<ToolBinding, "name" | "config">, key: string | undefined): string {
  if (!key) return binding.name.trim().toLowerCase();
  return boundToolName(binding.name, bindingValue(binding, key));
}

export interface BindingChange {
  bindings: ToolBinding[];
  duplicate: boolean;
}

function collides(bindings: readonly ToolBinding[], candidate: ToolBinding, key: string | undefined, except: number | null): boolean {
  const identity = bindingIdentity(candidate, key);
  return bindings.some(
    (binding, index) => index !== except && binding.name === candidate.name && bindingIdentity(binding, key) === identity,
  );
}

export function addToolBinding(bindings: ToolBinding[], binding: ToolBinding, key: string | undefined): BindingChange {
  if (collides(bindings, binding, key, null)) return { bindings, duplicate: true };
  return { bindings: [...bindings, binding], duplicate: false };
}

export function replaceToolBindingAt(
  bindings: ToolBinding[],
  index: number,
  binding: ToolBinding,
  key: string | undefined,
): BindingChange {
  if (collides(bindings, binding, key, index)) return { bindings, duplicate: true };
  return { bindings: bindings.map((current, at) => (at === index ? binding : current)), duplicate: false };
}

export function removeToolBindingAt(bindings: ToolBinding[], index: number): ToolBinding[] {
  return bindings.filter((_, at) => at !== index);
}

export function boundValues(bindings: readonly ToolBinding[], toolName: string, key: string, except: number | null): Set<string> {
  const values = new Set<string>();
  bindings.forEach((binding, index) => {
    if (index === except || binding.name !== toolName) return;
    const value = bindingValue(binding, key);
    if (value) values.add(value);
  });
  return values;
}
