import type { NodeDefinition, WorkflowNodeScope, WorkflowTriggerType, WorkflowType } from "@/lib/workflows/types";

export const WORKFLOW_TYPES: WorkflowType[] = ["messages", "voice"];

const ACCEPTED_SCOPES: Record<WorkflowType, WorkflowNodeScope[]> = {
  messages: ["shared", "whatsapp"],
  voice: ["voice"],
};

const TYPE_FREE_NODES = new Set(["group", "decoration_background"]);

type DefinitionShape = Pick<NodeDefinition, "type" | "category" | "scopes">;

export function workflowTypeOfTrigger(triggerType: WorkflowTriggerType): WorkflowType {
  return triggerType === "trigger_call_received" ? "voice" : "messages";
}

export function workflowTypeOfTriggerDefinition(def?: DefinitionShape): WorkflowType | null {
  if (!def || def.category !== "trigger") return null;
  const scopes = def.scopes ?? [];
  return WORKFLOW_TYPES.find((type) => scopes.some((scope) => ACCEPTED_SCOPES[type].includes(scope))) ?? null;
}

export function definitionAllowedForType(wfType: WorkflowType, def?: DefinitionShape): boolean {
  if (!def) return false;
  if (TYPE_FREE_NODES.has(def.type)) return true;
  return (def.scopes ?? []).some((scope) => ACCEPTED_SCOPES[wfType].includes(scope));
}
